"""Reproducible category ranking and Phase 4B enrichment report.

The report reads the canonical local/CI PostgreSQL fixture through ``psql``
and the committed OFF-derived evidence snapshot.  It never connects to a
hosted Supabase project.  CI captures the Phase 4A state, applies Phase 4B,
captures the first result, reruns the generated SQL, and verifies that the
second result is byte-identical at the semantic linkage-table grain.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from data_quality_report import PsqlExecutor, pct
from pipeline.enrichment import canonicalize_allergens, linkable_matches, match_ingredients
from pipeline.generate_enrichment_pilot import PROJECT_ROOT, build_outputs, load_manifest, parse_snapshot

MANIFEST_PATH = Path(__file__).with_name("enrichment_phase4b.json")
OUTPUT_ROOT = PROJECT_ROOT / "data-quality" / "phase4b"
RANKING_JSON = OUTPUT_ROOT / "candidate-ranking.json"
RANKING_MARKDOWN = OUTPUT_ROOT / "candidate-ranking.md"
SELECTION_CSV = OUTPUT_ROOT / "selected-products.csv"
BEFORE_JSON = OUTPUT_ROOT / "before.json"
REPORT_JSON = OUTPUT_ROOT / "report.json"
REPORT_MARKDOWN = OUTPUT_ROOT / "report.md"

PRODUCTS_SQL = r"""
SELECT
  p.country,
  p.category,
  p.ean,
  public.is_valid_ean(p.ean) AS ean_valid,
  NOT EXISTS (
    SELECT 1 FROM public.product_ingredient pi WHERE pi.product_id = p.product_id
  ) AS missing_ingredient,
  NOT EXISTS (
    SELECT 1 FROM public.product_allergen_info pai WHERE pai.product_id = p.product_id
  ) AS missing_allergen
