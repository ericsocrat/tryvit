"""Deterministic ingredient and allergen enrichment primitives.

The module is deliberately pure: callers provide source evidence and the
reference vocabulary, and receive stable matches plus SQL.  It performs no
network or database access.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from pipeline.enrichment_governance import (
    governed_token_entry,
    parent_child_rule,
    validate_governance_registry,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = Path(__file__).with_name("enrichment_registry.json")
PILOT_PATH = Path(__file__).with_name("enrichment_pilot.json")
PHASE4B_PATH = Path(__file__).with_name("enrichment_phase4b.json")
PHASE4D_PATH = Path(__file__).with_name("enrichment_phase4d.json")
SNAPSHOT_PATH = PROJECT_ROOT / "supabase" / "migrations" / "20260601173035_populate_ingredients_allergens.sql"

ALLERGEN_IDS = frozenset(
    {
        "celery",
        "crustaceans",
        "eggs",
        "fish",
        "gluten",
        "lupin",
        "milk",
        "molluscs",
        "mustard",
        "peanuts",
        "sesame",
        "soybeans",
        "sulphites",
        "tree-nuts",
    }
)


@dataclass(frozen=True)
class IngredientEvidence:
    country: str
    ean: str
    source_text: str
    position: int
    percent: str | None = None
    percent_estimate: str | None = None
    is_sub_ingredient: bool = False
    parent_source_text: str | None = None
    canonical_hint: str | None = None
    category: str | None = None


@dataclass(frozen=True)
class IngredientMatch:
    evidence: IngredientEvidence
    normalized_text: str
    classification: str
    canonical_name: str | None
    candidates: tuple[str, ...] = ()


@dataclass(frozen=True)
class AllergenEvidence:
    country: str
    ean: str
    source_tag: str
    kind: str


def normalize_token(value: str) -> str:
    """Return a conservative, locale-independent comparison token."""
    text = unicodedata.normalize("NFKC", value).casefold().replace("_", " ")
    text = re.sub(r"[\u2010-\u2015-]+", " ", text)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return " ".join(text.split())


def load_registry(path: Path = REGISTRY_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_registry(registry: Mapping, reference_names: Iterable[str]) -> None:
    """Reject conflicting or non-existent explicit mappings.

    Registry entries are human-reviewed control data.  A token may belong to
    exactly one of aliases, reviewed mappings, or the ambiguity quarantine.
    Every declared target must already exist in the committed reference
    vocabulary; the registry never creates semantic identities implicitly.
    """
    references = frozenset(reference_names)
    if registry.get("schema_version") == 2:
        validate_governance_registry(registry, references)
        invalid_allergens = sorted(
            str(target) for target in registry.get("allergen_aliases", {}).values() if str(target) not in ALLERGEN_IDS
        )
        if invalid_allergens:
            raise ValueError(f"allergen aliases target unknown canonical IDs: {invalid_allergens}")
        return
    groups = {
        name: {normalize_token(str(key)): value for key, value in registry.get(name, {}).items()}
        for name in ("aliases", "reviewed", "ambiguous", "quarantined")
    }
    for left, right in (
        ("aliases", "reviewed"),
        ("aliases", "ambiguous"),
        ("aliases", "quarantined"),
        ("reviewed", "ambiguous"),
        ("reviewed", "quarantined"),
        ("ambiguous", "quarantined"),
    ):
        overlap = sorted(groups[left].keys() & groups[right].keys())
        if overlap:
            raise ValueError(f"conflicting enrichment registry tokens in {left}/{right}: {overlap}")
    for group_name in ("aliases", "reviewed"):
        missing = sorted(str(target) for target in groups[group_name].values() if str(target) not in references)
        if missing:
            raise ValueError(f"{group_name} targets missing from reference vocabulary: {missing}")
    for token, candidates in groups["ambiguous"].items():
        values = tuple(sorted({str(value) for value in candidates}))
        if len(values) < 2:
            raise ValueError(f"ambiguous token {token!r} must declare at least two candidates")
        missing = sorted(value for value in values if value not in references)
        if missing:
            raise ValueError(f"ambiguous candidates missing from reference vocabulary: {missing}")
    invalid_allergens = sorted(
        str(target) for target in registry.get("allergen_aliases", {}).values() if str(target) not in ALLERGEN_IDS
    )
    if invalid_allergens:
        raise ValueError(f"allergen aliases target unknown canonical IDs: {invalid_allergens}")


def pilot_categories(path: Path = PILOT_PATH) -> frozenset[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return frozenset(item["category"] for item in payload["products"])


def pilot_scopes(path: Path = PILOT_PATH) -> frozenset[tuple[str, str]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return frozenset((item["category"], item["country"]) for item in payload["products"])


def manifest_scopes(path: Path) -> frozenset[tuple[str, str]]:
    """Return the explicitly approved category-country scopes in a manifest."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    if "scopes" in payload:
        return frozenset((item["category"], item["country"]) for item in payload["scopes"])
    return frozenset((item["category"], item["country"]) for item in payload.get("products", ()))


