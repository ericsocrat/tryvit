"""Focused deterministic and governance tests for Phase 4D."""

from __future__ import annotations

import hashlib
import json
import unittest
from dataclasses import replace

from pipeline.category_enrichment_report import _historical_compatibility_matches
from pipeline.enrichment import (
    PHASE4B_PATH,
    PHASE4D_PATH,
    IngredientEvidence,
    canonicalize_allergens,
    linkable_matches,
    load_registry,
    match_ingredient,
    match_ingredients,
)
from pipeline.generate_enrichment_pilot import PROJECT_ROOT, build_outputs, load_manifest, parse_snapshot
from pipeline.phase4d_report import _deprecated_allergen_checksum_sql


class Phase4DTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = load_manifest(PHASE4D_PATH)
        cls.registry = load_registry()
        cls.ingredients, cls.allergens, cls.references, _ = parse_snapshot()
        cls.outputs, cls.stats = build_outputs(PHASE4D_PATH)
        cls.report = json.loads(
            (PROJECT_ROOT / "data-quality" / "phase4d" / "report.json").read_text(encoding="utf-8")
        )

    def evidence(
        self,
        text: str,
        *,
        country: str = "PL",
        category: str = "Sweets",
        sub: bool = False,
        parent: str | None = None,
    ) -> IngredientEvidence:
        return IngredientEvidence(
            country=country,
            ean="5900000000001",
            source_text=text,
            position=1,
            is_sub_ingredient=sub,
            parent_source_text=parent,
            category=category,
        )

    def test_selected_batch_is_bounded_and_matches_ranking(self) -> None:
        scopes = {(row["category"], row["country"]) for row in self.manifest["scopes"]}
        self.assertEqual(
            scopes,
            {("Sweets", "PL"), ("Dairy", "PL"), ("Frozen & Prepared", "DE"), ("Meat", "DE")},
        )
        self.assertEqual(self.stats["selected_products"], 805)
        self.assertEqual(self.stats["generated_files"], 4)
        self.assertEqual(self.stats["linked_ingredient_rows"], 11051)
        self.assertEqual(self.stats["canonical_allergen_rows"], 2209)
        self.assertEqual(self.stats["quarantined_matches"], 1)

    def test_each_selected_scope_has_exact_mappings(self) -> None:
        selected = {
            (row["category"], row["country"], row["ean"])
            for row in __import__("csv").DictReader(
                (PROJECT_ROOT / self.manifest["selection_file"]).read_text(encoding="utf-8").splitlines()
            )
        }
        exact_scopes = set()
        category_for = {(country, ean): category for category, country, ean in selected}
        rows = [
            replace(row, category=category_for[(row.country, row.ean)])
            for row in self.ingredients
            if (row.country, row.ean) in category_for
        ]
        for match in match_ingredients(rows, self.references, self.registry):
            if match.classification == "exact":
                exact_scopes.add((match.evidence.category, match.evidence.country))
        self.assertEqual(exact_scopes, {(category, country) for category, country, _ in selected})

    def test_global_and_scoped_alias_rules_remain_authoritative(self) -> None:
        global_alias = match_ingredient(self.evidence("rapeseed"), self.references, self.registry)
        country_category = match_ingredient(
            self.evidence("Trockenmilcherzeugnis aus Sauerrahm", country="DE", category="Dairy"),
            self.references,
            self.registry,
        )
        category_scoped = match_ingredient(
            self.evidence("papryka", country="PL", category="Meat"), self.references, self.registry
        )
        self.assertEqual((global_alias.classification, global_alias.canonical_name), ("alias", "Rapeseed Oil"))
        self.assertEqual(
            (country_category.classification, country_category.canonical_name),
            ("reviewed", "Sour Cream Powder"),
        )
        self.assertEqual(
            (category_scoped.classification, category_scoped.canonical_name),
            ("reviewed", "Paprika Or Bell Pepper"),
        )

    def test_scoped_aliases_do_not_leak_into_phase4d_scopes(self) -> None:
        outside_country = match_ingredient(
            self.evidence("Trockenmilcherzeugnis aus Sauerrahm", country="PL", category="Dairy"),
            self.references,
            self.registry,
        )
        outside_category = match_ingredient(
            self.evidence("papryka", country="PL", category="Sweets"), self.references, self.registry
        )
        self.assertIsNone(outside_country.canonical_name)
        self.assertIsNone(outside_category.canonical_name)

    def test_ambiguous_unknown_and_artifact_tokens_are_withheld(self) -> None:
        starch = match_ingredient(self.evidence("Starch"), self.references, self.registry)
        oil = match_ingredient(self.evidence("Vegetable Oil"), self.references, self.registry)
        unknown = match_ingredient(self.evidence("papryka"), self.references, self.registry)
        artifact = match_ingredient(self.evidence("Kcal"), self.references, self.registry)
        self.assertEqual((starch.classification, oil.classification), ("ambiguous", "ambiguous"))
        self.assertEqual(unknown.classification, "unresolved")
        self.assertEqual(artifact.classification, "quarantined")
        self.assertTrue(all(row.canonical_name is None for row in (starch, oil, unknown, artifact)))

    def test_parent_child_safety_prevents_unsupported_children(self) -> None:
        matches = match_ingredients(
            [
                self.evidence("Vegetable Oil", country="DE", category="Dairy"),
                self.evidence(
                    "rapeseed",
                    country="DE",
                    category="Dairy",
                    sub=True,
                    parent="Vegetable Oil",
                ),
            ],
            self.references,
            self.registry,
        )
        self.assertEqual(linkable_matches(matches, self.registry), [])

    def test_allergen_provenance_and_unknown_semantics_are_separate(self) -> None:
        provenance = self.report["allergen_provenance"]
        self.assertEqual(provenance["explicit_source_contains_records"], 1128)
        self.assertEqual(provenance["explicit_source_may_contain_records"], 1081)
        self.assertEqual(provenance["deterministic_ingredient_derived_records"], 18)
        self.assertEqual(provenance["products_remaining_allergen_unknown"], 128)
        self.assertIs(provenance["missing_evidence_is_allergen_free"], False)
        self.assertEqual(canonicalize_allergens([], self.registry), [])

    def test_generated_outputs_are_idempotent_ordered_and_platform_stable(self) -> None:
        second_outputs, second_stats = build_outputs(PHASE4D_PATH)
        self.assertEqual(self.outputs, second_outputs)
        self.assertEqual(self.stats, second_stats)
        self.assertTrue(all("\r" not in content for content in self.outputs.values()))
        self.assertTrue(all("-- Phase: 4D" in content for content in self.outputs.values()))
        self.assertTrue(
            all(
                "ON CONFLICT" in content and "p.is_deprecated IS NOT TRUE" in content
                for content in self.outputs.values()
            )
        )
        digest = hashlib.sha256(
            "".join(f"{path.as_posix()}\n{self.outputs[path]}" for path in sorted(self.outputs)).encode("utf-8")
        ).hexdigest()
        self.assertEqual(len(digest), 64)

    def test_report_proves_isolation_duplicates_and_rerun_stability(self) -> None:
        checks = self.report["checks"]
        required = {
            "first_run_equals_rerun",
            "no_duplicate_ingredient_keys",
            "no_duplicate_allergen_keys",
            "non_target_links_unchanged",
            "non_target_product_identity_unchanged",
            "deprecated_products_unchanged",
            "phase4b_linkages_unchanged",
            "phase4c_governance_checksum_unchanged",
            "historical_phase4b_artifacts_unchanged",
            "hosted_supabase_writes_absent",
        }
        self.assertTrue(required <= checks.keys())
        self.assertTrue(all(checks[name] for name in required))

    def test_phase4b_and_phase4c_historical_results_are_unchanged(self) -> None:
        _, phase4b_stats = build_outputs(PHASE4B_PATH)
        self.assertEqual(phase4b_stats["selected_products"], 941)
        self.assertEqual(phase4b_stats["linked_ingredient_rows"], 9988)
        self.assertEqual(
            self.report["phase4c_governance_checksum"],
            "c4d400d67c3bc04b45d29331cb9495c45672e3d8b613ead992771203469e0e37",
        )

    def test_phase4b_compatibility_masks_only_legacy_allergen_checksum(self) -> None:
        expected = json.dumps(
            {
                "active_products": 8652,
                "checksums": {
                    "product_allergen_info": "a" * 32,
                    "product_ingredient": "stable-ingredient",
                },
            }
        )
        provenance_variant = json.dumps(
            {
                "active_products": 8652,
                "checksums": {
                    "product_allergen_info": "b" * 32,
                    "product_ingredient": "stable-ingredient",
                },
            }
        )
        ingredient_regression = provenance_variant.replace("stable-ingredient", "changed-ingredient")
        metric_regression = provenance_variant.replace("8652", "8651")
        non_checksum_change = json.dumps({"product_allergen_info": "legacy-b"})

        self.assertTrue(_historical_compatibility_matches(expected, provenance_variant))
        self.assertFalse(_historical_compatibility_matches(expected, ingredient_regression))
        self.assertFalse(_historical_compatibility_matches(expected, metric_regression))
        self.assertFalse(_historical_compatibility_matches(expected, non_checksum_change))

    def test_deprecated_allergen_checksum_uses_canonical_linkage_identity(self) -> None:
        checksum_sql = _deprecated_allergen_checksum_sql()
        self.assertIn("pai.tag,pai.type", checksum_sql)
        self.assertNotIn("source_tag", checksum_sql)

    def test_phase4d_post_processing_refreshes_analytical_views_last(self) -> None:
        post_sql = (PROJECT_ROOT / "db" / "ci_post_phase4d.sql").read_text(encoding="utf-8").rstrip()
        self.assertTrue(post_sql.endswith("SELECT refresh_all_materialized_views();"))


if __name__ == "__main__":
    unittest.main()