FROM public.products p
WHERE p.is_deprecated IS NOT TRUE
ORDER BY p.country, p.category, p.ean
"""


def _round(value: Any, digits: int = 1) -> float | None:
    return None if value is None else round(float(value), digits)


def _sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _scope_predicate(scopes: set[tuple[str, str]], prefix: str = "p") -> str:
    clauses = [
        f"({prefix}.category = {_sql_text(category)} AND {prefix}.country = {_sql_text(country)})"
        for category, country in sorted(scopes)
    ]
    if not clauses:
        raise ValueError("at least one selected scope is required")
    return "(" + " OR ".join(clauses) + ")"


def _selected_scopes(manifest: dict[str, Any]) -> set[tuple[str, str]]:
    scopes = {(row["category"], row["country"]) for row in manifest["scopes"]}
    if not 3 <= len({category for category, _ in scopes}) <= 5:
        raise ValueError("Phase 4B must select 3-5 distinct categories")
    if len(scopes) != len(manifest["scopes"]):
        raise ValueError("Phase 4B manifest contains duplicate scopes")
    return scopes


def _candidate_analysis(executor: PsqlExecutor, manifest: dict[str, Any]) -> tuple[dict[str, Any], str]:
    products = executor.rows("phase4b_products", PRODUCTS_SQL)
    snapshot_path = PROJECT_ROOT / manifest["source"]
    ingredients, allergens, references, _ = parse_snapshot(snapshot_path)
    ingredients_by_product: dict[tuple[str, str], list] = defaultdict(list)
    allergens_by_product: dict[tuple[str, str], list] = defaultdict(list)
    for row in ingredients:
        ingredients_by_product[(row.country, row.ean)].append(row)
    for row in allergens:
        allergens_by_product[(row.country, row.ean)].append(row)

    product_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for product in products:
        product_groups[(str(product["category"]), str(product["country"]))].append(product)

    selected_scopes = _selected_scopes(manifest)
    rationale = {(row["category"], row["country"]): row["rationale"] for row in manifest["scopes"]}
    details: list[dict[str, Any]] = []
    selection_rows: list[tuple[str, str, str]] = []
    for (category, country), scoped_products in sorted(product_groups.items()):
        missing_ingredient_products = [row for row in scoped_products if row["missing_ingredient"]]
        missing_allergen_products = [row for row in scoped_products if row["missing_allergen"]]
        missing_ingredient_keys = {(str(row["country"]), str(row["ean"])) for row in missing_ingredient_products}
        missing_allergen_keys = {(str(row["country"]), str(row["ean"])) for row in missing_allergen_products}
        source_rows = [
            ingredient for key in sorted(missing_ingredient_keys) for ingredient in ingredients_by_product.get(key, ())
        ]
        matches = match_ingredients(source_rows, references)
        linked = linkable_matches(matches)
        enrichable_products = sorted({(row.evidence.country, row.evidence.ean) for row in linked})
        canonical_allergens = canonicalize_allergens(
            [allergen for key in sorted(missing_allergen_keys) for allergen in allergens_by_product.get(key, ())]
        )
        allergen_products = {(row.country, row.ean) for row in canonical_allergens}
        classifications = Counter(row.classification for row in matches)
        active = len(scoped_products)
        source_products = len({(row.evidence.country, row.evidence.ean) for row in matches})
        valid_eans = sum(bool(row["ean_valid"]) for row in scoped_products)
        token_count = len(matches)
        ambiguous = classifications["ambiguous"]
        unresolved = classifications["unresolved"]
        quarantined = classifications["quarantined"]
        selected = (category, country) in selected_scopes
        if selected:
            selection_rows.extend((category, country, ean) for _, ean in enrichable_products)
        details.append(
            {
                "scope": f"{category} ({country})",
                "category": category,
                "country": country,
                "selected": selected,
                "selection_rationale": rationale.get((category, country)),
                "active_products": active,
                "valid_ean_percentage": pct(valid_eans, active),
                "missing_ingredient_links": len(missing_ingredient_products),
                "missing_ingredient_percentage": pct(len(missing_ingredient_products), active),
                "missing_known_allergen_information": len(missing_allergen_products),
                "missing_known_allergen_percentage": pct(len(missing_allergen_products), active),
                "ingredient_source_products": source_products,
                "ingredient_source_completeness_percentage": pct(source_products, len(missing_ingredient_products)),
                "source_tokens": token_count,
                "ambiguous_tokens": ambiguous,
                "unmatched_tokens": unresolved,
                "quarantined_tokens": quarantined,
                "withheld_token_percentage": pct(ambiguous + unresolved + quarantined, token_count),
                "token_ambiguity_percentage": pct(ambiguous, token_count),
                "expected_enrichable_products": len(enrichable_products),
                "expected_ingredient_links": len(linked),
                "expected_allergen_evidence_products": len(allergen_products),
                "expected_allergen_records": len(canonical_allergens),
                "mapping_methods": {
                    "exact": classifications["exact"],
                    "alias": classifications["alias"],
                    "reviewed": classifications["reviewed"],
                    "ambiguous": ambiguous,
                    "unresolved": unresolved,
                    "quarantined": quarantined,
                },
            }
        )

    eligible = [row for row in details if row["expected_enrichable_products"]]
    maxima = {
        "active": max(row["active_products"] for row in eligible),
        "enrichable": max(row["expected_enrichable_products"] for row in eligible),
        "allergen": max(row["expected_allergen_evidence_products"] for row in eligible),
    }
    weights = manifest["ranking_weights"]
    for row in eligible:
        relevance = 100 * (
            0.7 * row["active_products"] / maxima["active"] + 0.3 * float(row["valid_ean_percentage"] or 0) / 100
        )
        token_safety = 100 - float(row["withheld_token_percentage"] or 0)
        components = {
            "active_product_count": 100 * row["active_products"] / maxima["active"],
            "missing_ingredient_percentage": float(row["missing_ingredient_percentage"] or 0),
            "missing_allergen_percentage": float(row["missing_known_allergen_percentage"] or 0),
            "ingredient_source_completeness": float(row["ingredient_source_completeness_percentage"] or 0),
            "token_safety": token_safety,
            "expected_ingredient_coverage_gain": (100 * row["expected_enrichable_products"] / maxima["enrichable"]),
            "expected_allergen_evidence_gain": (100 * row["expected_allergen_evidence_products"] / maxima["allergen"]),
            "barcode_and_search_relevance_proxy": relevance,
        }
        row["ranking_components"] = {key: round(value, 2) for key, value in components.items()}
        row["ranking_score"] = round(sum(components[key] * float(weights[key]) for key in weights), 2)
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
        "phase": "4B",
        "source": manifest["source"],
        "selection_rule": (
            "active products missing ingredient links with committed source evidence and at least "
            "one deterministic linkable token"
        ),
        "relevance_proxy_definition": (
            "70% active-product volume and 30% valid-EAN coverage; no product-search event log is available"
        ),
        "ranking_weights": weights,
        "candidate_count": len(eligible),
        "selected_category_count": len(selected_scopes),
        "selected_product_count": len(selection_rows),
        "selected_scopes": [row for row in eligible if row["selected"]],
        "candidates": eligible,
    }
    return ranking, output.getvalue()


def _snapshot(executor: PsqlExecutor, manifest: dict[str, Any]) -> dict[str, Any]:
    scopes = _selected_scopes(manifest)
    selected = _scope_predicate(scopes)
    summary_sql = """
