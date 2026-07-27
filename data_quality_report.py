#!/usr/bin/env python3
"""Generate TryVit's canonical PostgreSQL data-quality report and CI gate.

The report is intentionally read-only. It measures the same deterministic
PostgreSQL fixture used by ``.github/workflows/qa.yml`` and never connects to
the hosted Supabase project unless an operator deliberately supplies those
PostgreSQL connection variables.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from statistics import median
from typing import Any, Protocol

REPORT_SCHEMA_VERSION = 1
BASELINE_SCHEMA_VERSION = 1
SAMPLE_LIMIT = 10
REQUIRED_OBJECTS = {
    "ingredient_ref": "table",
    "is_valid_ean": "function",
    "mv_scoring_distribution": "materialized_view",
    "nutrition_facts": "table",
    "product_allergen_info": "table",
    "product_ingredient": "table",
    "products": "table",
    "v_data_coverage_summary": "materialized_view",
    "v_product_confidence": "materialized_view",
}
CORE_NUTRITION_FIELDS = (
    "calories",
    "total_fat_g",
    "saturated_fat_g",
    "carbs_g",
    "sugars_g",
    "protein_g",
    "salt_g",
)
CONFIDENCE_COMPONENTS = (
    "nutrition_pts",
    "ingredient_pts",
    "source_pts",
    "ean_pts",
    "allergen_pts",
)
SAFE_IDENTIFIER = re.compile(r"^[A-Za-z0-9_.:-]{1,100}$")


OBJECTS_SQL = r"""
WITH required(name, kind) AS (
  VALUES
    ('products', 'table'),
    ('product_ingredient', 'table'),
    ('ingredient_ref', 'table'),
    ('product_allergen_info', 'table'),
    ('nutrition_facts', 'table'),
    ('v_data_coverage_summary', 'materialized_view'),
    ('v_product_confidence', 'materialized_view'),
    ('mv_scoring_distribution', 'materialized_view'),
    ('is_valid_ean', 'function')
)
SELECT r.name, r.kind,
       CASE
         WHEN r.kind = 'function' THEN EXISTS (
           SELECT 1
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = r.name
         )
         WHEN r.kind = 'materialized_view' THEN EXISTS (
           SELECT 1
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = r.name AND c.relkind = 'm'
         )
         ELSE EXISTS (
           SELECT 1
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = r.name AND c.relkind IN ('r', 'p')
         )
       END AS exists
FROM required r
ORDER BY r.name
"""

DATASET_SQL = r"""
SELECT
  COUNT(*) FILTER (WHERE is_deprecated IS NOT TRUE)::integer AS active_products,
  COUNT(*) FILTER (WHERE is_deprecated IS TRUE)::integer AS deprecated_products,
  COUNT(*)::integer AS total_products,
  COUNT(DISTINCT country) FILTER (WHERE is_deprecated IS NOT TRUE)::integer AS countries,
  COUNT(DISTINCT category) FILTER (WHERE is_deprecated IS NOT TRUE)::integer AS categories
FROM public.products
"""

EXPECTED_SEGMENTS_SQL = r"""
SELECT 'country' AS scope, country_code AS segment,
       (SELECT COUNT(*) FROM public.products p
        WHERE p.is_deprecated IS NOT TRUE AND p.country = c.country_code)::integer AS active_products
FROM public.country_ref c
WHERE c.is_active
UNION ALL
SELECT 'category', category,
       (SELECT COUNT(*) FROM public.products p
        WHERE p.is_deprecated IS NOT TRUE AND p.category = c.category)::integer
FROM public.category_ref c
WHERE c.is_active
ORDER BY 1, 2
"""

PRODUCT_FACTS_SQL = r"""
SELECT
  p.product_id,
  p.country,
  p.category,
  p.product_name,
  p.brand,
  p.ean,
  public.is_valid_ean(p.ean) AS ean_valid,
  p.confidence AS persisted_confidence,
  p.unhealthiness_score,
  COALESCE(i.ingredient_count, 0)::integer AS ingredient_count,
  COALESCE(a.contains_count, 0)::integer AS allergen_contains_count,
  COALESCE(a.traces_count, 0)::integer AS allergen_traces_count,
  nf.calories,
  nf.total_fat_g,
  nf.saturated_fat_g,
  nf.trans_fat_g,
  nf.carbs_g,
  nf.sugars_g,
  nf.fibre_g,
  nf.protein_g,
  nf.salt_g,
  c.nutrition_pts,
  c.ingredient_pts,
  c.source_pts,
  c.ean_pts,
  c.allergen_pts,
  c.total_confidence,
  c.confidence_band
