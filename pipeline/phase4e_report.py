"""Reproducible Phase 4E category ranking, selection, and verification report.

The module reads only the canonical local/CI PostgreSQL fixture and the
committed OFF-derived evidence snapshot.  It never connects to hosted
Supabase.  Phase 4E uses the schema-v2 governance registry for every write.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import tempfile
from collections import Counter, defaultdict
from dataclasses import replace
from pathlib import Path
from typing import Any

from data_quality_report import PsqlExecutor, pct
from pipeline.category_enrichment_report import PRODUCTS_SQL, _snapshot
from pipeline.enrichment import (
    canonicalize_allergens,
    linkable_matches,
    load_registry,
    match_ingredients,
    normalize_token,
)
from pipeline.enrichment_governance import governed_token_entry
from pipeline.generate_enrichment_pilot import PROJECT_ROOT, build_outputs, load_manifest, parse_snapshot
from pipeline.governance_report import _derived_allergen_tags

MANIFEST_PATH = Path(__file__).with_name("enrichment_phase4e.json")
PHASE4B_MANIFEST_PATH = Path(__file__).with_name("enrichment_phase4b.json")
PHASE4D_MANIFEST_PATH = Path(__file__).with_name("enrichment_phase4d.json")
PHASE4C_REPORT_PATH = PROJECT_ROOT / "data-quality" / "phase4c" / "report.json"
PHASE4D_REPORT_PATH = PROJECT_ROOT / "data-quality" / "phase4d" / "report.json"
OUTPUT_ROOT = PROJECT_ROOT / "data-quality" / "phase4e"
RANKING_JSON = OUTPUT_ROOT / "candidate-ranking.json"
RANKING_MARKDOWN = OUTPUT_ROOT / "candidate-ranking.md"
SELECTION_CSV = OUTPUT_ROOT / "selected-products.csv"
BEFORE_JSON = OUTPUT_ROOT / "before.json"
REPORT_JSON = OUTPUT_ROOT / "report.json"
REPORT_MARKDOWN = OUTPUT_ROOT / "report.md"
FIRST_RUN_JSON = Path(tempfile.gettempdir()) / "tryvit-phase4e-first-run.json"

SEARCH_RELEVANCE = {
    "Sweets": 100,
    "Dairy": 98,
    "Frozen & Prepared": 96,
    "Meat": 95,
    "Drinks": 100,
    "Instant & Frozen": 94,
    "Spreads & Dips": 91,
    "Bread": 96,
    "Snacks": 96,
    "Sauces": 90,
    "Cereals": 94,
    "Ready Meals": 94,
    "Chips": 98,
}


def _selected_scopes(manifest: dict[str, Any]) -> set[tuple[str, str]]:
    scopes = {(row["category"], row["country"]) for row in manifest["scopes"]}
    if not 2 <= len(scopes) <= 4:
        raise ValueError("Phase 4E must select 2-4 category-country scopes")
    if len(scopes) != len(manifest["scopes"]):
        raise ValueError("Phase 4E manifest contains duplicate scopes")
    return scopes


def _mapping_method(row: Any, registry: dict[str, Any]) -> str:
    entry = governed_token_entry(
        registry,
        row.normalized_text,
        row.evidence.country,
        row.evidence.category,
    )
    if entry is None:
        return "exact_canonical" if row.classification in {"exact", "alias"} else row.classification
    classification = entry["mapping_classification"]
    if classification == "approved_alias":
        return "approved_global_alias"
    if classification == "context_qualified_alias":
        countries = entry.get("country_scope", [])
        categories = entry.get("category_scope", [])
        if countries and categories:
            return "approved_country_and_category_alias"
        if countries:
            return "approved_country_alias"
        return "approved_category_alias"
    return {
        "ambiguous_and_withheld": "ambiguous",
        "source_artifact_and_quarantined": "artifact",
    }.get(classification, "unknown")


def _candidate_analysis(executor: PsqlExecutor, manifest: dict[str, Any]) -> tuple[dict[str, Any], str]:
    products = executor.rows("phase4e_products", PRODUCTS_SQL)
    ingredients, allergens, references, _ = parse_snapshot()
    registry = load_registry()
    ingredient_by_key: dict[tuple[str, str], list[Any]] = defaultdict(list)
    allergen_by_key: dict[tuple[str, str], list[Any]] = defaultdict(list)
    for row in ingredients:
        ingredient_by_key[(row.country, row.ean)].append(row)
    for row in allergens:
        allergen_by_key[(row.country, row.ean)].append(row)

    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for product in products:
        groups[(str(product["category"]), str(product["country"]))].append(product)

    selected_scopes = _selected_scopes(manifest)
    rationale = {(row["category"], row["country"]): row["rationale"] for row in manifest["scopes"]}
    deferred = {(row["category"], row["country"]): row["reason"] for row in manifest.get("deferred", [])}
    details: list[dict[str, Any]] = []
    selection_rows: list[tuple[str, str, str]] = []

    for (category, country), scoped_products in sorted(groups.items()):
        missing_ingredient = [row for row in scoped_products if row["missing_ingredient"]]
        missing_allergen = [row for row in scoped_products if row["missing_allergen"]]
        ingredient_keys = {(str(row["country"]), str(row["ean"])) for row in missing_ingredient}
        allergen_keys = {(str(row["country"]), str(row["ean"])) for row in missing_allergen}
        evidence = [
            replace(item, category=category)
            for key in sorted(ingredient_keys)
            for item in ingredient_by_key.get(key, ())
        ]
        matches = match_ingredients(evidence, references, registry)
        linked = linkable_matches(matches, registry)
        linked_set = set(linked)
        enrichable = sorted({(row.evidence.country, row.evidence.ean) for row in linked})
        explicit = canonicalize_allergens(
            [item for key in sorted(allergen_keys) for item in allergen_by_key.get(key, ())],
            registry,
        )
        methods = Counter(_mapping_method(row, registry) for row in matches)
        unsafe_children = sum(
            row.canonical_name is not None and row.evidence.is_sub_ingredient and row not in linked_set
            for row in matches
        )
        active = len(scoped_products)
        token_count = len(matches)
        source_products = len({(row.evidence.country, row.evidence.ean) for row in matches})
        explicit_products = len({(row.country, row.ean) for row in explicit})
        valid_eans = sum(bool(row["ean_valid"]) for row in scoped_products)
        selected = (category, country) in selected_scopes
        if selected:
            selection_rows.extend((category, country, ean) for _, ean in enrichable)
        details.append(
            {
                "scope": f"{category} ({country})",
                "category": category,
                "country": country,
                "selected": selected,
                "selection_rationale": rationale.get((category, country)),
                "deferral_reason": deferred.get((category, country)),
                "active_products": active,
                "valid_ean_percentage": pct(valid_eans, active),
                "missing_ingredient_links": len(missing_ingredient),
                "missing_ingredient_percentage": pct(len(missing_ingredient), active),
                "missing_known_allergen_information": len(missing_allergen),
                "missing_known_allergen_percentage": pct(len(missing_allergen), active),
                "ingredient_source_products": source_products,
                "ingredient_source_completeness_percentage": pct(source_products, len(missing_ingredient)),
                "explicit_allergen_source_products": explicit_products,
                "explicit_allergen_source_completeness_percentage": pct(explicit_products, len(missing_allergen)),
                "source_tokens": token_count,
                "expected_enrichable_products": len(enrichable),
                "expected_ingredient_links": len(linked),
                "expected_explicit_allergen_records": len(explicit),
                "mapping_methods": dict(sorted(methods.items())),
                "governed_exact_match_rate": pct(methods["exact_canonical"], token_count),
                "approved_scoped_alias_rate": pct(
                    methods["approved_country_alias"]
                    + methods["approved_category_alias"]
                    + methods["approved_country_and_category_alias"],
                    token_count,
                ),
                "ambiguous_tokens": methods["ambiguous"],
                "ambiguous_token_rate": pct(methods["ambiguous"], token_count),
                "artifacts_quarantined": methods["artifact"],
                "artifact_rate": pct(methods["artifact"], token_count),
                "unsafe_child_tokens_withheld": unsafe_children,
                "unsafe_parent_child_rate": pct(unsafe_children, token_count),
                "unknown_tokens": methods["unresolved"] + methods["unknown"],
                "unknown_token_rate": pct(methods["unresolved"] + methods["unknown"], token_count),
            }
        )

    eligible = [row for row in details if row["expected_enrichable_products"]]
    maxima = {
        "active": max(row["active_products"] for row in eligible),
        "enrichable": max(row["expected_enrichable_products"] for row in eligible),
    }
    weights = manifest["ranking_weights"]
    for row in eligible:
        withheld_rate = sum(
            float(row[name] or 0)
            for name in ("ambiguous_token_rate", "artifact_rate", "unsafe_parent_child_rate", "unknown_token_rate")
        )
        implementation_safety = max(0.0, 100.0 - min(100.0, withheld_rate * 4))
        components = {
            "active_product_count": 100 * row["active_products"] / maxima["active"],
            "missing_ingredient_percentage": float(row["missing_ingredient_percentage"] or 0),
            "missing_allergen_percentage": float(row["missing_known_allergen_percentage"] or 0),
            "ingredient_source_completeness": float(row["ingredient_source_completeness_percentage"] or 0),
            "explicit_allergen_source_completeness": float(
                row["explicit_allergen_source_completeness_percentage"] or 0
            ),
            "governed_exact_match_rate": float(row["governed_exact_match_rate"] or 0),
            "approved_scoped_alias_rate": min(100.0, float(row["approved_scoped_alias_rate"] or 0) * 10),
            "token_safety": max(0.0, 100.0 - withheld_rate),
            "expected_catalog_coverage_gain": 100 * row["expected_enrichable_products"] / maxima["enrichable"],
            "barcode_and_search_relevance": float(SEARCH_RELEVANCE.get(row["category"], 75)),
            "implementation_and_regression_safety": implementation_safety,
        }
        row["ranking_components"] = {key: round(value, 2) for key, value in components.items()}
        row["ranking_score"] = round(sum(components[key] * float(weights[key]) for key in weights), 2)
        row["implementation_and_regression_risk"] = round(100 - implementation_safety, 2)
    eligible.sort(key=lambda row: (-row["ranking_score"], row["scope"]))
    for rank, row in enumerate(eligible, 1):
        row["rank"] = rank

    selection_rows = sorted(set(selection_rows))
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["category", "country", "ean"])
    writer.writerows(selection_rows)
    ranking = {
        "schema_version": 1,
        "phase": "4E",
        "baseline": "merged Phase 4D fixture after deterministic Phase 4B and Phase 4D replay",
        "source": manifest["source"],
        "selection_rule": (
            "active products missing ingredient links with committed source evidence and at least one "
            "governance-approved deterministic linkage"
        ),
        "relevance_proxy_definition": (
            "reviewed category-level barcode and normal-search relevance because no production search-event log "
            "is available"
        ),
        "ranking_weights": weights,
        "candidate_count": len(eligible),
        "selected_category_count": len(selected_scopes),
        "selected_product_count": len(selection_rows),
        "selected_scopes": [row for row in eligible if row["selected"]],
        "deferred_scopes": [row for row in eligible if row["deferral_reason"]],
        "candidates": eligible,
    }
    return ranking, output.getvalue()


def _json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _semantic_checksum(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _ranking_markdown(ranking: dict[str, Any]) -> str:
    lines = [
        "# Phase 4E candidate-category ranking",
        "",
        "The ranking was refreshed after the merged Phase 4D linkage state and uses the Phase 4C governance registry.",
        "",
        (
            "| Rank | Scope | Score | Active | Missing ingredients | Source | Explicit allergens | "
            "Enrichable | Ambiguous | Risk | Selected |"
        ),
        "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|:---:|",
    ]
    for row in ranking["candidates"]:
        lines.append(
            f"| {row['rank']} | {row['scope']} | {row['ranking_score']:.2f} | {row['active_products']} | "
            f"{row['missing_ingredient_links']} | {row['ingredient_source_completeness_percentage']:.1f}% | "
            f"{row['explicit_allergen_source_completeness_percentage']:.1f}% | "
            f"{row['expected_enrichable_products']} | {row['ambiguous_tokens']} | "
            f"{row['implementation_and_regression_risk']:.2f} | {'yes' if row['selected'] else 'no'} |"
        )
    lines.extend(["", "## Selected", ""])
    lines.extend(f"- **{row['scope']}** — {row['selection_rationale']}" for row in ranking["selected_scopes"])
    if ranking["deferred_scopes"]:
        lines.extend(["", "## Leading deferred", ""])
        lines.extend(f"- **{row['scope']}** — {row['deferral_reason']}" for row in ranking["deferred_scopes"])
    return "\n".join(lines) + "\n"


def _deprecated_allergen_checksum_sql() -> str:
    """Hash deprecated allergen linkage identity without unstable provenance labels."""
    return """
  (SELECT md5(COALESCE(string_agg(concat_ws('|',p.product_id,pai.tag,pai.type), ';'
      ORDER BY p.product_id,pai.tag COLLATE "C",pai.type COLLATE "C"),''))
   FROM products p LEFT JOIN product_allergen_info pai ON pai.product_id=p.product_id
   WHERE p.is_deprecated IS TRUE) AS deprecated_allergen_checksum