def enrichment_scopes(paths: Sequence[Path] | None = None) -> frozenset[tuple[str, str]]:
    """Return every approved scope across Phase 4 manifests."""
    manifests = tuple(paths or (PILOT_PATH, PHASE4B_PATH, PHASE4D_PATH))
    scopes: set[tuple[str, str]] = set()
    for path in manifests:
        if path.is_file():
            scopes.update(manifest_scopes(path))
    return frozenset(scopes)


@lru_cache(maxsize=1)
def load_snapshot_reference_names(path: Path = SNAPSHOT_PATH) -> frozenset[str]:
    """Read the committed reference vocabulary without parsing live data."""
    pattern = re.compile(
        r"^\s*\('[A-Z]{2}', '\d+', '((?:''|[^'])*)', \d+,",
        re.MULTILINE,
    )
    return frozenset(value.replace("''", "'") for value in pattern.findall(path.read_text(encoding="utf-8")))


def _normalized_index(reference_names: Iterable[str]) -> dict[str, tuple[str, ...]]:
    grouped: dict[str, set[str]] = {}
    for name in sorted(set(reference_names)):
        grouped.setdefault(normalize_token(name), set()).add(name)
    return {key: tuple(sorted(values)) for key, values in grouped.items()}


def match_ingredient(
    evidence: IngredientEvidence,
    reference_names: Iterable[str],
    registry: Mapping | None = None,
) -> IngredientMatch:
    """Classify one token without guessing when a match is ambiguous."""
    config = dict(registry or load_registry())
    references = frozenset(reference_names)
    index = _normalized_index(references)
    validate_registry(config, references)
    return _match_ingredient(evidence, references, index, config)