FROM public.products p
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS ingredient_count
  FROM public.product_ingredient pi
  WHERE pi.product_id = p.product_id
) i ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) FILTER (WHERE pai.type = 'contains') AS contains_count,
         COUNT(*) FILTER (WHERE pai.type = 'traces') AS traces_count
  FROM public.product_allergen_info pai
  WHERE pai.product_id = p.product_id
) a ON true
LEFT JOIN public.nutrition_facts nf ON nf.product_id = p.product_id
LEFT JOIN public.v_product_confidence c ON c.product_id = p.product_id
WHERE p.is_deprecated IS NOT TRUE
ORDER BY p.product_id
"""

INGREDIENT_REFS_SQL = r"""
SELECT
  (SELECT COUNT(*) FROM public.ingredient_ref)::integer AS total_refs,
  (SELECT COUNT(DISTINCT ingredient_id) FROM public.product_ingredient)::integer AS used_refs,
  (SELECT COUNT(*) FROM public.ingredient_ref ir
   WHERE NOT EXISTS (
     SELECT 1 FROM public.product_ingredient pi
     WHERE pi.ingredient_id = ir.ingredient_id
   ))::integer AS unused_refs,
  (SELECT COUNT(*) FROM public.product_ingredient pi
   WHERE NOT EXISTS (
     SELECT 1 FROM public.products p WHERE p.product_id = pi.product_id
   ))::integer AS orphan_product_links,
  (SELECT COUNT(*) FROM public.product_ingredient pi
   WHERE NOT EXISTS (
     SELECT 1 FROM public.ingredient_ref ir
     WHERE ir.ingredient_id = pi.ingredient_id
   ))::integer AS orphan_ref_links
"""

DUPLICATE_EANS_SQL = r"""
SELECT country, ean, COUNT(*)::integer AS product_count,
       ARRAY_AGG(product_id ORDER BY product_id) AS product_ids
FROM public.products
WHERE is_deprecated IS NOT TRUE AND ean IS NOT NULL AND btrim(ean) <> ''
GROUP BY country, ean
HAVING COUNT(*) > 1
ORDER BY country, ean
"""

COVERAGE_VIEW_SQL = r"""
SELECT country, category, total_products, with_ingredients, ingredient_pct,
       with_allergens, allergen_pct, with_ean, ean_pct, avg_completeness_pct
FROM public.v_data_coverage_summary
ORDER BY country, category
"""

SCORING_VIEW_SQL = r"""
SELECT country, category, band, product_count, pct_of_category,
       avg_score, min_score, max_score, stddev_score
FROM public.mv_scoring_distribution
ORDER BY country, category,
  CASE band
    WHEN 'Green' THEN 1 WHEN 'Yellow' THEN 2 WHEN 'Orange' THEN 3
    WHEN 'Red' THEN 4 WHEN 'Dark Red' THEN 5 ELSE 6
  END
"""


class QueryExecutor(Protocol):
    """Minimal interface used by the report builder and unit tests."""

    def rows(self, name: str, sql: str) -> list[dict[str, Any]]:
        """Return a query result as JSON-compatible row dictionaries."""


@dataclass
class PsqlExecutor:
    """Read-only JSON query runner using the repository's existing psql convention."""

    executable: str = "psql"

    def rows(self, name: str, sql: str) -> list[dict[str, Any]]:
        wrapped = f"SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb) FROM ({sql.rstrip().rstrip(';')}) q;"
        command = [
            self.executable,
            "-X",
            "--no-psqlrc",
            "--quiet",
            "--tuples-only",
            "--no-align",
            "--set=ON_ERROR_STOP=1",
            "--command",
            wrapped,
        ]
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=os.environ.copy(),
        )
        if result.returncode != 0:
            detail = result.stderr.strip().splitlines()
            safe_detail = detail[-1] if detail else "psql returned no diagnostic"
            raise RuntimeError(f"query {name!r} failed: {safe_detail}")
        payload = result.stdout.strip()
        if not payload:
            raise RuntimeError(f"query {name!r} returned no JSON payload")
        parsed = json.loads(payload)
        if not isinstance(parsed, list):
            raise RuntimeError(f"query {name!r} returned malformed JSON")
        return parsed


def pct(count: int, total: int) -> float | None:
    """Return a one-decimal percentage, preserving not-applicable as null."""
    if total == 0:
        return None
    return round(100.0 * count / total, 1)


def count_metric(count: int, total: int) -> dict[str, int | float | None]:
    return {"count": count, "pct": pct(count, total)}


def safe_identifier(value: str, label: str) -> str:
    if not SAFE_IDENTIFIER.fullmatch(value):
        raise ValueError(f"{label} must contain only safe identifier characters")
    return value


def load_json_object(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"{label} not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} is malformed JSON: {path}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain a JSON object: {path}")
    return value