SELECT
  COUNT(*) FILTER (WHERE p.is_deprecated IS NOT TRUE)::integer AS active_products,
  COUNT(*) FILTER (WHERE p.is_deprecated IS NOT TRUE AND EXISTS (
    SELECT 1 FROM product_ingredient pi WHERE pi.product_id = p.product_id
  ))::integer AS ingredient_covered_products,
  COUNT(*) FILTER (WHERE p.is_deprecated IS NOT TRUE AND EXISTS (
    SELECT 1 FROM product_allergen_info pai WHERE pai.product_id = p.product_id AND pai.type = 'contains'
  ))::integer AS known_contains_products,
  COUNT(*) FILTER (WHERE p.is_deprecated IS NOT TRUE AND EXISTS (
    SELECT 1 FROM product_allergen_info pai WHERE pai.product_id = p.product_id
  ))::integer AS allergen_evidence_products,
  (SELECT COUNT(*) FROM product_ingredient)::integer AS ingredient_links,
  (SELECT COUNT(*) FROM product_allergen_info)::integer AS allergen_records,
  ROUND(AVG(p.unhealthiness_score) FILTER (WHERE p.is_deprecated IS NOT TRUE), 1) AS average_score,
  ROUND(AVG(c.total_confidence) FILTER (WHERE p.is_deprecated IS NOT TRUE), 1) AS average_confidence
FROM products p
LEFT JOIN v_product_confidence c ON c.product_id = p.product_id
"""
    category_sql = f"""
SELECT
  p.category,
  p.country,
  COUNT(*)::integer AS active_products,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM product_ingredient pi WHERE pi.product_id = p.product_id
  ))::integer AS ingredient_covered_products,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM product_allergen_info pai WHERE pai.product_id = p.product_id AND pai.type = 'contains'
  ))::integer AS known_contains_products,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM product_allergen_info pai WHERE pai.product_id = p.product_id
  ))::integer AS allergen_evidence_products,
  (SELECT COUNT(*) FROM product_ingredient pi WHERE pi.product_id IN (
    SELECT px.product_id FROM products px
    WHERE px.is_deprecated IS NOT TRUE AND px.category = p.category AND px.country = p.country
  ))::integer AS ingredient_links,
  (SELECT COUNT(*) FROM product_allergen_info pai WHERE pai.product_id IN (
    SELECT px.product_id FROM products px
    WHERE px.is_deprecated IS NOT TRUE AND px.category = p.category AND px.country = p.country
  ))::integer AS allergen_records,
  ROUND(AVG(p.unhealthiness_score), 1) AS average_score,
  ROUND(AVG(c.total_confidence), 1) AS average_confidence
