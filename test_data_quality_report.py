"""Contract and failure-mode tests for the canonical data-quality report."""

from __future__ import annotations

import json
import tempfile
import unittest
from contextlib import redirect_stdout
from copy import deepcopy
from io import StringIO
from pathlib import Path
from typing import Any

import check_pipeline_structure as pipeline_structure
import data_quality_report as dqr


def quiet_run(*args: Any, **kwargs: Any) -> int:
    with redirect_stdout(StringIO()):
        return dqr.run(*args, **kwargs)


class FakeExecutor:
    def __init__(self, values: dict[str, list[dict[str, Any]]]) -> None:
        self.values = values

    def rows(self, name: str, sql: str) -> list[dict[str, Any]]:
        del sql
        value = self.values[name]
        if isinstance(value, Exception):
            raise value
        return deepcopy(value)


def config(*, severity: str = "failure", max_regression: float = 1.0) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "report_schema_version": 1,
        "scoring": {"collapsed_category_min_products": 5},
        "country_overrides": {},
        "rules": [
            {
                "id": "active_products",
                "path": "metrics.dataset.active_products",
                "regression_unit": "count",
                "direction": "higher",
                "severity": "failure",
                "hard_min": 1,
                "max_regression": 0,
            },
            {
                "id": "ingredient_coverage_pct",
                "path": "metrics.ingredients.with_links.pct",
                "regression_unit": "percentage_points",
                "direction": "higher",
                "severity": severity,
                "hard_min": 50,
                "max_regression": max_regression,
            },
        ],
    }


def baseline(ingredient_pct: float = 66.7) -> dict[str, Any]:
    return {
        "baseline_schema_version": 1,
        "report_schema_version": 1,
        "baseline_id": "ci-v1",
        "dataset_id": "deterministic-ci-qa-v1",
        "created_at": "2026-07-28T00:00:00+00:00",
        "values": {
            "active_products": 3,
            "ingredient_coverage_pct": ingredient_pct,
        },
    }


def row(
    product_id: int,
    *,
    country: str,
    category: str,
    ingredients: int,
    allergens: int,
    ean: str | None,
    ean_valid: bool | None,
    band: str,
    total: int,
    persisted: str,
    score: int,
) -> dict[str, Any]:
    nutrition = {
        "calories": 100,
        "total_fat_g": 2,
        "saturated_fat_g": 1,
        "trans_fat_g": None,
        "carbs_g": 10,
        "sugars_g": 5,
        "fibre_g": None,
        "protein_g": 3,
        "salt_g": 0.2,
    }
    return {
        "product_id": product_id,
        "country": country,
        "category": category,
        "product_name": f"Product {product_id}",
        "brand": "TryVit",
        "ean": ean,
        "ean_valid": ean_valid,
        "persisted_confidence": persisted,
        "unhealthiness_score": score,
        "ingredient_count": ingredients,
        "allergen_contains_count": allergens,
        "allergen_traces_count": 0,
        **nutrition,
        "nutrition_pts": 30,
        "ingredient_pts": 25 if ingredients else 0,
        "source_pts": 18,
        "ean_pts": 10 if ean else 0,
        "allergen_pts": 10 if allergens else 0,
        "total_confidence": total,
        "confidence_band": band,
    }


def valid_values() -> dict[str, list[dict[str, Any]]]:
    rows = [
        row(
            1,
            country="PL",
            category="A",
            ingredients=2,
            allergens=1,
            ean="5901234123457",
            ean_valid=True,
            band="high",
            total=93,
            persisted="verified",
            score=10,
        ),
        row(
            2,
            country="PL",
            category="A",
            ingredients=1,
            allergens=0,
            ean="96385074",
            ean_valid=True,
            band="medium",
            total=63,
            persisted="estimated",
            score=30,
        ),
        row(
            3,
            country="DE",
            category="B",
            ingredients=0,
            allergens=0,
            ean=None,
            ean_valid=None,
            band="low",
            total=48,
            persisted="low",
            score=70,
        ),
    ]
    return {
        "required_objects": [
            {"name": name, "kind": kind, "exists": True} for name, kind in sorted(dqr.REQUIRED_OBJECTS.items())
        ],
        "dataset": [
            {
                "active_products": 3,
                "deprecated_products": 1,
                "total_products": 4,
                "countries": 2,
                "categories": 2,
            }
        ],
        "product_facts": rows,
        "ingredient_refs": [
            {
                "total_refs": 2,
                "used_refs": 2,
                "unused_refs": 0,
                "orphan_product_links": 0,
                "orphan_ref_links": 0,
            }
        ],
        "duplicate_eans": [],
        "coverage_view": [
            {
                "country": "DE",
                "category": "B",
                "total_products": 1,
                "with_ingredients": 0,
                "ingredient_pct": 0,
                "with_allergens": 0,
                "allergen_pct": 0,
                "with_ean": 0,
                "ean_pct": 0,
                "avg_completeness_pct": 50,
            },
            {
                "country": "PL",
                "category": "A",
                "total_products": 2,
                "with_ingredients": 2,
                "ingredient_pct": 100,
                "with_allergens": 1,
                "allergen_pct": 50,
                "with_ean": 2,
                "ean_pct": 100,
                "avg_completeness_pct": 90,
            },
        ],
        "scoring_view": [
            {
                "country": "DE",
                "category": "B",
                "band": "Red",
                "product_count": 1,
                "pct_of_category": 100,
                "avg_score": 70,
                "min_score": 70,
                "max_score": 70,
                "stddev_score": 0,
            },
            {
                "country": "PL",
                "category": "A",
                "band": "Green",
                "product_count": 1,
                "pct_of_category": 50,
                "avg_score": 10,
                "min_score": 10,
                "max_score": 10,
                "stddev_score": 0,
            },
            {
                "country": "PL",
                "category": "A",
                "band": "Yellow",
                "product_count": 1,
                "pct_of_category": 50,
                "avg_score": 30,
                "min_score": 30,
                "max_score": 30,
                "stddev_score": 0,
            },
        ],
        "expected_segments": [
            {"scope": "category", "segment": "A", "active_products": 2},
            {"scope": "category", "segment": "B", "active_products": 1},
            {"scope": "country", "segment": "DE", "active_products": 1},
            {"scope": "country", "segment": "PL", "active_products": 2},
        ],
    }