def validate_config(config: dict[str, Any]) -> None:
    if config.get("schema_version") != 1:
        raise ValueError("threshold config schema_version must be 1")
    if config.get("report_schema_version") != REPORT_SCHEMA_VERSION:
        raise ValueError("threshold config targets an incompatible report schema")
    if not isinstance(config.get("rules"), list) or not config["rules"]:
        raise ValueError("threshold config rules must be a non-empty list")
    seen: set[str] = set()
    for rule in config["rules"]:
        if not isinstance(rule, dict):
            raise ValueError("every threshold rule must be an object")
        required = {"id", "path", "direction", "severity"}
        if not required.issubset(rule):
            raise ValueError(f"threshold rule is missing fields: {required - set(rule)}")
        if rule["id"] in seen:
            raise ValueError(f"duplicate threshold rule id: {rule['id']}")
        seen.add(rule["id"])
        if rule["direction"] not in {"higher", "lower"}:
            raise ValueError(f"invalid direction for rule {rule['id']}")
        if rule["severity"] not in {"failure", "warning"}:
            raise ValueError(f"invalid severity for rule {rule['id']}")
        if rule.get("regression_unit") not in {"count", "percentage_points", "points"}:
            raise ValueError(f"invalid regression_unit for rule {rule['id']}")
        for key in ("hard_min", "hard_max", "max_regression"):
            if key in rule and rule[key] is not None and not isinstance(rule[key], (int, float)):
                raise ValueError(f"{key} must be numeric for rule {rule['id']}")
    if not isinstance(config.get("country_overrides", {}), dict):
        raise ValueError("country_overrides must be an object")


def validate_baseline(baseline: dict[str, Any], dataset_id: str) -> None:
    if baseline.get("baseline_schema_version") != BASELINE_SCHEMA_VERSION:
        raise ValueError("baseline schema_version is missing or incompatible")
    if baseline.get("report_schema_version") != REPORT_SCHEMA_VERSION:
        raise ValueError("baseline targets an incompatible report schema")
    if baseline.get("dataset_id") != dataset_id:
        raise ValueError("baseline dataset_id does not match the current dataset")
    if not isinstance(baseline.get("values"), dict):
        raise ValueError("baseline values must be an object")
    safe_identifier(str(baseline.get("baseline_id", "")), "baseline_id")


def get_path(value: dict[str, Any], path: str) -> Any:
    current: Any = value
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            raise KeyError(path)
        current = current[part]
    return current


def nutrition_impossible(row: dict[str, Any]) -> bool:
    values = {field: row.get(field) for field in CORE_NUTRITION_FIELDS}
    numeric = [value for value in values.values() if value is not None]
    if any(value < 0 for value in numeric):
        return True
    if any((values[field] or 0) > 100 for field in ("total_fat_g", "carbs_g", "protein_g")):
        return True
    if (values["salt_g"] or 0) > 40 or (values["calories"] or 0) > 900:
        return True
    if (
        values["saturated_fat_g"] is not None
        and values["total_fat_g"] is not None
        and values["saturated_fat_g"] > values["total_fat_g"]
    ):
        return True
    if values["sugars_g"] is not None and values["carbs_g"] is not None and values["sugars_g"] > values["carbs_g"]:
        return True
    return sum((values[field] or 0) for field in ("total_fat_g", "carbs_g", "protein_g")) > 105


