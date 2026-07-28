"""Deterministic governance for ingredient identities and relationships."""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence

MAPPING_CLASSIFICATIONS = frozenset(
    {
        "exact_canonical_match",
        "approved_alias",
        "context_qualified_alias",
        "ambiguous_and_withheld",
        "source_artifact_and_quarantined",
        "unsafe_parent_child_inference_and_withheld",
        "unknown_or_unmatched",
    }
)
LINKABLE_CLASSIFICATIONS = frozenset({"exact_canonical_match", "approved_alias", "context_qualified_alias"})
WITHHELD_CLASSIFICATIONS = frozenset(
    {
        "ambiguous_and_withheld",
        "source_artifact_and_quarantined",
        "unsafe_parent_child_inference_and_withheld",
        "unknown_or_unmatched",
    }
)
REVIEW_STATUSES = frozenset({"approved", "withheld", "quarantined", "manual_review_required"})


def _normalize(value: str) -> str:
    """Mirror enrichment normalization without creating an import cycle."""
    import re
    import unicodedata

    text = unicodedata.normalize("NFKC", value).casefold().replace("_", " ")
    text = re.sub(r"[\u2010-\u2015-]+", " ", text)
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return " ".join(text.split())


def _scope_values(entry: Mapping, name: str) -> tuple[str, ...]:
    values = entry.get(name, ())
    if not isinstance(values, Sequence) or isinstance(values, (str, bytes)):
        raise ValueError(f"governance {name} must be a list")
    return tuple(sorted({str(value) for value in values}))


def scopes_overlap(left: Mapping, right: Mapping) -> bool:
    """Return whether two country/category scope pairs can match the same row."""
    for name in ("country_scope", "category_scope"):
        left_values = set(_scope_values(left, name))
        right_values = set(_scope_values(right, name))
        if left_values and right_values and left_values.isdisjoint(right_values):
            return False
    return True


def scope_matches(entry: Mapping, country: str, category: str | None) -> bool:
    countries = set(_scope_values(entry, "country_scope"))
    categories = set(_scope_values(entry, "category_scope"))
    return (not countries or country in countries) and (not categories or category in categories)


def _specificity(entry: Mapping) -> tuple[int, int, tuple[str, ...], tuple[str, ...]]:
    countries = _scope_values(entry, "country_scope")
    categories = _scope_values(entry, "category_scope")
    return (bool(countries) + bool(categories), -len(countries), countries, categories)


def governed_token_entry(
    registry: Mapping, normalized_token: str, country: str, category: str | None
) -> Mapping | None:
    """Resolve one governed token using the narrowest matching approved scope."""
    if registry.get("schema_version") != 2:
        return None
    matches = [
        entry
        for entry in registry.get("entries", ())
        if entry.get("normalized_source_token") == normalized_token and scope_matches(entry, country, category)
    ]
    if not matches:
        return None
    return sorted(matches, key=_specificity, reverse=True)[0]


def parent_child_rule(
    registry: Mapping,
    parent_normalized_token: str,
    child_normalized_token: str,
    country: str,
    category: str | None,
) -> Mapping | None:
    """Resolve a governed parent-child decision for one evidence row."""
    if registry.get("schema_version") != 2:
        return None
    matches = [
        rule
        for rule in registry.get("parent_child_rules", ())
        if rule.get("parent_normalized_token") == parent_normalized_token
        and rule.get("child_normalized_token") == child_normalized_token
        and scope_matches(rule, country, category)
    ]
    if not matches:
        return None
    return sorted(matches, key=_specificity, reverse=True)[0]


def _validate_token_entry(entry: Mapping, references: frozenset[str], generic_tokens: frozenset[str]) -> None:
    required_text = ("raw_source_token", "normalized_source_token", "source_or_evidence", "review_note")
    for field in required_text:
        if not isinstance(entry.get(field), str) or not str(entry[field]).strip():
            raise ValueError(f"governance entry requires non-empty {field}")
    normalized = str(entry["normalized_source_token"])
    if normalized != _normalize(str(entry["raw_source_token"])):
        raise ValueError(f"governance normalized token mismatch: {normalized!r}")
    classification = str(entry.get("mapping_classification"))
    if classification not in MAPPING_CLASSIFICATIONS:
        raise ValueError(f"unsupported governance classification: {classification}")
    if entry.get("review_status") not in REVIEW_STATUSES:
        raise ValueError(f"unsupported governance review status for {normalized!r}")
    if not isinstance(entry.get("allergen_derivation_allowed"), bool):
        raise ValueError(f"governance allergen permission must be boolean for {normalized!r}")
    if not isinstance(entry.get("parent_child_inference_allowed"), bool):
        raise ValueError(f"governance parent-child permission must be boolean for {normalized!r}")
    countries = _scope_values(entry, "country_scope")
    categories = _scope_values(entry, "category_scope")
    canonical = entry.get("canonical_ingredient_identity")
    if classification in LINKABLE_CLASSIFICATIONS:
        if not canonical or canonical not in references:
            raise ValueError(f"governance target missing from reference vocabulary for {normalized!r}")
        if classification == "context_qualified_alias" and not (countries or categories):
            raise ValueError(f"context-qualified alias requires a country or category scope: {normalized!r}")
        if normalized in generic_tokens and classification != "context_qualified_alias":
            raise ValueError(f"generic token cannot map to a specific identity globally: {normalized!r}")
    elif canonical is not None:
        raise ValueError(f"withheld governance entry cannot declare a canonical identity: {normalized!r}")
    if classification == "ambiguous_and_withheld":
        candidates = tuple(sorted({str(value) for value in entry.get("candidates", ())}))
        if len(candidates) < 2:
            raise ValueError(f"ambiguous governance entry needs at least two candidates: {normalized!r}")
        missing = sorted(value for value in candidates if value not in references)
        if missing:
            raise ValueError(f"ambiguous candidates missing from reference vocabulary: {missing}")
    if classification in WITHHELD_CLASSIFICATIONS and (
        entry["allergen_derivation_allowed"] or entry["parent_child_inference_allowed"]
    ):
        raise ValueError(f"withheld governance entry cannot permit inference: {normalized!r}")