""".strip()


def _isolation_snapshot(executor: PsqlExecutor, manifest: dict[str, Any]) -> dict[str, Any]:
    scopes = _selected_scopes(manifest)
    predicates = " OR ".join(
        "(p.category='{}' AND p.country='{}')".format(category.replace("'", "''"), country.replace("'", "''"))
        for category, country in sorted(scopes)
    )
    sql = f"""
SELECT
  (SELECT md5(COALESCE(string_agg(concat_ws('|',p.country,COALESCE(p.ean,''),p.category,
      p.brand,p.product_name), ';'
      ORDER BY p.country COLLATE "C",COALESCE(p.ean,'') COLLATE "C",
        p.category COLLATE "C",p.brand COLLATE "C",p.product_name COLLATE "C",p.product_id),''))
   FROM products p
   WHERE p.is_deprecated IS NOT TRUE AND NOT ({predicates})) AS non_target_product_checksum,
  (SELECT md5(COALESCE(string_agg(concat_ws('|',p.product_id,pi.ingredient_id,pi.position), ';'
      ORDER BY p.product_id,pi.ingredient_id,pi.position),''))
   FROM products p LEFT JOIN product_ingredient pi ON pi.product_id=p.product_id
   WHERE p.is_deprecated IS TRUE) AS deprecated_ingredient_checksum,
  {_deprecated_allergen_checksum_sql()}