def segment_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    with_ingredients = sum(row["ingredient_count"] > 0 for row in rows)
    with_contains = sum(row["allergen_contains_count"] > 0 for row in rows)
    with_any_allergen = sum(row["allergen_contains_count"] + row["allergen_traces_count"] > 0 for row in rows)
    nutrition_present = {field: sum(row.get(field) is not None for row in rows) for field in CORE_NUTRITION_FIELDS}
    core_counts = [sum(row.get(field) is not None for field in CORE_NUTRITION_FIELDS) for row in rows]
    usable_core = sum(count == len(CORE_NUTRITION_FIELDS) for count in core_counts)
    missing_all_core = sum(count == 0 for count in core_counts)
    partial_core = total - usable_core - missing_all_core
    with_ean = sum(bool(row.get("ean") and str(row["ean"]).strip()) for row in rows)
    valid_ean = sum(row.get("ean_valid") is True for row in rows)
    invalid_ean = with_ean - valid_ean
    duplicate_ean = sum(bool(row.get("ean_duplicate_country")) for row in rows)
    view_rows = [row for row in rows if row.get("total_confidence") is not None]
    confidence_bands = Counter(row.get("confidence_band") for row in view_rows)
    persisted_mismatch = sum(
        row.get("persisted_confidence") is not None
        and {"verified": "high", "estimated": "medium", "low": "low"}.get(row.get("persisted_confidence"))
        != row.get("confidence_band")
        for row in view_rows
    )
    identity_fields = ("product_name", "brand", "category", "country")
    missing_identity = {
        field: sum(not row.get(field) or not str(row[field]).strip() for row in rows) for field in identity_fields
    }
    missing_any_identity = sum(
        any(not row.get(field) or not str(row[field]).strip() for field in identity_fields) for row in rows
    )
    confidence_values = [float(row["total_confidence"]) for row in view_rows]
    component_averages = {
        field: round(sum(float(row[field]) for row in view_rows) / len(view_rows), 1) if view_rows else None
        for field in CONFIDENCE_COMPONENTS
    }
    return {
        "products": total,
        "ingredients": {
            "with_links": count_metric(with_ingredients, total),
            "without_links": count_metric(total - with_ingredients, total),
        },
        "allergens": {
            "known_contains": count_metric(with_contains, total),
            "positive_declaration_present": count_metric(with_any_allergen, total),
            "unknown": count_metric(total - with_any_allergen, total),
        },
        "nutrition": {
            "usable_core": count_metric(usable_core, total),
            "missing_all_core": count_metric(missing_all_core, total),
            "partial_core": count_metric(partial_core, total),
            "per_field": {field: count_metric(nutrition_present[field], total) for field in CORE_NUTRITION_FIELDS},
            "impossible_values": count_metric(sum(nutrition_impossible(row) for row in rows), total),
        },
        "ean": {
            "with_ean": count_metric(with_ean, total),
            "without_ean": count_metric(total - with_ean, total),
            "valid": count_metric(valid_ean, total),
            "invalid": count_metric(invalid_ean, total),
            "duplicate_country_aware": count_metric(duplicate_ean, total),
        },
        "confidence": {
            "bands": {
                band: count_metric(confidence_bands.get(band, 0), len(view_rows)) for band in ("high", "medium", "low")
            },
            "average_total": round(sum(confidence_values) / len(confidence_values), 1) if confidence_values else None,
            "median_total": round(median(confidence_values), 1) if confidence_values else None,
            "component_averages": component_averages,
            "persisted_band_mismatch": count_metric(persisted_mismatch, len(view_rows)),
            "missing_from_view": count_metric(total - len(view_rows), total),
        },
        "critical_fields": {
            "definition": list(identity_fields),
            "missing_any": count_metric(missing_any_identity, total),
            "missing_by_field": {field: count_metric(missing_identity[field], total) for field in identity_fields},
        },
    }