def _validate_conflicts(entries: Sequence[Mapping]) -> None:
    for index, left in enumerate(entries):
        for right in entries[index + 1 :]:
            if left["normalized_source_token"] != right["normalized_source_token"] or not scopes_overlap(left, right):
                continue
            left_decision = (left.get("mapping_classification"), left.get("canonical_ingredient_identity"))
            right_decision = (right.get("mapping_classification"), right.get("canonical_ingredient_identity"))
            if left_decision != right_decision:
                raise ValueError(
                    "overlapping governance scopes map one alias to contradictory identities: "
                    f"{left['normalized_source_token']!r}"
                )
            raise ValueError(f"duplicate governance entry in overlapping scopes: {left['normalized_source_token']!r}")


def _validate_cycles(entries: Sequence[Mapping]) -> None:
    graph: dict[str, set[str]] = {}
    for entry in entries:
        if entry.get("mapping_classification") not in {"approved_alias", "context_qualified_alias"}:
            continue
        source = str(entry["normalized_source_token"])
        target = _normalize(str(entry["canonical_ingredient_identity"]))
        if source != target:
            graph.setdefault(source, set()).add(target)
    state: dict[str, int] = {}

    def visit(node: str) -> None:
        if state.get(node) == 1:
            raise ValueError(f"circular governance alias relationship detected at {node!r}")
        if state.get(node) == 2:
            return
        state[node] = 1
        for target in sorted(graph.get(node, ())):
            visit(target)
        state[node] = 2

    for source in sorted(graph):
        visit(source)


def _validate_parent_rules(rules: Sequence[Mapping]) -> None:
    for rule in rules:
        parent = str(rule.get("parent_normalized_token", ""))
        child = str(rule.get("child_normalized_token", ""))
        if not parent or not child or parent == child:
            raise ValueError("parent-child governance requires distinct normalized parent and child tokens")
        if rule.get("mapping_classification") != "unsafe_parent_child_inference_and_withheld":
            raise ValueError(f"unsupported parent-child governance classification for {parent!r}/{child!r}")
        if rule.get("inference_allowed") is not False or rule.get("allergen_derivation_allowed") is not False:
            raise ValueError(f"unsafe parent-child rule cannot permit inference for {parent!r}/{child!r}")
        if rule.get("review_status") != "withheld":
            raise ValueError(f"unsafe parent-child rule must be withheld for {parent!r}/{child!r}")
        _scope_values(rule, "country_scope")
        _scope_values(rule, "category_scope")
        for field in ("source_or_evidence", "review_note"):
            if not isinstance(rule.get(field), str) or not str(rule[field]).strip():
                raise ValueError(f"parent-child governance requires non-empty {field}")
    for index, left in enumerate(rules):
        for right in rules[index + 1 :]:
            same_pair = (
                left["parent_normalized_token"],
                left["child_normalized_token"],
            ) == (right["parent_normalized_token"], right["child_normalized_token"])
            if same_pair and scopes_overlap(left, right):
                raise ValueError("overlapping parent-child governance rules are contradictory")


def validate_governance_registry(registry: Mapping, reference_names: Iterable[str]) -> None:
    """Fail fast when governance control data is incomplete or contradictory."""
    if registry.get("schema_version") != 2:
        raise ValueError("unsupported enrichment governance schema")
    entries = registry.get("entries")
    rules = registry.get("parent_child_rules")
    if not isinstance(entries, list) or not isinstance(rules, list):
        raise ValueError("governance entries and parent_child_rules must be lists")
    references = frozenset(reference_names)
    generic_tokens = frozenset(str(value) for value in registry.get("generic_tokens", ()))
    for token in generic_tokens:
        if token != _normalize(token):
            raise ValueError(f"generic governance token must be normalized: {token!r}")
    for entry in entries:
        _validate_token_entry(entry, references, generic_tokens)
    _validate_conflicts(entries)
    _validate_cycles(entries)
    _validate_parent_rules(rules)


def historical_phase4b_registry(registry: Mapping) -> dict:
    """Project schema v2 into the registry used by the historical Phase 4B ranking.

    The committed candidate ranking is an immutable record of the decision made
    before scoped governance existed.  This projection is intentionally limited
    to reproducing that read-only report; enrichment writes continue to use the
    scoped schema-v2 registry.
    """
    if registry.get("schema_version") != 2:
        return dict(registry)

    projected: dict[str, dict] = {
        "aliases": {},
        "reviewed": {},
        "ambiguous": {},
        "quarantined": {},
        "allergen_aliases": dict(registry.get("allergen_aliases", {})),
    }
    for entry in registry.get("entries", ()):
        token = str(entry["normalized_source_token"])
        classification = entry["mapping_classification"]
        if classification == "approved_alias":
            projected["aliases"][token] = str(entry["canonical_ingredient_identity"])
        elif classification == "context_qualified_alias":
            target = str(entry["canonical_ingredient_identity"])
            previous = projected["reviewed"].setdefault(token, target)
            if previous != target:
                raise ValueError(f"historical Phase 4B alias conflict for {token!r}")
        elif classification == "ambiguous_and_withheld":
            projected["ambiguous"][token] = list(entry.get("candidates", ()))
        elif classification == "source_artifact_and_quarantined":
            projected["quarantined"][token] = str(entry["review_note"])
    return projected