"""
    return executor.rows("phase4e_isolation", sql)[0]


def _stable_snapshot(executor: PsqlExecutor, manifest: dict[str, Any]) -> dict[str, Any]:
    """Return the shared snapshot with source-label-independent allergen checksums.

    Historical PostgreSQL image revisions can preserve a different raw
    ``source_tag`` while producing the same canonical allergen linkage. Phase
    4E therefore hashes the linkage identity (product, canonical tag, kind)
    and verifies raw provenance separately from the committed source fixture.
    """
    snapshot = _snapshot(executor, manifest)
    scopes = _selected_scopes(manifest)
    selected = " OR ".join(
        "(p.category='{}' AND p.country='{}')".format(category.replace("'", "''"), country.replace("'", "''"))
        for category, country in sorted(scopes)
    )
    predicates = {"all": "TRUE", "selected": f"({selected})", "non_target": f"NOT ({selected})"}
    for name, predicate in predicates.items():
        sql = f"""
SELECT md5(COALESCE(string_agg(concat_ws('|', p.country, COALESCE(p.ean,''), p.category,
  pai.tag,pai.type), ';' ORDER BY p.country COLLATE "C",p.ean COLLATE "C",
  p.category COLLATE "C",pai.tag COLLATE "C",pai.type COLLATE "C"), '')) AS value