def build_breakdowns(rows: list[dict[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {"global": segment_metrics(rows), "country": {}, "category": {}}
    for scope, field in (("country", "country"), ("category", "category")):
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in rows:
            grouped[str(row.get(field) or "<missing>")].append(row)
        result[scope] = {key: segment_metrics(grouped[key]) for key in sorted(grouped)}
    return result


def object_failure_report(
    *, generated_at: str, environment: str, dataset_id: str, failures: list[str]
) -> dict[str, Any]:
    return {
        "report_schema_version": REPORT_SCHEMA_VERSION,
        "generated_at": generated_at,
        "environment": environment,
        "dataset_id": dataset_id,
        "status": "fail",
        "active_product_count": None,
        "metrics": {},
        "breakdowns": {"country": {}, "category": {}},
        "thresholds": {},
        "baseline": None,
        "regressions": [],
        "warnings": [],
        "failures": sorted(failures),
    }


def reconcile_coverage(rows: list[dict[str, Any]], coverage_rows: list[dict[str, Any]]) -> list[str]:
    expected: dict[tuple[str, str], dict[str, int]] = {}
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[(str(row.get("country")), str(row.get("category")))].append(row)
    for key, group in grouped.items():
        expected[key] = {
            "total_products": len(group),
            "with_ingredients": sum(item["ingredient_count"] > 0 for item in group),
            "with_allergens": sum(
                item["allergen_contains_count"] + item["allergen_traces_count"] > 0 for item in group
            ),
            "with_ean": sum(bool(item.get("ean") and str(item["ean"]).strip()) for item in group),
        }
    actual = {
        (str(row["country"]), str(row["category"])): {
            field: int(row[field]) for field in ("total_products", "with_ingredients", "with_allergens", "with_ean")
        }
        for row in coverage_rows
    }
    failures: list[str] = []
    if set(expected) != set(actual):
        failures.append("v_data_coverage_summary segments do not match active products")
    for key in sorted(set(expected) & set(actual)):
        if expected[key] != actual[key]:
            failures.append(f"v_data_coverage_summary is stale for {key[0]}/{key[1]}")
    return failures


def score_band(value: float | int | None) -> str | None:
    if value is None:
        return None
    score = float(value)
    if 1 <= score <= 20:
        return "Green"
    if score <= 40:
        return "Yellow"
    if score <= 60:
        return "Orange"
    if score <= 80:
        return "Red"
    if score <= 100:
        return "Dark Red"
    return None


def reconcile_scoring(rows: list[dict[str, Any]], scoring_rows: list[dict[str, Any]]) -> list[str]:
    expected: Counter[tuple[str, str, str | None]] = Counter()
    for row in rows:
        if row.get("unhealthiness_score") is not None:
            expected[(str(row["country"]), str(row["category"]), score_band(row["unhealthiness_score"]))] += 1
    actual = Counter(
        {
            (str(row["country"]), str(row["category"]), row.get("band")): int(row["product_count"])
            for row in scoring_rows
        }
    )
    if expected != actual:
        return ["mv_scoring_distribution does not reconcile with active product scores"]
    return []


def aggregate_scoring_rows(scoring_rows: list[dict[str, Any]], field: str) -> dict[str, Any]:
    grouped: dict[str, Counter[str]] = defaultdict(Counter)
    for row in scoring_rows:
        grouped[str(row[field])][str(row["band"])] += int(row["product_count"])
    result: dict[str, Any] = {}
    for key in sorted(grouped):
        total = sum(grouped[key].values())
        result[key] = {
            band: count_metric(grouped[key].get(band, 0), total)
            for band in ("Green", "Yellow", "Orange", "Red", "Dark Red")
        }
    return result


def scoring_metrics(
    rows: list[dict[str, Any]], scoring_rows: list[dict[str, Any]], minimum_sample: int
) -> dict[str, Any]:
    valid_products = [row for row in rows if row.get("unhealthiness_score") is not None]
    invalid_products = [
        row
        for row in valid_products
        if float(row["unhealthiness_score"]) < 1 or float(row["unhealthiness_score"]) > 100
    ]
    band_counts: Counter[str] = Counter()
    category_bands: dict[str, set[str]] = defaultdict(set)
    category_counts: Counter[str] = Counter()
    for row in scoring_rows:
        count = int(row["product_count"])
        band_counts[str(row["band"])] += count
        category_bands[str(row["category"])].add(str(row["band"]))
        category_counts[str(row["category"])] += count
    collapsed = sorted(
        category
        for category, bands in category_bands.items()
        if len(bands) == 1 and category_counts[category] >= minimum_sample
    )
    product_categories = {str(row["category"]) for row in rows}
    scoring_categories = {str(row["category"]) for row in scoring_rows}
    empty_categories = sorted(product_categories - scoring_categories)
    values = [float(row["unhealthiness_score"]) for row in valid_products]
    return {
        "source": "mv_scoring_distribution",
        "bands": {
            band: count_metric(band_counts.get(band, 0), len(valid_products))
            for band in ("Green", "Yellow", "Orange", "Red", "Dark Red")
        },
        "null_scores": count_metric(len(rows) - len(valid_products), len(rows)),
        "invalid_scores": count_metric(len(invalid_products), len(rows)),
        "average_score": round(sum(values) / len(values), 1) if values else None,
        "median_score": round(median(values), 1) if values else None,
        "collapsed_categories": collapsed,
        "collapsed_category_count": len(collapsed),
        "empty_categories": empty_categories,
        "empty_category_count": len(empty_categories),
        "by_country": aggregate_scoring_rows(scoring_rows, "country"),
        "by_category": aggregate_scoring_rows(scoring_rows, "category"),
        "country_category": [
            {
                "country": row["country"],
                "category": row["category"],
                "band": row["band"],
                "product_count": int(row["product_count"]),
                "pct_of_category": row["pct_of_category"],
                "avg_score": row["avg_score"],
                "min_score": row["min_score"],
                "max_score": row["max_score"],
                "stddev_score": row["stddev_score"],
            }
            for row in scoring_rows
        ],
    }


def apply_thresholds(report: dict[str, Any], config: dict[str, Any], baseline: dict[str, Any] | None) -> None:
    failures: list[str] = report["failures"]
    warnings: list[str] = report["warnings"]
    regressions: list[dict[str, Any]] = report["regressions"]
    baseline_values = baseline["values"] if baseline else {}
    outcomes: list[dict[str, Any]] = []
    for rule in sorted(config["rules"], key=lambda item: item["id"]):
        rule_id = str(rule["id"])
        try:
            current = get_path(report, str(rule["path"]))
        except KeyError:
            failures.append(f"threshold metric unavailable: {rule_id}")
            continue
        if current is None or not isinstance(current, (int, float)):
            failures.append(f"threshold metric is not numeric: {rule_id}")
            continue
        messages: list[str] = []
        hard_min = rule.get("hard_min")
        hard_max = rule.get("hard_max")
        if hard_min is not None and current < hard_min:
            messages.append(f"{rule_id}={current} is below hard minimum {hard_min}")
        if hard_max is not None and current > hard_max:
            messages.append(f"{rule_id}={current} exceeds hard maximum {hard_max}")
        baseline_value = baseline_values.get(rule_id)
        regression = None
        if baseline is not None:
            if not isinstance(baseline_value, (int, float)):
                failures.append(f"baseline value missing or non-numeric: {rule_id}")
                continue
            delta = round(float(current) - float(baseline_value), 3)
            adverse = -delta if rule["direction"] == "higher" else delta
            allowed = float(rule.get("max_regression", 0))
            regression = {
                "rule_id": rule_id,
                "path": rule["path"],
                "baseline": baseline_value,
                "current": current,
                "delta": delta,
                "direction": rule["direction"],
                "allowed_regression": allowed,
                "regressed": adverse > allowed,
                "improved": delta > 0 if rule["direction"] == "higher" else delta < 0,
            }
            regressions.append(regression)
            if regression["regressed"]:
                messages.append(f"{rule_id} regressed from {baseline_value} to {current} (allowed {allowed})")
        target = failures if rule["severity"] == "failure" else warnings
        target.extend(messages)
        outcomes.append(
            {
                "id": rule_id,
                "path": rule["path"],
                "severity": rule["severity"],
                "regression_unit": rule["regression_unit"],
                "current": current,
                "hard_min": hard_min,
                "hard_max": hard_max,
                "passed": not messages,
            }
        )
    report["thresholds"] = {
        "config_schema_version": config["schema_version"],
        "rules": outcomes,
        "country_overrides": config.get("country_overrides", {}),
    }


def collect_report(
    executor: QueryExecutor,
    *,
    config: dict[str, Any],
    baseline: dict[str, Any] | None,
    generated_at: str,
    environment: str,
    dataset_id: str,
) -> dict[str, Any]:
    objects = executor.rows("required_objects", OBJECTS_SQL)
    found = {str(row["name"]): bool(row["exists"]) for row in objects}
    missing = sorted(name for name in REQUIRED_OBJECTS if not found.get(name, False))
    if missing:
        return object_failure_report(
            generated_at=generated_at,
            environment=environment,
            dataset_id=dataset_id,
            failures=[f"required database object is missing: {name}" for name in missing],
        )

    dataset = executor.rows("dataset", DATASET_SQL)[0]
    rows = executor.rows("product_facts", PRODUCT_FACTS_SQL)
    refs = executor.rows("ingredient_refs", INGREDIENT_REFS_SQL)[0]
    duplicate_eans = executor.rows("duplicate_eans", DUPLICATE_EANS_SQL)
    coverage_rows = executor.rows("coverage_view", COVERAGE_VIEW_SQL)
    scoring_rows = executor.rows("scoring_view", SCORING_VIEW_SQL)
    expected_segments = executor.rows("expected_segments", EXPECTED_SEGMENTS_SQL)
    active = int(dataset["active_products"])
    duplicate_product_ids = {int(product_id) for duplicate in duplicate_eans for product_id in duplicate["product_ids"]}
    for row in rows:
        row["ean_duplicate_country"] = int(row["product_id"]) in duplicate_product_ids
    breakdowns = build_breakdowns(rows)
    failures = reconcile_coverage(rows, coverage_rows)
    failures.extend(reconcile_scoring(rows, scoring_rows))
    warnings: list[str] = []
    if active == 0:
        failures.append("dataset has zero active products")
    if len(rows) != active:
        failures.append("active product query does not reconcile with products table")
    missing_confidence = breakdowns["global"]["confidence"]["missing_from_view"]["count"]
    if missing_confidence:
        failures.append(f"v_product_confidence is missing {missing_confidence} active products")

    empty_segments = {
        scope: sorted(
            str(row["segment"]) for row in expected_segments if row["scope"] == scope and row["active_products"] == 0
        )
        for scope in ("country", "category")
    }
    if empty_segments["country"]:
        warnings.append(f"{len(empty_segments['country'])} active country references have zero products")
    if empty_segments["category"]:
        warnings.append(f"{len(empty_segments['category'])} active category references have zero products")

    ingredient_metrics = breakdowns["global"]["ingredients"] | {
        "reference_usage": {
            "total": int(refs["total_refs"]),
            "used": int(refs["used_refs"]),
            "unused": int(refs["unused_refs"]),
        },
        "orphan_links": {
            "missing_product": int(refs["orphan_product_links"]),
            "missing_reference": int(refs["orphan_ref_links"]),
        },
    }
    allergen_metrics = breakdowns["global"]["allergens"] | {
        "completed_assessment": {
            "value": None,
            "availability": "unavailable",
            "reason": "schema stores positive declarations but no assessment-complete state",
        },
        "explicit_no_known_allergens": {
            "value": None,
            "availability": "unavailable",
            "reason": "absence of rows means unknown, not an explicit negative assessment",
        },
        "semantic_limit": (
            "product_allergen_info represents contains/traces declarations only; "
            "it cannot prove a completed assessment or no-known-allergens result"
        ),
    }
    duplicate_products = sum(int(row["product_count"]) for row in duplicate_eans)
    ean_metrics = breakdowns["global"]["ean"] | {
        "duplicate_country_aware_groups": len(duplicate_eans),
        "duplicate_country_aware_products": duplicate_products,
        "duplicate_samples": [
            {
                "country": row["country"],
                "ean": row["ean"],
                "product_ids": list(row["product_ids"])[:SAMPLE_LIMIT],
            }
            for row in duplicate_eans[:SAMPLE_LIMIT]
        ],
    }
    critical_samples = sorted(
        int(row["product_id"])
        for row in rows
        if any(
            not row.get(field) or not str(row[field]).strip()
            for field in ("product_name", "brand", "category", "country")
        )
    )[:SAMPLE_LIMIT]
    low_samples = []
    for row in sorted(rows, key=lambda item: int(item["product_id"])):
        if row.get("confidence_band") != "low":
            continue
        reasons = [field.removesuffix("_pts") for field in CONFIDENCE_COMPONENTS if row.get(field) == 0]
        low_samples.append(
            {
                "product_id": int(row["product_id"]),
                "total_confidence": row["total_confidence"],
                "zero_components": reasons,
            }
        )
        if len(low_samples) == SAMPLE_LIMIT:
            break

    report: dict[str, Any] = {
        "report_schema_version": REPORT_SCHEMA_VERSION,
        "generated_at": generated_at,
        "environment": environment,
        "dataset_id": dataset_id,
        "status": "pass",
        "active_product_count": active,
        "metrics": {
            "dataset": {
                "active_products": active,
                "deprecated_products": int(dataset["deprecated_products"]),
                "total_products": int(dataset["total_products"]),
                "countries_with_products": int(dataset["countries"]),
                "categories_with_products": int(dataset["categories"]),
                "expected_empty_segments": empty_segments,
            },
            "ingredients": ingredient_metrics,
            "allergens": allergen_metrics,
            "nutrition": breakdowns["global"]["nutrition"],
            "ean": ean_metrics,
            "confidence": breakdowns["global"]["confidence"] | {"low_samples": low_samples},
            "critical_fields": breakdowns["global"]["critical_fields"] | {"sample_product_ids": critical_samples},
            "scoring": scoring_metrics(
                rows,
                scoring_rows,
                int(config.get("scoring", {}).get("collapsed_category_min_products", 5)),
            ),
            "view_reconciliation": {
                "coverage_view_rows": len(coverage_rows),
                "confidence_view_rows": active - missing_confidence,
                "scoring_view_rows": len(scoring_rows),
            },
        },
        "breakdowns": {
            "country": breakdowns["country"],
            "category": breakdowns["category"],
        },
        "thresholds": {},
        "baseline": {
            "baseline_id": baseline["baseline_id"],
            "dataset_id": baseline["dataset_id"],
        }
        if baseline
        else None,
        "regressions": [],
        "warnings": warnings,
        "failures": failures,
    }
    apply_thresholds(report, config, baseline)
    report["failures"] = sorted(set(report["failures"]))
    report["warnings"] = sorted(set(report["warnings"]))
    report["regressions"] = sorted(report["regressions"], key=lambda item: item["rule_id"])
    if report["failures"]:
        report["status"] = "fail"
    elif report["warnings"]:
        report["status"] = "warn"
    return report


def baseline_from_report(report: dict[str, Any], config: dict[str, Any], baseline_id: str) -> dict[str, Any]:
    values = {
        rule["id"]: get_path(report, rule["path"]) for rule in sorted(config["rules"], key=lambda item: item["id"])
    }
    return {
        "baseline_schema_version": BASELINE_SCHEMA_VERSION,
        "report_schema_version": REPORT_SCHEMA_VERSION,
        "baseline_id": safe_identifier(baseline_id, "baseline_id"),
        "dataset_id": report["dataset_id"],
        "created_at": report["generated_at"],
        "values": values,
    }


def markdown_report(report: dict[str, Any]) -> str:
    status_icon = {"pass": "[PASS]", "warn": "[WARN]", "fail": "[FAIL]"}[report["status"]]
    lines = [
        "# TryVit data-quality report",
        "",
        f"{status_icon} **Status: {report['status'].upper()}**",
        "",
        f"- Report schema: `{report['report_schema_version']}`",
        f"- Generated: `{report['generated_at']}`",
        f"- Environment: `{report['environment']}`",
        f"- Dataset: `{report['dataset_id']}`",
        f"- Active products: `{report['active_product_count']}`",
        "",
    ]
    if not report["metrics"]:
        lines.extend(["## Failures", "", *[f"- {item}" for item in report["failures"]], ""])
        return "\n".join(lines)
    metrics = report["metrics"]
    lines.extend(
        [
            "## Required coverage",
            "",
            "| Metric | Count | Percent |",
            "|---|---:|---:|",
        ]
    )
    coverage_rows = (
        ("Ingredients linked", metrics["ingredients"]["with_links"]),
        ("Known allergen contains", metrics["allergens"]["known_contains"]),
        ("Nutrition usable core", metrics["nutrition"]["usable_core"]),
        ("Valid EAN", metrics["ean"]["valid"]),
        ("Low confidence", metrics["confidence"]["bands"]["low"]),
        ("Missing critical identity", metrics["critical_fields"]["missing_any"]),
    )
    for label, value in coverage_rows:
        percent = "N/A" if value["pct"] is None else f"{value['pct']:.1f}%"
        lines.append(f"| {label} | {value['count']} | {percent} |")
    lines.extend(
        [
            "",
            "## Confidence",
            "",
            f"Average: `{metrics['confidence']['average_total']}`; "
            f"Median: `{metrics['confidence']['median_total']}`; "
            f"Missing view rows: `{metrics['confidence']['missing_from_view']['count']}`",
            "",
            "## Allergen semantics",
            "",
            metrics["allergens"]["semantic_limit"],
            "",
            "## Scoring",
            "",
            f"Average score: `{metrics['scoring']['average_score']}`; "
            f"Median score: `{metrics['scoring']['median_score']}`; "
            f"Collapsed categories: `{metrics['scoring']['collapsed_category_count']}`",
            "",
            "## Baseline comparison",
            "",
            "| Rule | Baseline | Current | Delta | Result |",
            "|---|---:|---:|---:|---|",
        ]
    )
    if report["regressions"]:
        for item in report["regressions"]:
            result = "regressed" if item["regressed"] else "improved" if item["improved"] else "stable"
            lines.append(
                f"| `{item['rule_id']}` | {item['baseline']} | {item['current']} | {item['delta']:+g} | {result} |"
            )
    else:
        lines.append("| _No baseline supplied_ | N/A | N/A | N/A | N/A |")
    for heading, values in (("Failures", report["failures"]), ("Warnings", report["warnings"])):
        lines.extend(["", f"## {heading}", ""])
        lines.extend([f"- {item}" for item in values] or ["- None"])
    lines.append("")
    return "\n".join(lines)


def write_outputs(report: dict[str, Any], json_path: Path, markdown_path: Path) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    markdown_path.write_text(markdown_report(report), encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=Path("data-quality/thresholds.json"))
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--json-out", type=Path, default=Path("data-quality-report.json"))
    parser.add_argument("--markdown-out", type=Path, default=Path("data-quality-report.md"))
    parser.add_argument("--environment", default="ci" if os.environ.get("CI") else "local")
    parser.add_argument("--dataset-id", default="local-postgres")
    parser.add_argument("--generated-at")
    parser.add_argument("--update-baseline", type=Path)
    parser.add_argument("--baseline-id")
    return parser.parse_args(argv)


def run(argv: list[str] | None = None, executor: QueryExecutor | None = None) -> int:
    args = parse_args(argv)
    generated_at = args.generated_at or datetime.now(UTC).replace(microsecond=0).isoformat()
    report: dict[str, Any]
    try:
        environment = safe_identifier(args.environment, "environment")
        dataset_id = safe_identifier(args.dataset_id, "dataset_id")
        config = load_json_object(args.config, "threshold config")
        validate_config(config)
        baseline = None
        if args.baseline:
            baseline = load_json_object(args.baseline, "baseline")
            validate_baseline(baseline, dataset_id)
        if args.update_baseline and args.baseline:
            raise ValueError("--update-baseline cannot be combined with --baseline")
        report = collect_report(
            executor or PsqlExecutor(),
            config=config,
            baseline=baseline,
            generated_at=generated_at,
            environment=environment,
            dataset_id=dataset_id,
        )
        if args.update_baseline:
            if report["failures"]:
                raise ValueError("refusing to update a baseline from a failing report")
            if not args.baseline_id:
                raise ValueError("--baseline-id is required with --update-baseline")
            baseline_payload = baseline_from_report(report, config, args.baseline_id)
            args.update_baseline.parent.mkdir(parents=True, exist_ok=True)
            args.update_baseline.write_text(
                json.dumps(baseline_payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
    except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
        environment = getattr(args, "environment", "unknown")
        dataset_id = getattr(args, "dataset_id", "unknown")
        report = object_failure_report(
            generated_at=generated_at,
            environment=str(environment),
            dataset_id=str(dataset_id),
            failures=[str(exc)],
        )
    write_outputs(report, args.json_out, args.markdown_out)
    sys.stdout.write(markdown_report(report))
    return 1 if report["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(run())
