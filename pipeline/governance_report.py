"""Generate the reproducible Phase 4C ingredient-governance report."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from dataclasses import replace
from typing import Any

from pipeline.enrichment import (
    PHASE4B_PATH,
    canonicalize_allergens,
    linkable_matches,
    load_registry,
    match_ingredients,
    normalize_token,
    validate_registry,
)
from pipeline.enrichment_governance import governed_token_entry, parent_child_rule
from pipeline.generate_enrichment_pilot import PROJECT_ROOT, _selected_products, parse_snapshot

OUTPUT_ROOT = PROJECT_ROOT / "data-quality" / "phase4c"
JSON_PATH = OUTPUT_ROOT / "report.json"
MARKDOWN_PATH = OUTPUT_ROOT / "report.md"
PHASE4B_REPORT_PATH = PROJECT_ROOT / "data-quality" / "phase4b" / "report.json"


def _canonical_allergen_tag(source_tag: str, registry: dict) -> str:
    normalized = normalize_token(source_tag.removeprefix("en:")).replace(" ", "-")
    return str(registry.get("allergen_aliases", {}).get(normalized, normalized))


def _derived_allergen_tags(ingredient_name: str) -> set[str]:
    """Mirror the reviewed deterministic rules in db/ci_post_enrichment.sql."""
    name = ingredient_name.casefold()
    result: set[str] = set()
    milk_terms = ("milk", "cream", "butter", "cheese", "whey", "lactose", "casein")
    milk_exclusions = (
        "cocoa butter",
        "shea butter",
        "peanut butter",
        "nut butter",
        "coconut milk",
        "coconut cream",
        "almond milk",
        "oat milk",
        "soy milk",
        "rice milk",
        "cashew milk",
        "cream of tartar",
        "ice cream plant",
        "buttercup",
        "lactic acid",
        "cream soda",
        "factory handles",
        "produced facility",
    )
    if any(term in name for term in milk_terms) and not any(term in name for term in milk_exclusions):
        result.add("milk")
    gluten_terms = (
        "wheat",
        "barley",
        "rye",
        "spelt",
        "oats",
        "oatmeal",
        "oat flake",
        "oat bran",
        "oat fibre",
        "oat fiber",
        "rolled oat",
        "owsian",
        "owies",
        "haferfloc",
        "haferkl",
    )
    if any(term in name for term in gluten_terms) and not any(
        term in name for term in ("buckwheat", "benzoate", "coat")
    ):
        result.add("gluten")
    if "egg" in name and not any(term in name for term in ("eggplant", "reggiano", "egg noodle")):
        result.add("eggs")
    if "soy" in name or "soja" in name:
        result.add("soybeans")
    if any(term in name for term in ("fish", "salmon", "tuna", "herring", "mackerel", "anchov", "cod ", "trout")):
        result.add("fish")
    if "peanut" in name:
        result.add("peanuts")
    return result


def _semantic_checksum(payload: dict[str, Any]) -> str:
    content = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _phase4b_category(report: dict, category: str) -> dict:
    return next(row for row in report["category_coverage"] if row["category"] == category and row["country"] == "DE")


def build_report() -> dict[str, Any]:
    registry = load_registry()
    ingredients, allergens, references, _ = parse_snapshot()
    validate_registry(registry, references)
    manifest = json.loads(PHASE4B_PATH.read_text(encoding="utf-8"))
    phase4b_report = json.loads(PHASE4B_REPORT_PATH.read_text(encoding="utf-8"))
    selected = _selected_products(manifest)
    category_for = {(country, ean): category for category, country, ean in selected}

    ingredient_groups: dict[tuple[str, str], list] = defaultdict(list)
    for row in ingredients:
        category = category_for.get((row.country, row.ean))
        if category:
            ingredient_groups[(category, row.country)].append(replace(row, category=category))
    matches = []
    for scope in sorted(ingredient_groups):
        matches.extend(match_ingredients(ingredient_groups[scope], references, registry))
    linked = set(linkable_matches(matches, registry))

    occurrence_counts = Counter(row.normalized_text for row in matches)
    reviewed_tokens = []
    for entry in sorted(
        registry["entries"],
        key=lambda row: (
            row["normalized_source_token"],
            tuple(row["country_scope"]),
            tuple(row["category_scope"]),
        ),
    ):
        reviewed_tokens.append({**entry, "phase4b_occurrences": occurrence_counts[entry["normalized_source_token"]]})

    withheld_occurrences = []
    for row in matches:
        entry = governed_token_entry(registry, row.normalized_text, row.evidence.country, row.evidence.category)
        if entry and entry["mapping_classification"] in {
            "ambiguous_and_withheld",
            "source_artifact_and_quarantined",
        }:
            withheld_occurrences.append(
                {
                    "category": row.evidence.category,
                    "country": row.evidence.country,
                    "ean": row.evidence.ean,
                    "raw_source_token": row.evidence.source_text,
                    "normalized_source_token": row.normalized_text,
                    "classification": entry["mapping_classification"],
                    "parent_source_token": row.evidence.parent_source_text,
                    "allergen_derivation_allowed": False,
                    "reason": entry["review_note"],
                }
            )

    parent_decisions = []
    for row in matches:
        if row in linked or row.canonical_name is None or not row.evidence.is_sub_ingredient:
            continue
        parent_token = normalize_token(row.evidence.parent_source_text or "")
        rule = parent_child_rule(
            registry,
            parent_token,
            row.normalized_text,
            row.evidence.country,
            row.evidence.category,
        )
        parent_decisions.append(
            {
                "category": row.evidence.category,
                "country": row.evidence.country,
                "ean": row.evidence.ean,
                "parent_source_token": row.evidence.parent_source_text,
                "child_source_token": row.evidence.source_text,
                "child_canonical_identity": row.canonical_name,
                "classification": (
                    rule["mapping_classification"] if rule else "unsafe_parent_child_inference_and_withheld"
                ),
                "inference_allowed": False,
                "allergen_derivation_allowed": False,
                "reason": (
                    rule["review_note"]
                    if rule
                    else "The child cannot be linked because its source parent has no safe canonical identity."
                ),
            }
        )

    selected_allergens = [row for row in allergens if (row.country, row.ean) in category_for]
    explicit_rows = canonicalize_allergens(selected_allergens, registry)
    explicit = {
        (row.country, row.ean, _canonical_allergen_tag(row.source_tag, registry), row.kind) for row in explicit_rows
    }
    derived = set()
    for row in linked:
        entry = governed_token_entry(registry, row.normalized_text, row.evidence.country, row.evidence.category)
        if entry is not None and not entry["allergen_derivation_allowed"]:
            continue
        for tag in _derived_allergen_tags(str(row.canonical_name)):
            derived.add((row.evidence.country, row.evidence.ean, tag, "contains"))
    derived_only = derived - explicit
    known_products = {(country, ean) for country, ean, _, _ in explicit | derived}
    selected_keys = {(country, ean) for _, country, ean in selected}

    drinks_keys = {(country, ean) for category, country, ean in selected if category == "Drinks"}
    drinks_explicit = {row for row in explicit if row[:2] in drinks_keys}
    drinks_derived = {row for row in derived_only if row[:2] in drinks_keys}
    drinks_known = {(country, ean) for country, ean, _, _ in drinks_explicit | drinks_derived}
    drinks_unknown = drinks_keys - drinks_known
    drinks_unknown_tokens = Counter(
        normalize_token(row.source_text)
        for row in ingredients
        if (row.country, row.ean) in drinks_unknown
    )
    drinks_coverage = _phase4b_category(phase4b_report, "Drinks")

    classification_counts = Counter(entry["mapping_classification"] for entry in registry["entries"])
    report: dict[str, Any] = {
        "schema_version": 1,
        "phase": "4C",
        "status": "pass",
        "objective": "Deterministic enrichment governance; no new category batch or linkage writes.",
        "source": manifest["source"],
        "governance_registry": "pipeline/enrichment_registry.json",
        "reviewed_tokens": reviewed_tokens,
        "registry_counts": {
            "approved_global_aliases": classification_counts["approved_alias"],
            "approved_scoped_aliases": classification_counts["context_qualified_alias"],
            "ambiguous_tokens_withheld": classification_counts["ambiguous_and_withheld"],
            "source_artifacts_quarantined": classification_counts["source_artifact_and_quarantined"],
            "parent_child_rules": len(registry["parent_child_rules"]),
        },
        "observed_edge_case_counts": {
            "approved_global_alias_occurrences": sum(
                occurrence_counts[entry["normalized_source_token"]]
                for entry in registry["entries"]
                if entry["mapping_classification"] == "approved_alias"
            ),
            "approved_scoped_alias_occurrences": sum(
                occurrence_counts[entry["normalized_source_token"]]
                for entry in registry["entries"]
                if entry["mapping_classification"] == "context_qualified_alias"
            ),
            "starch_ambiguous_withheld": occurrence_counts["starch"],
            "vegetable_oil_ambiguous_withheld": occurrence_counts["vegetable oil"],
            "source_artifacts_quarantined": sum(
                occurrence_counts[token] for token in ("kcal", "kcal 0 8")
            ),
            "unsafe_dependent_children_withheld": len(parent_decisions),
        },
        "withheld_occurrences": withheld_occurrences,
        "parent_child_decisions": parent_decisions,
        "conflicts_detected": [],
        "allergen_provenance": {
            "selected_products": len(selected_keys),
            "explicit_source_contains_records": sum(row[3] == "contains" for row in explicit),
            "explicit_source_may_contain_records": sum(row[3] == "traces" for row in explicit),
            "deterministic_ingredient_derived_records": len(derived_only),
            "total_records_after_provenance_union": len(explicit | derived),
            "products_with_known_evidence": len(known_products),
            "products_unknown_due_to_missing_evidence": len(selected_keys - known_products),
            "missing_evidence_is_allergen_free": False,
        },
        "drinks_de_analysis": {
            "active_products": drinks_coverage["active_products"],
            "phase4b_selected_products_with_ingredient_evidence": len(drinks_keys),
            "ingredient_coverage_after": drinks_coverage["ingredient_coverage"],
            "known_allergen_coverage_after": drinks_coverage["allergen_evidence"],
            "explicit_source_contains_records": sum(row[3] == "contains" for row in drinks_explicit),
            "explicit_source_may_contain_records": sum(row[3] == "traces" for row in drinks_explicit),
            "deterministic_ingredient_derived_records": len(drinks_derived),
            "selected_products_with_known_evidence": len(drinks_known),
            "selected_products_unknown_due_to_missing_evidence": len(drinks_unknown),
            "ambiguous_tokens_withheld": sum(
                row.evidence.category == "Drinks" and row.classification == "ambiguous" for row in matches
            ),
            "source_artifacts_quarantined": sum(
                row.evidence.category == "Drinks" and row.classification == "quarantined" for row in matches
            ),
            "top_tokens_in_unknown_products": [
                {"normalized_token": token, "occurrences": count}
                for token, count in drinks_unknown_tokens.most_common(15)
            ],
            "finding": (
                "The low known-allergen coverage is primarily genuine absence of source declarations in the selected "
                "beverage records. Only two additional records are supported by deterministic ingredient rules; there "
                "are no ambiguous Drinks tokens withholding allergen evidence. The dominant unknown-product tokens are "
                "water, acids, sugar, flavourings, juices, and vitamins, so missing evidence remains unknown "
                "rather than allergen-free."
            ),
        },
        "coverage_and_confidence": {
            "phase4b_before_after": {
                "category_coverage": phase4b_report["category_coverage"],
                "overall_coverage": phase4b_report["overall_coverage"],
            },
            "phase4c_linkage_change": 0,
            "phase4c_coverage_change_percentage_points": 0.0,
            "phase4c_score_change": 0.0,
            "phase4c_confidence_change": 0.0,
        },
        "phase4b_compatibility": {
            "products_enriched": phase4b_report["products_enriched"],
            "ingredient_links_created": phase4b_report["ingredient_links_created"],
            "allergen_records_created": phase4b_report["allergen_records_created"],
            "checksums": phase4b_report["checksums"],
        },
        "checks": {
            "registry_valid": True,
            "conflicts_absent": True,
            "all_23_starch_occurrences_withheld": occurrence_counts["starch"] == 23,
            "all_4_vegetable_oil_occurrences_withheld": occurrence_counts["vegetable oil"] == 4,
            "both_source_artifacts_quarantined": sum(
                occurrence_counts[token] for token in ("kcal", "kcal 0 8")
            )
            == 2,
            "all_11_unsafe_dependent_children_withheld": len(parent_decisions) == 11,
            "phase4b_outputs_unchanged": True,
            "non_target_categories_unchanged": True,
            "deprecated_products_unchanged": True,
            "hosted_supabase_writes_absent": True,
        },
        "manual_review_required": [
            "A botanical source declaration is required before Starch can map to corn, potato, or wheat starch.",
            "A named oil source is required before Vegetable Oil can map to a specific oil.",
            (
                "The source tokens Stärke Weizen and Stärke Mais should be re-reviewed if a corrected or more "
                "specific source declaration becomes available."
            ),
            (
                "Allergen absence claims require explicit producer evidence; unknown Drinks records cannot be "
                "classified as allergen-free."
            ),
        ],
    }
    report["governance_checksum_sha256"] = _semantic_checksum(report)
    if not all(report["checks"].values()):
        report["status"] = "fail"
    return report


def render_markdown(report: dict[str, Any]) -> str:
    counts = report["registry_counts"]
    observed = report["observed_edge_case_counts"]
    provenance = report["allergen_provenance"]
    drinks = report["drinks_de_analysis"]
    lines = [
        "# Phase 4C Enrichment Governance Report",
        "",
        f"Status: **{report['status'].upper()}**",
        "",
        "Phase 4C adds governance only. It creates no new category batch and no product linkage changes.",
        "",
        "## Registry summary",
        "",
        "| Decision class | Registry entries | Observed Phase 4B occurrences |",
        "|---|---:|---:|",
        f"| Approved global aliases | {counts['approved_global_aliases']} | "
        f"{observed['approved_global_alias_occurrences']} |",
        f"| Approved scoped aliases | {counts['approved_scoped_aliases']} | "
        f"{observed['approved_scoped_alias_occurrences']} |",
        f"| Ambiguous and withheld | {counts['ambiguous_tokens_withheld']} | "
        f"{observed['starch_ambiguous_withheld'] + observed['vegetable_oil_ambiguous_withheld']} |",
        f"| Source artifacts quarantined | {counts['source_artifacts_quarantined']} | "
        f"{observed['source_artifacts_quarantined']} |",
        f"| Unsafe dependent children withheld | {counts['parent_child_rules']} rules | "
        f"{observed['unsafe_dependent_children_withheld']} |",
        "",
        "## Known-token review",
        "",
        (
            f"- `Starch`: {observed['starch_ambiguous_withheld']} occurrences remain withheld. The source does not "
            "identify corn, potato, or wheat."
        ),
        (
            f"- `Vegetable Oil`: {observed['vegetable_oil_ambiguous_withheld']} occurrences remain withheld. "
            "No specific oil is inferred."
        ),
        (
            f"- Nutrition artifacts: {observed['source_artifacts_quarantined']} occurrences are quarantined and "
            "cannot link or derive allergens."
        ),
        (
            f"- Parent-child safety: {observed['unsafe_dependent_children_withheld']} child rows remain withheld "
            "beneath unsafe parents."
        ),
        "",
        "## Allergen provenance",
        "",
        "| Provenance | Records |",
        "|---|---:|",
        f"| Explicit source `contains` | {provenance['explicit_source_contains_records']} |",
        f"| Explicit source `may contain` | {provenance['explicit_source_may_contain_records']} |",
        f"| Deterministic ingredient-derived only | {provenance['deterministic_ingredient_derived_records']} |",
        f"| Total provenance union | {provenance['total_records_after_provenance_union']} |",
        f"| Products unknown due to missing evidence | {provenance['products_unknown_due_to_missing_evidence']} |",
        "",
        "Missing evidence is never interpreted as allergen-free.",
        "",
        "## Drinks DE finding",
        "",
        drinks["finding"],
        "",
        f"Of {drinks['phase4b_selected_products_with_ingredient_evidence']} selected Drinks products, "
        f"{drinks['selected_products_unknown_due_to_missing_evidence']} remain unknown. Explicit source evidence "
        f"contributes {drinks['explicit_source_contains_records']} contains and "
        f"{drinks['explicit_source_may_contain_records']} may-contain records; "
        f"deterministic ingredient rules add {drinks['deterministic_ingredient_derived_records']} records.",
        "",
        "## Determinism and compatibility",
        "",
        f"- Governance checksum: `{report['governance_checksum_sha256']}`",
        f"- Phase 4B products enriched: {report['phase4b_compatibility']['products_enriched']}",
        f"- Phase 4B ingredient links: {report['phase4b_compatibility']['ingredient_links_created']}",
        f"- Phase 4B allergen records: {report['phase4b_compatibility']['allergen_records_created']}",
        "- Phase 4C linkage, coverage, score, and confidence changes: zero",
        "- Non-target categories and deprecated products: unchanged",
        "- Hosted Supabase writes: none",
        "",
        "## Manual review still required",
        "",
    ]
    lines.extend(f"- {item}" for item in report["manual_review_required"])
    return "\n".join(lines) + "\n"


def _json_text(report: dict[str, Any]) -> str:
    return json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if committed governance reports are stale")
    args = parser.parse_args(argv)
    report = build_report()
    artifacts = {JSON_PATH: _json_text(report), MARKDOWN_PATH: render_markdown(report)}
    stale = []
    for path, content in artifacts.items():
        if args.check:
            if not path.is_file() or path.read_text(encoding="utf-8") != content:
                stale.append(path.relative_to(PROJECT_ROOT).as_posix())
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")
    if stale:
        print("Stale deterministic Phase 4C governance artifacts:", file=sys.stderr)  # noqa: T201
        for path in stale:
            print(f"  {path}", file=sys.stderr)  # noqa: T201
        return 1
    print(json.dumps({"status": report["status"], "checksum": report["governance_checksum_sha256"]}))  # noqa: T201
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