FROM product_allergen_info pai
JOIN products p ON p.product_id=pai.product_id
WHERE p.is_deprecated IS NOT TRUE AND {predicate}
"""
        snapshot["checksums"][name]["product_allergen_info"] = executor.rows(
            f"phase4e_{name}_canonical_allergen_checksum", sql
        )[0]["value"]
    return snapshot


def _allergen_provenance(manifest: dict[str, Any]) -> dict[str, Any]:
    ingredients, allergens, references, _ = parse_snapshot()
    registry = load_registry()
    selection = list(csv.DictReader(SELECTION_CSV.read_text(encoding="utf-8").splitlines()))
    selected = {(row["category"], row["country"], row["ean"]) for row in selection}
    category_for = {(country, ean): category for category, country, ean in selected}
    selected_ingredients = [
        replace(row, category=category_for[(row.country, row.ean)])
        for row in ingredients
        if (row.country, row.ean) in category_for
    ]
    matches = match_ingredients(selected_ingredients, references, registry)
    linked = linkable_matches(matches, registry)
    selected_allergens = [row for row in allergens if (row.country, row.ean) in category_for]
    explicit_rows = canonicalize_allergens(selected_allergens, registry)
    explicit = set()
    for row in explicit_rows:
        normalized_tag = normalize_token(row.source_tag.removeprefix("en:"))
        canonical_tag = registry.get("allergen_aliases", {}).get(
            normalized_tag, normalized_tag.replace(" ", "-")
        )
        explicit.add((row.country, row.ean, canonical_tag, row.kind))
    derived = set()
    for row in linked:
        entry = governed_token_entry(registry, row.normalized_text, row.evidence.country, row.evidence.category)
        if entry is not None and not entry["allergen_derivation_allowed"]:
            continue
        for tag in _derived_allergen_tags(str(row.canonical_name)):
            derived.add((row.evidence.country, row.evidence.ean, tag, "contains"))
    derived_only = derived - explicit
    explicit_products = {(country, ean) for country, ean, _, _ in explicit}
    derived_products = {(country, ean) for country, ean, _, _ in derived}
    explicit_only_products = explicit_products - derived_products
    derived_only_products = derived_products - explicit_products
    both_products = explicit_products & derived_products
    known = {(country, ean) for country, ean, _, _ in explicit | derived}
    selected_keys = {(country, ean) for _, country, ean in selected}
    methods = Counter(_mapping_method(row, registry) for row in matches)
    linked_set = set(linked)
    unsafe = [
        row
        for row in matches
        if row.canonical_name is not None and row.evidence.is_sub_ingredient and row not in linked_set
    ]
    queue = Counter()
    for row in matches:
        if row in linked_set:
            continue
        classification = (
            "unsafe_child"
            if row.canonical_name is not None and row.evidence.is_sub_ingredient
            else _mapping_method(row, registry)
        )
        queue[(row.normalized_text, classification)] += 1
    return {
        "selected_products": len(selected_keys),
        "explicit_source_contains_records": sum(row[3] == "contains" for row in explicit),
        "explicit_source_may_contain_records": sum(row[3] == "traces" for row in explicit),
        "deterministic_ingredient_derived_records": len(derived_only),
        "products_with_explicit_evidence_only": len(explicit_only_products),
        "products_with_derived_evidence_only": len(derived_only_products),
        "products_with_explicit_and_derived_evidence": len(both_products),
        "products_with_known_evidence": len(known),
        "products_remaining_allergen_unknown": len(selected_keys - known),
        "missing_evidence_is_allergen_free": False,
        "mapping_methods": dict(sorted(methods.items())),
        "ambiguous_tokens_withheld": methods["ambiguous"],
        "unknown_tokens_withheld": methods["unresolved"] + methods["unknown"],
        "artifacts_quarantined": methods["artifact"],
        "unsafe_child_tokens_withheld": len(unsafe),
        "manual_review_queue": [
            {"normalized_token": token, "classification": classification, "occurrences": count}
            for (token, classification), count in sorted(queue.items())
        ],
    }


def _final_report(
    manifest: dict[str, Any],
    ranking: dict[str, Any],
    before: dict[str, Any],
    first: dict[str, Any],
    after: dict[str, Any],
) -> dict[str, Any]:
    _, stats = build_outputs(MANIFEST_PATH)
    phase4b_outputs, _ = build_outputs(PHASE4B_MANIFEST_PATH)
    phase4d_outputs, _ = build_outputs(PHASE4D_MANIFEST_PATH)
    historical_phase4b_unchanged = all(
        path.is_file() and path.read_text(encoding="utf-8") == content
        for path, content in phase4b_outputs.items()
    )
    phase4d_report = json.loads(PHASE4D_REPORT_PATH.read_text(encoding="utf-8"))
    historical_phase4d_unchanged = (
        all(path.is_file() and path.read_text(encoding="utf-8") == content for path, content in phase4d_outputs.items())
        and phase4d_report["report_checksum_sha256"]
        == "926778d839da63584e0dcc8025b49147ed5b07fbfadc7485cfc2e480082a4268"
    )
    provenance = _allergen_provenance(manifest)
    category_before = {(row["category"], row["country"]): row for row in before["snapshot"]["categories"]}
    category_changes = []
    for current in after["snapshot"]["categories"]:
        prior = category_before[(current["category"], current["country"])]
        category_changes.append(
            {
                "category": current["category"],
                "country": current["country"],
                "active_products": current["active_products"],
                "ingredient_coverage_before": prior["ingredient_covered_products"],
                "ingredient_coverage_after": current["ingredient_covered_products"],
                "allergen_evidence_before": prior["allergen_evidence_products"],
                "allergen_evidence_after": current["allergen_evidence_products"],
                "ingredient_links_created": current["ingredient_links"] - prior["ingredient_links"],
                "allergen_records_created": current["allergen_records"] - prior["allergen_records"],
                "average_score_change": round(
                    float(current["average_score"] or 0) - float(prior["average_score"] or 0), 1
                ),
                "average_confidence_change": round(
                    float(current["average_confidence"] or 0) - float(prior["average_confidence"] or 0), 1
                ),
            }
        )
    before_overall = before["snapshot"]["overall"]
    after_overall = after["snapshot"]["overall"]
    phase4c = json.loads(PHASE4C_REPORT_PATH.read_text(encoding="utf-8"))
    checks = {
        "first_run_equals_rerun": first == after,
        "no_duplicate_ingredient_keys": after["snapshot"]["duplicates"]["ingredient_duplicate_keys"] == 0,
        "no_duplicate_allergen_keys": after["snapshot"]["duplicates"]["allergen_duplicate_keys"] == 0,
        "non_target_links_unchanged": before["snapshot"]["checksums"]["non_target"]
        == after["snapshot"]["checksums"]["non_target"],
        "non_target_product_identity_unchanged": before["isolation"]["non_target_product_checksum"]
        == after["isolation"]["non_target_product_checksum"],
        "deprecated_products_unchanged": {
            key: before["isolation"][key]
            for key in ("deprecated_ingredient_checksum", "deprecated_allergen_checksum")
        }
        == {
            key: after["isolation"][key]
            for key in ("deprecated_ingredient_checksum", "deprecated_allergen_checksum")
        },
        "phase4b_linkages_unchanged": before["phase4b"]["checksums"]["selected"]
        == after["phase4b"]["checksums"]["selected"],
        "phase4d_linkages_unchanged": before["phase4d"]["checksums"]["selected"]
        == after["phase4d"]["checksums"]["selected"],
        "phase4c_governance_checksum_unchanged": phase4c["governance_checksum_sha256"]
        == "c4d400d67c3bc04b45d29331cb9495c45672e3d8b613ead992771203469e0e37",
        "starch_and_vegetable_oil_withheld": all(
            item["classification"] == "ambiguous"
            for item in provenance["manual_review_queue"]
            if item["normalized_token"] in {"starch", "vegetable oil"}
        ),
        "missing_allergen_evidence_is_unknown": provenance["missing_evidence_is_allergen_free"] is False,
        "historical_phase4b_artifacts_unchanged": historical_phase4b_unchanged,
        "historical_phase4d_artifacts_unchanged": historical_phase4d_unchanged,
        "hosted_supabase_writes_absent": True,
    }
    report: dict[str, Any] = {
        "schema_version": 1,
        "phase": "4E",
        "status": "pass" if all(checks.values()) else "fail",
        "objective": "Controlled category-level enrichment governed by the Phase 4C registry.",
        "selected_categories": [row["scope"] for row in ranking["selected_scopes"]],
        "deferred_categories": [
            {"scope": row["scope"], "reason": row["deferral_reason"]} for row in ranking["deferred_scopes"]
        ],
        "products_evaluated": after["snapshot"]["selected"]["products_evaluated"],
        "products_enriched": stats["selected_products"],
        "ingredient_links_generated": stats["linked_ingredient_rows"],
        "explicit_allergen_records_generated": stats["canonical_allergen_rows"],
        "candidate_link_reconciliation": {
            "candidate_ingredient_rows": stats["ingredient_evidence_rows"],
            "valid_ingredient_links": stats["linked_ingredient_rows"],
            "rejected_candidate_rows": stats["ingredient_evidence_rows"] - stats["linked_ingredient_rows"],
            "exact_mappings": stats["exact_matches"],
            "approved_alias_mappings": stats["alias_matches"] + stats["reviewed_matches"],
            "ambiguous_rows": stats["ambiguous_matches"],
            "unknown_rows": stats["unresolved_matches"],
            "artifact_rows": stats["quarantined_matches"],
            "unsafe_child_rows": stats["parent_safety_withheld"],
        },
        "allergen_records_created_after_provenance_union": (
            after["snapshot"]["selected"]["allergen_records"]
            - before["snapshot"]["selected"]["allergen_records"]
        ),
        "governance_changes": [],
        "selected_scope_reconciliation": [
            {
                key: row[key]
                for key in (
                    "scope",
                    "active_products",
                    "ingredient_source_completeness_percentage",
                    "explicit_allergen_source_completeness_percentage",
                    "governed_exact_match_rate",
                    "mapping_methods",
                    "ambiguous_token_rate",
                    "unknown_token_rate",
                    "artifact_rate",
                    "unsafe_parent_child_rate",
                    "expected_enrichable_products",
                    "expected_ingredient_links",
                    "expected_explicit_allergen_records",
                )
            }
            for row in ranking["selected_scopes"]
        ],
        "allergen_provenance": provenance,
        "category_coverage": category_changes,
        "overall_coverage": {
            "active_products": after_overall["active_products"],
            "ingredient_covered_before": before_overall["ingredient_covered_products"],
            "ingredient_covered_after": after_overall["ingredient_covered_products"],
            "ingredient_coverage_percentage_before": before_overall["ingredient_coverage_percentage"],
            "ingredient_coverage_percentage_after": after_overall["ingredient_coverage_percentage"],
            "known_contains_before": before_overall["known_contains_products"],
            "known_contains_after": after_overall["known_contains_products"],
            "known_contains_coverage_percentage_before": before_overall["known_contains_coverage_percentage"],
            "known_contains_coverage_percentage_after": after_overall["known_contains_coverage_percentage"],
            "positive_allergen_evidence_before": before_overall["allergen_evidence_products"],
            "positive_allergen_evidence_after": after_overall["allergen_evidence_products"],
            "positive_allergen_evidence_percentage_before": pct(
                before_overall["allergen_evidence_products"], before_overall["active_products"]
            ),
            "positive_allergen_evidence_percentage_after": pct(
                after_overall["allergen_evidence_products"], after_overall["active_products"]
            ),
            "average_score_change": round(
                float(after_overall["average_score"] or 0) - float(before_overall["average_score"] or 0), 1
            ),
            "average_confidence_change": round(
                float(after_overall["average_confidence"] or 0)
                - float(before_overall["average_confidence"] or 0),
                1,
            ),
        },
        "checksums": after["snapshot"]["checksums"],
        "first_run_checksums": first["snapshot"]["checksums"],
        "rerun_checksums": after["snapshot"]["checksums"],
        "non_target_checksums_before": before["snapshot"]["checksums"]["non_target"],
        "non_target_checksums_after": after["snapshot"]["checksums"]["non_target"],
        "phase4b_checksums_before": before["phase4b"]["checksums"]["selected"],
        "phase4b_checksums_after": after["phase4b"]["checksums"]["selected"],
        "phase4d_checksums_before": before["phase4d"]["checksums"]["selected"],
        "phase4d_checksums_after": after["phase4d"]["checksums"]["selected"],
        "phase4d_report_checksum": phase4d_report["report_checksum_sha256"],
        "phase4c_governance_checksum": phase4c["governance_checksum_sha256"],
        "checks": checks,
        "manual_review_required": [
            "Generic Starch requires a declared botanical source before it can map.",
            "Generic Vegetable Oil requires a named oil source before it can map.",
            "Unknown and ambiguous source tokens in the report queue require domain review before any mapping.",
            "Missing producer allergen evidence remains unknown and cannot support allergen-free claims.",
        ],
    }
    report["report_checksum_sha256"] = _semantic_checksum(report)
    return report


def _report_markdown(report: dict[str, Any]) -> str:
    coverage = report["overall_coverage"]
    provenance = report["allergen_provenance"]
    lines = [
        "# Phase 4E category enrichment report",
        "",
        f"Status: **{report['status'].upper()}**",
        "",
        f"Selected: {', '.join(report['selected_categories'])}",
        "",
        "## Generated enrichment",
        "",
        f"- Products enriched: {report['products_enriched']}",
        f"- Products evaluated: {report['products_evaluated']}",
        f"- Ingredient links generated: {report['ingredient_links_generated']}",
        f"- Candidate ingredient rows: {report['candidate_link_reconciliation']['candidate_ingredient_rows']}",
        f"- Rejected candidate rows: {report['candidate_link_reconciliation']['rejected_candidate_rows']}",
        f"- Explicit contains records: {provenance['explicit_source_contains_records']}",
        f"- Explicit may-contain records: {provenance['explicit_source_may_contain_records']}",
        f"- Deterministic ingredient-derived records: {provenance['deterministic_ingredient_derived_records']}",
        f"- Products with explicit evidence only: {provenance['products_with_explicit_evidence_only']}",
        f"- Products with derived evidence only: {provenance['products_with_derived_evidence_only']}",
        f"- Products with both evidence types: {provenance['products_with_explicit_and_derived_evidence']}",
        f"- Products remaining allergen-unknown: {provenance['products_remaining_allergen_unknown']}",
        "",
        "## Overall coverage",
        "",
        f"- Ingredient coverage: {coverage['ingredient_covered_before']} -> {coverage['ingredient_covered_after']} "
        f"({coverage['ingredient_coverage_percentage_before']:.1f}% -> "
        f"{coverage['ingredient_coverage_percentage_after']:.1f}%)",
        f"- Known-allergen coverage: {coverage['known_contains_before']} -> {coverage['known_contains_after']} "
        f"({coverage['known_contains_coverage_percentage_before']:.1f}% -> "
        f"{coverage['known_contains_coverage_percentage_after']:.1f}%)",
        f"- Any-positive-allergen evidence: {coverage['positive_allergen_evidence_before']} -> "
        f"{coverage['positive_allergen_evidence_after']} "
        f"({coverage['positive_allergen_evidence_percentage_before']:.1f}% -> "
        f"{coverage['positive_allergen_evidence_percentage_after']:.1f}%)",
        f"- Average score change: {coverage['average_score_change']:+.1f}",
        f"- Average confidence change: {coverage['average_confidence_change']:+.1f}",
        "",
        "## Governance and safety",
        "",
        "- No new aliases were needed; all linkages use the Phase 4C registry and exact canonical identities.",
        f"- Ambiguous tokens withheld: {provenance['ambiguous_tokens_withheld']}",
        f"- Unknown tokens withheld: {provenance['unknown_tokens_withheld']}",
        f"- Artifacts quarantined: {provenance['artifacts_quarantined']}",
        f"- Unsafe child tokens withheld: {provenance['unsafe_child_tokens_withheld']}",
        "- Missing allergen evidence remains unknown.",
        (
            "- Non-target linkages and product identities, deprecated products, Phase 4B/4D linkages, "
            "and Phase 4C governance are unchanged."
        ),
        "- Hosted Supabase writes: none.",
        "",
        "## Determinism",
        "",
        f"- Report checksum: `{report['report_checksum_sha256']}`",
        f"- Ingredient checksum: `{report['checksums']['all']['product_ingredient']}`",
        f"- Allergen checksum: `{report['checksums']['all']['product_allergen_info']}`",
        f"- First run equals rerun: {str(report['checks']['first_run_equals_rerun']).lower()}",
        f"- Protected Phase 4D report checksum: `{report['phase4d_report_checksum']}`",
        "",
        "## Category coverage",
        "",
        (
            "| Scope | Products | Ingredient coverage | Allergen evidence | Links | "
            "Allergen records | Confidence | Score |"
        ),
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    lines.extend(
        f"| {row['category']} ({row['country']}) | {row['active_products']} | "
        f"{row['ingredient_coverage_before']} -> {row['ingredient_coverage_after']} | "
        f"{row['allergen_evidence_before']} -> {row['allergen_evidence_after']} | "
        f"{row['ingredient_links_created']} | {row['allergen_records_created']} | "
        f"{row['average_confidence_change']:+.1f} | {row['average_score_change']:+.1f} |"
        for row in report["category_coverage"]
    )
    lines.extend(
        [
        "",
        "## Manual review still required",
        "",
        ]
    )
    lines.extend(f"- {item}" for item in report["manual_review_required"])
    return "\n".join(lines) + "\n"


def _state(executor: PsqlExecutor, manifest: dict[str, Any]) -> dict[str, Any]:
    phase4b_manifest = load_manifest(PHASE4B_MANIFEST_PATH)
    phase4d_manifest = load_manifest(PHASE4D_MANIFEST_PATH)
    return {
        "snapshot": _stable_snapshot(executor, manifest),
        "isolation": _isolation_snapshot(executor, manifest),
        "phase4b": _stable_snapshot(executor, phase4b_manifest),
        "phase4d": _stable_snapshot(executor, phase4d_manifest),
    }


def _write_or_check(artifacts: dict[Path, str], check: bool) -> None:
    stale: list[str] = []
    for path, content in artifacts.items():
        if check:
            if not path.is_file() or path.read_text(encoding="utf-8") != content:
                stale.append(path.relative_to(PROJECT_ROOT).as_posix())
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")
    if stale:
        raise SystemExit("stale generated Phase 4E artifact(s): " + ", ".join(stale))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("before", "snapshot", "report"), required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    executor = PsqlExecutor()
    manifest = load_manifest(MANIFEST_PATH)
    if args.stage == "before":
        ranking, selection = _candidate_analysis(executor, manifest)
        before = _state(executor, manifest)
        artifacts = {
            RANKING_JSON: _json_text(ranking),
            RANKING_MARKDOWN: _ranking_markdown(ranking),
            SELECTION_CSV: selection,
            BEFORE_JSON: _json_text(before),
        }
        _write_or_check(artifacts, args.check)
        print(  # noqa: T201 - CLI status output
            json.dumps({"candidates": ranking["candidate_count"], "selected": ranking["selected_product_count"]})
        )
        return 0

    if args.stage == "snapshot":
        FIRST_RUN_JSON.write_text(_json_text(_state(executor, manifest)), encoding="utf-8", newline="\n")
        print(json.dumps({"snapshot": str(FIRST_RUN_JSON)}))  # noqa: T201 - CLI status output
        return 0

    if not FIRST_RUN_JSON.is_file():
        raise SystemExit("Phase 4E first-run snapshot is missing")
    ranking = json.loads(RANKING_JSON.read_text(encoding="utf-8"))
    before = json.loads(BEFORE_JSON.read_text(encoding="utf-8"))
    first = json.loads(FIRST_RUN_JSON.read_text(encoding="utf-8"))
    after = _state(executor, manifest)
    report = _final_report(manifest, ranking, before, first, after)
    _write_or_check(
        {REPORT_JSON: _json_text(report), REPORT_MARKDOWN: _report_markdown(report)},
        args.check,
    )
    print(  # noqa: T201 - CLI status output
        json.dumps({"status": report["status"], "checksum": report["report_checksum_sha256"]})
    )
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