FROM products p
LEFT JOIN v_product_confidence c ON c.product_id = p.product_id
WHERE p.is_deprecated IS NOT TRUE AND {selected}
GROUP BY p.category, p.country
ORDER BY p.category, p.country
"""
    selected_summary_sql = f"""
SELECT
  COUNT(*) FILTER (WHERE p.is_deprecated IS NOT TRUE)::integer AS products_evaluated,
  COUNT(*) FILTER (WHERE p.is_deprecated IS NOT TRUE AND EXISTS (
    SELECT 1 FROM product_ingredient pi WHERE pi.product_id = p.product_id
  ))::integer AS ingredient_covered_products,
  COUNT(*) FILTER (WHERE p.is_deprecated IS NOT TRUE AND EXISTS (
    SELECT 1 FROM product_allergen_info pai WHERE pai.product_id = p.product_id
  ))::integer AS allergen_evidence_products,
  (SELECT COUNT(*) FROM product_ingredient pi JOIN products px ON px.product_id=pi.product_id
    WHERE px.is_deprecated IS NOT TRUE AND {selected.replace("p.", "px.")})::integer AS ingredient_links,
  (SELECT COUNT(*) FROM product_allergen_info pai JOIN products px ON px.product_id=pai.product_id
    WHERE px.is_deprecated IS NOT TRUE AND {selected.replace("p.", "px.")})::integer AS allergen_records,
  (SELECT COUNT(*) FROM product_ingredient pi JOIN products px ON px.product_id=pi.product_id
    WHERE px.is_deprecated IS TRUE AND {selected.replace("p.", "px.")})::integer AS deprecated_ingredient_links,
  (SELECT COUNT(*) FROM product_allergen_info pai JOIN products px ON px.product_id=pai.product_id
    WHERE px.is_deprecated IS TRUE AND {selected.replace("p.", "px.")})::integer AS deprecated_allergen_records
FROM products p
WHERE {selected}
"""

    # Separate linkage queries avoid a cross-product between ingredient and allergen rows.
    def checksum(table: str, predicate: str) -> str:
        if table == "ingredient":
            sql = f"""
SELECT md5(COALESCE(string_agg(concat_ws('|', p.country, COALESCE(p.ean,''), p.category,
  i.name_en, pi.position, COALESCE(pi.percent::text,''), COALESCE(pi.percent_estimate::text,''),
  pi.is_sub_ingredient, COALESCE(parent_i.name_en,'')), ';'
  ORDER BY p.country,p.ean,p.category,i.name_en,pi.position), '')) AS value
FROM product_ingredient pi
JOIN products p ON p.product_id=pi.product_id
JOIN ingredient_ref i ON i.ingredient_id=pi.ingredient_id
LEFT JOIN ingredient_ref parent_i ON parent_i.ingredient_id=pi.parent_ingredient_id
WHERE p.is_deprecated IS NOT TRUE AND {predicate}
"""
        else:
            sql = f"""
SELECT md5(COALESCE(string_agg(concat_ws('|', p.country, COALESCE(p.ean,''), p.category,
  pai.tag,pai.type,COALESCE(pai.source_tag,'')), ';'
  ORDER BY p.country,p.ean,p.category,pai.tag,pai.type), '')) AS value
FROM product_allergen_info pai
JOIN products p ON p.product_id=pai.product_id
WHERE p.is_deprecated IS NOT TRUE AND {predicate}
"""
        return str(executor.rows(f"{table}_checksum", sql)[0]["value"])

    duplicate_sql = r"""
SELECT
  (SELECT COUNT(*) FROM (
    SELECT product_id, ingredient_id, position FROM product_ingredient
    GROUP BY 1,2,3 HAVING COUNT(*) > 1
  ) d)::integer AS ingredient_duplicate_keys,
  (SELECT COUNT(*) FROM (
    SELECT product_id, tag, type FROM product_allergen_info
    GROUP BY 1,2,3 HAVING COUNT(*) > 1
  ) d)::integer AS allergen_duplicate_keys