def report_for(
    values: dict[str, list[dict[str, Any]]] | None = None,
    *,
    threshold_config: dict[str, Any] | None = None,
    baseline_value: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return dqr.collect_report(
        FakeExecutor(values or valid_values()),
        config=threshold_config or config(),
        baseline=baseline_value,
        generated_at="2026-07-28T00:00:00+00:00",
        environment="ci",
        dataset_id="deterministic-ci-qa-v1",
    )


class DataQualityReportTests(unittest.TestCase):
    def test_valid_dataset_passes(self) -> None:
        report = report_for()
        self.assertEqual(report["status"], "pass")
        self.assertEqual(report["failures"], [])

    def test_zero_products_is_always_a_hard_failure(self) -> None:
        values = valid_values()
        values["dataset"][0].update(
            active_products=0, deprecated_products=0, total_products=0, countries=0, categories=0
        )
        values["product_facts"] = []
        values["coverage_view"] = []
        values["scoring_view"] = []
        values["expected_segments"] = []
        report = report_for(values)
        self.assertEqual(report["status"], "fail")
        self.assertIn("dataset has zero active products", report["failures"])

    def test_ingredient_regression_beyond_tolerance_fails(self) -> None:
        report = report_for(baseline_value=baseline(80.0))
        self.assertEqual(report["status"], "fail")
        self.assertTrue(any("ingredient_coverage_pct regressed" in item for item in report["failures"]))

    def test_regression_within_tolerance_is_reported_but_passes(self) -> None:
        report = report_for(baseline_value=baseline(67.0))
        self.assertEqual(report["status"], "pass")
        regression = next(item for item in report["regressions"] if item["rule_id"] == "ingredient_coverage_pct")
        self.assertFalse(regression["regressed"])
        self.assertEqual(regression["delta"], -0.3)

    def test_warning_only_rule_does_not_fail(self) -> None:
        report = report_for(
            threshold_config=config(severity="warning"),
            baseline_value=baseline(80.0),
        )
        self.assertEqual(report["status"], "warn")
        self.assertEqual(report["failures"], [])
        self.assertTrue(report["warnings"])

    def test_malformed_threshold_config_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "schema_version"):
            dqr.validate_config({"schema_version": 9})

    def test_incompatible_baseline_is_rejected(self) -> None:
        value = baseline()
        value["report_schema_version"] = 99
        with self.assertRaisesRegex(ValueError, "incompatible"):
            dqr.validate_baseline(value, "deterministic-ci-qa-v1")

    def test_missing_baseline_file_produces_failure_report(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "config.json"
            config_path.write_text(json.dumps(config()), encoding="utf-8")
            exit_code = quiet_run(
                [
                    "--config",
                    str(config_path),
                    "--baseline",
                    str(root / "missing.json"),
                    "--json-out",
                    str(root / "report.json"),
                    "--markdown-out",
                    str(root / "report.md"),
                ],
                executor=FakeExecutor(valid_values()),
            )
            self.assertEqual(exit_code, 1)
            payload = json.loads((root / "report.json").read_text(encoding="utf-8"))
            self.assertIn("baseline not found", payload["failures"][0])

    def test_explicit_baseline_update_writes_versioned_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "config.json"
            baseline_path = root / "baseline.json"
            config_path.write_text(json.dumps(config()), encoding="utf-8")
            exit_code = quiet_run(
                [
                    "--config",
                    str(config_path),
                    "--dataset-id",
                    "deterministic-ci-qa-v1",
                    "--generated-at",
                    "2026-07-28T00:00:00+00:00",
                    "--update-baseline",
                    str(baseline_path),
                    "--baseline-id",
                    "ci-v1",
                    "--json-out",
                    str(root / "report.json"),
                    "--markdown-out",
                    str(root / "report.md"),
                ],
                executor=FakeExecutor(valid_values()),
            )
            self.assertEqual(exit_code, 0)
            payload = json.loads(baseline_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["report_schema_version"], 1)
            self.assertEqual(payload["values"]["ingredient_coverage_pct"], 66.7)

    def test_json_contract_contains_required_top_level_fields(self) -> None:
        report = report_for()
        expected = {
            "report_schema_version",
            "generated_at",
            "environment",
            "dataset_id",
            "status",
            "active_product_count",
            "metrics",
            "breakdowns",
            "thresholds",
            "baseline",
            "regressions",
            "warnings",
            "failures",
        }
        self.assertEqual(set(report), expected)

    def test_markdown_is_rendered_from_same_report_model(self) -> None:
        report = report_for()
        markdown = dqr.markdown_report(report)
        self.assertIn(f"Active products: `{report['active_product_count']}`", markdown)
        self.assertIn(f"Average: `{report['metrics']['confidence']['average_total']}`", markdown)

    def test_breakdown_order_and_low_samples_are_deterministic(self) -> None:
        values = valid_values()
        values["product_facts"] = list(reversed(values["product_facts"]))
        report = report_for(values)
        self.assertEqual(list(report["breakdowns"]["country"]), ["DE", "PL"])
        self.assertEqual(report["metrics"]["confidence"]["low_samples"][0]["product_id"], 3)

    def test_report_never_copies_connection_secrets(self) -> None:
        report = report_for()
        serialized = json.dumps(report)
        self.assertNotIn("PGPASSWORD", serialized)
        self.assertNotIn("postgresql://", serialized)

    def test_country_and_category_breakdowns_reconcile(self) -> None:
        report = report_for()
        global_total = report["active_product_count"]
        for scope in ("country", "category"):
            subtotal = sum(item["products"] for item in report["breakdowns"][scope].values())
            self.assertEqual(subtotal, global_total)

    def test_missing_required_object_cannot_false_pass(self) -> None:
        values = valid_values()
        values["required_objects"][0]["exists"] = False
        report = report_for(values)
        self.assertEqual(report["status"], "fail")
        self.assertTrue(report["failures"])

    def test_stale_coverage_view_cannot_false_pass(self) -> None:
        values = valid_values()
        values["coverage_view"][0]["total_products"] = 99
        report = report_for(values)
        self.assertEqual(report["status"], "fail")
        self.assertTrue(any("stale" in item for item in report["failures"]))

    def test_stale_scoring_view_cannot_false_pass(self) -> None:
        values = valid_values()
        values["scoring_view"][0]["product_count"] = 2
        report = report_for(values)
        self.assertEqual(report["status"], "fail")
        self.assertTrue(any("mv_scoring_distribution" in item for item in report["failures"]))

    def test_missing_confidence_rows_cannot_false_pass(self) -> None:
        values = valid_values()
        values["product_facts"][0]["total_confidence"] = None
        values["product_facts"][0]["confidence_band"] = None
        report = report_for(values)
        self.assertEqual(report["status"], "fail")
        self.assertTrue(any("v_product_confidence is missing" in item for item in report["failures"]))

    def test_allergen_negative_assessment_is_explicitly_unavailable(self) -> None:
        report = report_for()
        metric = report["metrics"]["allergens"]["explicit_no_known_allergens"]
        self.assertIsNone(metric["value"])
        self.assertEqual(metric["availability"], "unavailable")

    def test_query_failure_becomes_a_hard_failure(self) -> None:
        values = valid_values()
        values["required_objects"] = RuntimeError("database unavailable")  # type: ignore[assignment]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / "config.json"
            config_path.write_text(json.dumps(config()), encoding="utf-8")
            exit_code = quiet_run(
                [
                    "--config",
                    str(config_path),
                    "--json-out",
                    str(root / "report.json"),
                    "--markdown-out",
                    str(root / "report.md"),
                ],
                executor=FakeExecutor(values),
            )
            self.assertEqual(exit_code, 1)
            report = json.loads((root / "report.json").read_text(encoding="utf-8"))
            self.assertIn("database unavailable", report["failures"])


class PipelineDeprecationGuardTests(unittest.TestCase):
    def test_missing_deprecation_reason_is_rejected(self) -> None:
        sql = """
        UPDATE products SET is_deprecated = true, ean = null
        WHERE country = 'PL';
        ON CONFLICT (country, brand, product_name) DO NOTHING;
        """
        violations = pipeline_structure._check_step_structure(
            "example", "PIPELINE__example__01_insert_products.sql", "01_insert_products", sql
        )
        self.assertTrue(any("deprecated_reason" in item for item in violations))

    def test_deprecation_with_reason_is_accepted(self) -> None:
        sql = """
        UPDATE products
        SET is_deprecated = true, deprecated_reason = 'Replaced by refresh', ean = null
        WHERE country = 'PL';
        ON CONFLICT (country, brand, product_name) DO NOTHING;
        """
        violations = pipeline_structure._check_step_structure(
            "example", "PIPELINE__example__01_insert_products.sql", "01_insert_products", sql
        )
        self.assertEqual(violations, [])


if __name__ == "__main__":
    unittest.main()