def _match_ingredient(
    evidence: IngredientEvidence,
    references: frozenset[str],
    index: Mapping[str, tuple[str, ...]],
    config: Mapping,
) -> IngredientMatch:
    """Classify one token using a pre-built deterministic reference index."""
    normalized = normalize_token(evidence.source_text)

    governed = governed_token_entry(config, normalized, evidence.country, evidence.category)
    if governed is not None:
        classification = governed["mapping_classification"]
        if classification in {"exact_canonical_match", "approved_alias", "context_qualified_alias"}:
            compatibility_classification = {
                "exact_canonical_match": "exact",
                "approved_alias": "alias",
                "context_qualified_alias": "reviewed",
            }[classification]
            return IngredientMatch(
                evidence,
                normalized,
                compatibility_classification,
                str(governed["canonical_ingredient_identity"]),
            )
        if classification == "ambiguous_and_withheld":
            return IngredientMatch(
                evidence,
                normalized,
                "ambiguous",
                None,
                tuple(sorted(str(value) for value in governed.get("candidates", ()))),
            )
        if classification == "source_artifact_and_quarantined":
            return IngredientMatch(evidence, normalized, "quarantined", None)
        return IngredientMatch(evidence, normalized, "unresolved", None)
    if config.get("schema_version") == 2 and any(
        entry.get("normalized_source_token") == normalized for entry in config.get("entries", ())
    ):
        # A reviewed token outside its approved scope must not fall through to
        # normalized exact matching; that would silently leak the scoped rule.
        return IngredientMatch(evidence, normalized, "unresolved", None)

    if normalized in config.get("quarantined", {}):
        return IngredientMatch(evidence, normalized, "quarantined", None)

    explicit = tuple(sorted(config.get("ambiguous", {}).get(normalized, ())))
    if explicit:
        return IngredientMatch(evidence, normalized, "ambiguous", None, explicit)

    alias_target = config.get("aliases", {}).get(normalized)
    if alias_target in references:
        return IngredientMatch(evidence, normalized, "alias", alias_target)

    reviewed_target = config.get("reviewed", {}).get(normalized)
    if reviewed_target in references:
        return IngredientMatch(evidence, normalized, "reviewed", reviewed_target)

    for candidate in (evidence.source_text.strip(), (evidence.canonical_hint or "").strip()):
        if candidate and candidate in references:
            return IngredientMatch(evidence, normalized, "exact", candidate)

    for candidate in (evidence.source_text, evidence.canonical_hint or ""):
        hits = index.get(normalize_token(candidate), ()) if candidate else ()
        if len(hits) == 1:
            return IngredientMatch(evidence, normalized, "alias", hits[0])
        if len(hits) > 1:
            return IngredientMatch(evidence, normalized, "ambiguous", None, hits)

    return IngredientMatch(evidence, normalized, "unresolved", None)


def match_ingredients(
    evidence: Sequence[IngredientEvidence],
    reference_names: Iterable[str],
    registry: Mapping | None = None,
) -> list[IngredientMatch]:
    """Match, de-duplicate, and order evidence deterministically."""
    references = frozenset(reference_names)
    config = dict(registry or load_registry())
    validate_registry(config, references)
    index = _normalized_index(references)
    matched = [_match_ingredient(item, references, index, config) for item in evidence]
    ordered = sorted(
        matched,
        key=lambda row: (
            row.evidence.country,
            row.evidence.ean,
            row.evidence.position,
            row.normalized_text,
            row.canonical_name or "",
        ),
    )
    seen: set[tuple[str, str, int, str]] = set()
    result: list[IngredientMatch] = []
    for row in ordered:
        identity = (
            row.evidence.country,
            row.evidence.ean,
            row.evidence.position,
            row.canonical_name or row.normalized_text,
        )
        if identity not in seen:
            seen.add(identity)
            result.append(row)
    return result


def canonicalize_allergens(
    evidence: Sequence[AllergenEvidence], registry: Mapping | None = None
) -> list[AllergenEvidence]:
    """Keep only explicit contains/traces evidence with known canonical IDs."""
    config = dict(registry or load_registry())
    aliases = config.get("allergen_aliases", {})
    result: dict[tuple[str, str, str, str], AllergenEvidence] = {}
    for row in evidence:
        if row.kind not in {"contains", "traces"}:
            continue
        raw = row.source_tag.strip()
        normalized = normalize_token(raw.removeprefix("en:"))
        tag = aliases.get(normalized, normalized.replace(" ", "-"))
        if tag not in ALLERGEN_IDS:
            continue
        key = (row.country, row.ean, tag, row.kind)
        result[key] = AllergenEvidence(row.country, row.ean, raw, row.kind)
    return [result[key] for key in sorted(result)]