"""
    summary = executor.rows("phase4b_summary", summary_sql)[0]
    selected_summary = executor.rows("phase4b_selected_summary", selected_summary_sql)[0]
    categories = executor.rows("phase4b_categories", category_sql)
    duplicates = executor.rows("phase4b_duplicates", duplicate_sql)[0]
    all_predicate = "TRUE"
    non_target_predicate = f"NOT {selected}"
    target_predicate = selected
    return {
        "schema_version": 1,
        "overall": {
            **summary,
            "ingredient_coverage_percentage": pct(
                int(summary["ingredient_covered_products"]), int(summary["active_products"])
            ),
            "known_contains_coverage_percentage": pct(
                int(summary["known_contains_products"]), int(summary["active_products"])
            ),
        },
        "selected": selected_summary,
        "categories": categories,
        "duplicates": duplicates,
        "checksums": {
            "all": {
                "product_ingredient": checksum("ingredient", all_predicate),
                "product_allergen_info": checksum("allergen", all_predicate),
            },
            "selected": {
                "product_ingredient": checksum("ingredient", target_predicate),
                "product_allergen_info": checksum("allergen", target_predicate),
            },
            "non_target": {
                "product_ingredient": checksum("ingredient", non_target_predicate),
                "product_allergen_info": checksum("allergen", non_target_predicate),
            },
        },
    }


def _ranking_markdown(ranking: dict[str, Any]) -> str:
    lines = [
        "# Phase 4B candidate-category ranking",
        "",
        (
            "This ranking uses the merged Phase 4A fixture. Search relevance is an explicit proxy "
            "because no product-search event log is available."
        ),
        "",
        (
            "| Rank | Scope | Score | Active | Missing ingredients | Missing allergens | Source complete | "
            "Ambiguity | Expected products | Expected allergen evidence | Selected |"
        ),
        "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|:---:|",
    ]
    for row in ranking["candidates"][:20]:
        lines.append(
            f"| {row['rank']} | {row['scope']} | {row['ranking_score']:.2f} | "
            f"{row['active_products']} | {row['missing_ingredient_links']} "
            f"({row['missing_ingredient_percentage']:.1f}%) | "
            f"{row['missing_known_allergen_information']} "
            f"({row['missing_known_allergen_percentage']:.1f}%) | "
            f"{row['ingredient_source_completeness_percentage']:.1f}% | "
            f"{row['token_ambiguity_percentage']:.2f}% | "
            f"{row['expected_enrichable_products']} | "
            f"{row['expected_allergen_evidence_products']} | "
            f"{'yes' if row['selected'] else 'no'} |"
        )
    lines.extend(["", "## Selected categories", ""])
    for row in ranking["selected_scopes"]:
        lines.append(f"- **{row['scope']}** — {row['selection_rationale']}")
    lines.extend(
        [
            "",
            (
                "The selection is limited to four distinct existing categories in DE. It does not add a "
                "country or perform a catalog-wide backfill."
            ),
            "",
        ]
    )
    return "\n".join(lines)


def _final_report(
    manifest_path: Path,
    manifest: dict[str, Any],
    before: dict[str, Any],
    first: dict[str, Any],
    after: dict[str, Any],
) -> dict[str, Any]:
    _, source_stats = build_outputs(manifest_path)
    selection_path = PROJECT_ROOT / manifest["selection_file"]
    selected_rows = list(csv.DictReader(selection_path.read_text(encoding="utf-8").splitlines()))
    before_categories = {(row["category"], row["country"]): row for row in before["categories"]}
    category_changes = []
    for current in after["categories"]:
        prior = before_categories[(current["category"], current["country"])]
        category_changes.append(
            {
                "category": current["category"],
                "country": current["country"],
                "active_products": int(current["active_products"]),
                "ingredient_coverage": {
                    "before_count": int(prior["ingredient_covered_products"]),
                    "before_percentage": pct(int(prior["ingredient_covered_products"]), int(prior["active_products"])),
                    "after_count": int(current["ingredient_covered_products"]),
                    "after_percentage": pct(
                        int(current["ingredient_covered_products"]), int(current["active_products"])
                    ),
                },
                "allergen_evidence": {
                    "before_count": int(prior["allergen_evidence_products"]),
                    "before_percentage": pct(int(prior["allergen_evidence_products"]), int(prior["active_products"])),
                    "after_count": int(current["allergen_evidence_products"]),
                    "after_percentage": pct(
                        int(current["allergen_evidence_products"]), int(current["active_products"])
                    ),
                },
                "average_score": {
                    "before": _round(prior["average_score"]),
                    "after": _round(current["average_score"]),
                    "delta": _round(float(current["average_score"]) - float(prior["average_score"])),
                },
                "average_confidence": {
                    "before": _round(prior["average_confidence"]),
                    "after": _round(current["average_confidence"]),
                    "delta": _round(float(current["average_confidence"]) - float(prior["average_confidence"])),
                },
            }
        )
    ingredient_links_created = int(after["selected"]["ingredient_links"]) - int(before["selected"]["ingredient_links"])
    allergen_records_created = int(after["selected"]["allergen_records"]) - int(before["selected"]["allergen_records"])
    products_enriched = int(after["selected"]["ingredient_covered_products"]) - int(
        before["selected"]["ingredient_covered_products"]
    )
    idempotent = first["checksums"] == after["checksums"]
    non_target_unchanged = before["checksums"]["non_target"] == after["checksums"]["non_target"]
    duplicate_free = all(int(value) == 0 for value in after["duplicates"].values())
    deprecated_unchanged = (
        before["selected"]["deprecated_ingredient_links"] == after["selected"]["deprecated_ingredient_links"]
        and before["selected"]["deprecated_allergen_records"] == after["selected"]["deprecated_allergen_records"]
    )
    classification_reconciles = (
        source_stats["linked_ingredient_rows"]
        + source_stats["ambiguous_matches"]
        + source_stats["unresolved_matches"]
        + source_stats["quarantined_matches"]
        + source_stats["parent_safety_withheld"]
        == source_stats["ingredient_evidence_rows"]
    )
    checks = {
        "idempotent_rerun": idempotent,
        "non_target_categories_unchanged": non_target_unchanged,
        "duplicate_keys_absent": duplicate_free,
        "deprecated_products_unchanged": deprecated_unchanged,
        "all_selected_products_enriched": products_enriched == len(selected_rows),
        "generated_ingredient_links_reconcile": (ingredient_links_created == source_stats["linked_ingredient_rows"]),
        "withheld_classifications_not_linked": classification_reconciles,
    }
    before_overall = before["overall"]
    after_overall = after["overall"]
    return {
        "schema_version": 1,
        "phase": "4B",
        "status": "pass" if all(checks.values()) else "fail",
        "source": manifest["source"],
        "selected_categories": manifest["scopes"],
        "products_evaluated": int(after["selected"]["products_evaluated"]),
        "products_selected": len(selected_rows),
        "products_enriched": products_enriched,
        "ingredient_links_created": ingredient_links_created,
        "allergen_records_created": allergen_records_created,
        "explicit_allergen_records_emitted": source_stats["canonical_allergen_rows"],
        "source_evidence": source_stats,
        "mapping_methods": {
            "exact": source_stats["exact_matches"],
            "alias": source_stats["alias_matches"],
            "reviewed": source_stats["reviewed_matches"],
            "ambiguous_withheld": source_stats["ambiguous_matches"],
            "unmatched_withheld": source_stats["unresolved_matches"],
            "quarantined_withheld": source_stats["quarantined_matches"],
            "parent_safety_withheld": source_stats["parent_safety_withheld"],
        },
        "category_coverage": category_changes,
        "overall_coverage": {
            "active_products": int(after_overall["active_products"]),
            "ingredients": {
                "before_count": int(before_overall["ingredient_covered_products"]),
                "before_percentage": before_overall["ingredient_coverage_percentage"],
                "after_count": int(after_overall["ingredient_covered_products"]),
                "after_percentage": after_overall["ingredient_coverage_percentage"],
            },
            "known_contains": {
                "before_count": int(before_overall["known_contains_products"]),
                "before_percentage": before_overall["known_contains_coverage_percentage"],
                "after_count": int(after_overall["known_contains_products"]),
                "after_percentage": after_overall["known_contains_coverage_percentage"],
            },
            "average_score": {
                "before": _round(before_overall["average_score"]),
                "after": _round(after_overall["average_score"]),
                "delta": _round(float(after_overall["average_score"]) - float(before_overall["average_score"])),
            },
            "average_confidence": {
                "before": _round(before_overall["average_confidence"]),
                "after": _round(after_overall["average_confidence"]),
                "delta": _round(
                    float(after_overall["average_confidence"]) - float(before_overall["average_confidence"])
                ),
            },
        },
        "checksums": {
            "first_run": first["checksums"],
            "rerun": after["checksums"],
        },
        "checks": checks,
        "limitations": [
            "Missing allergen evidence remains unknown and is never interpreted as allergen-free.",
            "Allergen rows come only from explicit source tags or tested deterministic ingredient rules.",
            "Search relevance is a product-volume/EAN proxy because no search-event dataset is available.",
            "No fuzzy or semantic mapping writes a linkage; ambiguous and unmatched tokens are quarantined.",
        ],
    }


def _report_markdown(report: dict[str, Any]) -> str:
    overall = report["overall_coverage"]
    methods = report["mapping_methods"]
    lines = [
        "# Phase 4B category enrichment report",
        "",
        f"**Status: {report['status'].upper()}**",
        "",
        f"Four controlled categories evaluated {report['products_evaluated']} active products. "
        f"{report['products_selected']} evidence-backed products were selected and "
        f"{report['products_enriched']} gained ingredient coverage.",
        "",
        "## Generated data",
        "",
        f"- Ingredient links created: **{report['ingredient_links_created']}**",
        f"- Explicit source allergen records emitted: **{report['explicit_allergen_records_emitted']}**",
        (
            "- Total allergen records created after explicit evidence and the existing deterministic "
            f"ingredient-to-allergen pass: **{report['allergen_records_created']}**"
        ),
        f"- Ambiguous tokens withheld: **{methods['ambiguous_withheld']}**",
        f"- Unmatched tokens withheld: **{methods['unmatched_withheld']}**",
        f"- Known source artifacts quarantined: **{methods['quarantined_withheld']}**",
        f"- Child tokens withheld because their parent was unsafe: **{methods['parent_safety_withheld']}**",
        f"- Mapping methods: {methods['exact']} exact, {methods['alias']} normalized/reviewed alias, "
        f"{methods['reviewed']} explicitly reviewed",
        "",
        "Missing evidence remains unknown; no allergen-free claim is produced.",
        "",
        "## Coverage by selected category",
        "",
        (
            "| Category | Products | Ingredients before | Ingredients after | Allergen evidence before | "
            "Allergen evidence after | Confidence delta | Score delta |"
        ),
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for row in report["category_coverage"]:
        ingredient = row["ingredient_coverage"]
        allergen = row["allergen_evidence"]
        lines.append(
            f"| {row['category']} ({row['country']}) | {row['active_products']} | "
            f"{ingredient['before_count']} ({ingredient['before_percentage']:.1f}%) | "
            f"{ingredient['after_count']} ({ingredient['after_percentage']:.1f}%) | "
            f"{allergen['before_count']} ({allergen['before_percentage']:.1f}%) | "
            f"{allergen['after_count']} ({allergen['after_percentage']:.1f}%) | "
            f"{row['average_confidence']['delta']:+.1f} | {row['average_score']['delta']:+.1f} |"
        )
    lines.extend(
        [
            "",
            "## Overall coverage",
            "",
            "| Metric | Before | After |",
            "|---|---:|---:|",
            f"| Ingredient-covered products | {overall['ingredients']['before_count']} "
            f"({overall['ingredients']['before_percentage']:.1f}%) | "
            f"{overall['ingredients']['after_count']} ({overall['ingredients']['after_percentage']:.1f}%) |",
            f"| Known contains evidence | {overall['known_contains']['before_count']} "
            f"({overall['known_contains']['before_percentage']:.1f}%) | "
            f"{overall['known_contains']['after_count']} ({overall['known_contains']['after_percentage']:.1f}%) |",
            f"| Average confidence | {overall['average_confidence']['before']:.1f} | "
            f"{overall['average_confidence']['after']:.1f} |",
            f"| Average score | {overall['average_score']['before']:.1f} | {overall['average_score']['after']:.1f} |",
            "",
            "## Determinism and isolation",
            "",
        ]
    )
    for name, passed in report["checks"].items():
        lines.append(f"- {'PASS' if passed else 'FAIL'} — {name.replace('_', ' ')}")
    lines.extend(["", "The first-run and rerun semantic linkage checksums are recorded in the JSON report.", ""])
    return "\n".join(lines)


def _json_text(payload: dict[str, Any]) -> str:
    return json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def _deliver(path: Path, content: str, check: bool) -> None:
    if check:
        if not path.is_file() or path.read_text(encoding="utf-8") != content:
            raise SystemExit(f"stale generated Phase 4B artifact: {path.relative_to(PROJECT_ROOT)}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("before", "snapshot", "report"), required=True)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--json-out", type=Path)
    parser.add_argument("--markdown-out", type=Path)
    parser.add_argument("--selection-out", type=Path)
    parser.add_argument("--before", type=Path, default=BEFORE_JSON)
    parser.add_argument("--first-run", type=Path)
    args = parser.parse_args(argv)
    manifest_path = args.manifest if args.manifest.is_absolute() else PROJECT_ROOT / args.manifest
    manifest = load_manifest(manifest_path)
    executor = PsqlExecutor()
    if args.stage == "before":
        ranking, selection = _candidate_analysis(executor, manifest)
        before = _snapshot(executor, manifest)
        _deliver(args.json_out or RANKING_JSON, _json_text(ranking), args.check)
        _deliver(args.markdown_out or RANKING_MARKDOWN, _ranking_markdown(ranking), args.check)
        _deliver(args.selection_out or SELECTION_CSV, selection, args.check)
        _deliver(BEFORE_JSON, _json_text(before), args.check)
        print(  # noqa: T201
            json.dumps(
                {
                    "status": "pass",
                    "candidate_count": ranking["candidate_count"],
                    "selected_products": ranking["selected_product_count"],
                },
                sort_keys=True,
            )
        )
        return 0
    if args.stage == "snapshot":
        if args.json_out is None:
            parser.error("--json-out is required for snapshot stage")
        _deliver(args.json_out, _json_text(_snapshot(executor, manifest)), args.check)
        return 0
    if args.first_run is None:
        parser.error("--first-run is required for report stage")
    before_path = args.before if args.before.is_absolute() else PROJECT_ROOT / args.before
    first_path = args.first_run if args.first_run.is_absolute() else PROJECT_ROOT / args.first_run
    before = json.loads(before_path.read_text(encoding="utf-8"))
    first = json.loads(first_path.read_text(encoding="utf-8"))
    report = _final_report(manifest_path, manifest, before, first, _snapshot(executor, manifest))
    _deliver(args.json_out or REPORT_JSON, _json_text(report), args.check)
    _deliver(args.markdown_out or REPORT_MARKDOWN, _report_markdown(report), args.check)
    print(json.dumps({"status": report["status"], "checks": report["checks"]}, sort_keys=True))  # noqa: T201
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