def linkable_matches(
    matches: Sequence[IngredientMatch], registry: Mapping | None = None
) -> list[IngredientMatch]:
    """Return matched rows whose parent relationship is also unambiguous."""
    config = dict(registry or load_registry())
    canonical_by_source = {
        (row.evidence.country, row.evidence.ean, row.normalized_text): row.canonical_name
        for row in matches
        if row.canonical_name is not None
    }
    result: list[IngredientMatch] = []
    for row in matches:
        if row.canonical_name is None:
            continue
        if not row.evidence.is_sub_ingredient:
            result.append(row)
            continue
        parent_token = normalize_token(row.evidence.parent_source_text or "")
        if canonical_by_source.get((row.evidence.country, row.evidence.ean, parent_token)) is None:
            continue
        rule = parent_child_rule(
            config,
            parent_token,
            row.normalized_text,
            row.evidence.country,
            row.evidence.category,
        )
        if rule is None or rule.get("inference_allowed") is True:
            result.append(row)
    return result


def _sql_text(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def _sql_numeric(value: str | None) -> str:
    return "NULL::numeric" if value is None else f"{value}::numeric"


def generate_enrichment_sql(
    category: str,
    matches: Sequence[IngredientMatch],
    allergens: Sequence[AllergenEvidence],
    source_label: str,
    reference_properties: Mapping[str, tuple[bool, str, str, str]] | None = None,
    phase: str | None = None,
) -> str:
    """Generate stable, idempotent linkage SQL keyed by country and EAN."""
    canonical_by_source = {
        (row.evidence.country, row.evidence.ean, row.normalized_text): row.canonical_name
        for row in matches
        if row.canonical_name is not None
    }
    linked = linkable_matches(matches)
    linked.sort(
        key=lambda row: (
            row.evidence.country,
            row.evidence.ean,
            row.evidence.position,
            row.canonical_name or "",
        )
    )
    canonical_allergens = canonicalize_allergens(allergens)
    lines = [
        "-- Generated deterministic ingredient/allergen enrichment",
        *([f"-- Phase: {phase}"] if phase else []),
        f"-- Category: {category}",
        f"-- Source: {source_label}",
        "-- Identity: products(country, ean); absence of rows means unknown.",
        "BEGIN;",
        "",
    ]
    if linked:
        properties = reference_properties or {}
        needed_references = {row.canonical_name for row in linked if row.canonical_name}
        needed_references.update(
            canonical_by_source.get(
                (
                    row.evidence.country,
                    row.evidence.ean,
                    normalize_token(row.evidence.parent_source_text or ""),
                )
            )
            for row in linked
            if row.evidence.is_sub_ingredient
        )
        reference_values = []
        for name in sorted(item for item in needed_references if item):
            is_additive, vegan, vegetarian, palm = properties.get(name, (False, "unknown", "unknown", "unknown"))
            reference_values.append(
                "  ("
                + ", ".join(
                    [
                        _sql_text(name),
                        "true" if is_additive else "false",
                        _sql_text(vegan),
                        _sql_text(vegetarian),
                        _sql_text(palm),
                    ]
                )
                + ")"
            )
        lines.extend(
            [
                "INSERT INTO ingredient_ref",
                "  (name_en, is_additive, vegan, vegetarian, from_palm_oil)",
                "VALUES",
                ",\n".join(reference_values),
                "ON CONFLICT (name_en) DO NOTHING;",
                "",
            ]
        )
        values = []
        for row in linked:
            ev = row.evidence
            parent = (
                canonical_by_source.get((ev.country, ev.ean, normalize_token(ev.parent_source_text or "")))
                if ev.is_sub_ingredient
                else None
            )
            values.append(
                "  ("
                + ", ".join(
                    [
                        _sql_text(ev.country),
                        _sql_text(ev.ean),
                        _sql_text(row.canonical_name),
                        str(ev.position),
                        _sql_numeric(ev.percent),
                        _sql_numeric(ev.percent_estimate),
                        "true" if ev.is_sub_ingredient else "false",
                        _sql_text(parent),
                    ]
                )
                + ")"
            )
        lines.extend(
            [
                "WITH evidence(country, ean, ingredient_name, position, percent, "
                "percent_estimate, is_sub, parent_name) AS (",
                " VALUES",
                ",\n".join(values),
                ")",
                "INSERT INTO product_ingredient",
                "  (product_id, ingredient_id, position, percent, percent_estimate, "
                "is_sub_ingredient, parent_ingredient_id)",
                "SELECT p.product_id, i.ingredient_id, e.position, e.percent, e.percent_estimate,",
                "       e.is_sub, parent_i.ingredient_id",
                "FROM evidence e",
                "JOIN products p ON p.country = e.country AND p.ean = e.ean",
                "  AND p.category = " + _sql_text(category) + " AND p.is_deprecated IS NOT TRUE",
                "JOIN ingredient_ref i ON i.name_en = e.ingredient_name",
                "LEFT JOIN ingredient_ref parent_i ON parent_i.name_en = e.parent_name",
                "WHERE e.is_sub IS FALSE OR parent_i.ingredient_id IS NOT NULL",
                "ON CONFLICT (product_id, ingredient_id, position) DO NOTHING;",
                "",
            ]
        )
    if canonical_allergens:
        values = []
        for row in canonical_allergens:
            raw = normalize_token(row.source_tag.removeprefix("en:")).replace(" ", "-")
            tag = load_registry().get("allergen_aliases", {}).get(raw, raw)
            values.append(
                "  ("
                + ", ".join(
                    [
                        _sql_text(row.country),
                        _sql_text(row.ean),
                        _sql_text(tag),
                        _sql_text(row.kind),
                        _sql_text(row.source_tag),
                    ]
                )
                + ")"
            )
        lines.extend(
            [
                "WITH evidence(country, ean, tag, type, source_tag) AS (",
                " VALUES",
                ",\n".join(values),
                ")",
                "INSERT INTO product_allergen_info (product_id, tag, type, source_tag)",
                "SELECT p.product_id, e.tag, e.type, e.source_tag",
                "FROM evidence e",
                "JOIN products p ON p.country = e.country AND p.ean = e.ean",
                "  AND p.category = " + _sql_text(category) + " AND p.is_deprecated IS NOT TRUE",
                "JOIN allergen_ref a ON a.allergen_id = e.tag AND a.is_active IS TRUE",
                "ON CONFLICT (product_id, tag, type) DO NOTHING;",
                "",
            ]
        )
    lines.extend(["COMMIT;", ""])
    return "\n".join(lines)


def evidence_from_products(
    products: Sequence[Mapping], country: str, category: str | None = None
) -> tuple[list[IngredientEvidence], list[AllergenEvidence]]:
    """Convert normalized pipeline products into explicit source evidence."""
    ingredients: list[IngredientEvidence] = []
    allergens: list[AllergenEvidence] = []
    for product in products:
        ean = str(product.get("ean") or "")
        if not ean:
            continue
        for position, item in enumerate(product.get("_ingredients") or (), 1):
            text = str(item.get("text") or "").strip()
            hint = str(item.get("id") or "").removeprefix("en:").replace("-", " ").strip()
            if not text and not hint:
                continue
            ingredients.append(
                IngredientEvidence(
                    country=country,
                    ean=ean,
                    source_text=text or hint,
                    canonical_hint=hint or None,
                    position=position,
                    percent=str(item["percent"]) if item.get("percent") is not None else None,
                    percent_estimate=(
                        str(item["percent_estimate"]) if item.get("percent_estimate") is not None else None
                    ),
                    category=category,
                )
            )
        for raw in product.get("_allergens_tags") or ():
            allergens.append(AllergenEvidence(country, ean, str(raw), "contains"))
        for raw in product.get("_traces_tags") or ():
            allergens.append(AllergenEvidence(country, ean, str(raw), "traces"))
    return ingredients, allergens
