"""Focused tests for Phase 4C enrichment governance."""

from __future__ import annotations

import copy
import unittest

from pipeline.enrichment import (
    PHASE4B_PATH,
    IngredientEvidence,
    linkable_matches,
    load_registry,
    match_ingredient,
    match_ingredients,
    validate_registry,
)
from pipeline.enrichment_governance import governed_token_entry
from pipeline.generate_enrichment_pilot import build_outputs, parse_snapshot
from pipeline.governance_report import _derived_allergen_tags, build_report, render_markdown


class EnrichmentGovernanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        _, _, cls.references, _ = parse_snapshot()
        cls.registry = load_registry()

    def evidence(
        self,
        text: str,
        *,
        country: str = "DE",
        category: str = "Dairy",
        position: int = 1,
        is_sub: bool = False,
        parent: str | None = None,
    ) -> IngredientEvidence:
        return IngredientEvidence(
            country=country,
            ean="4000000000000",
            source_text=text,
            position=position,
            is_sub_ingredient=is_sub,
            parent_source_text=parent,
            category=category,
        )

    def test_committed_governance_registry_is_valid(self) -> None:
        validate_registry(self.registry, self.references)

    def test_approved_global_alias(self) -> None:
        result = match_ingredient(self.evidence("rapeseed", country="PL", category="Chips"), self.references)
        self.assertEqual((result.classification, result.canonical_name), ("alias", "Rapeseed Oil"))

    def test_country_scoped_alias_does_not_leak(self) -> None:
        source_text = "Trockenmilcherzeugnis aus Sauerrahm"
        approved = match_ingredient(self.evidence(source_text), self.references)
        outside = match_ingredient(self.evidence(source_text, country="PL"), self.references)
        self.assertEqual((approved.classification, approved.canonical_name), ("reviewed", "Sour Cream Powder"))
        self.assertIsNone(outside.canonical_name)

    def test_category_scoped_alias_does_not_leak(self) -> None:
        approved = match_ingredient(self.evidence("papryka", country="PL", category="Meat"), self.references)
        outside = match_ingredient(self.evidence("papryka", country="PL", category="Drinks"), self.references)
        self.assertEqual((approved.classification, approved.canonical_name), ("reviewed", "Paprika Or Bell Pepper"))
        self.assertIsNone(outside.canonical_name)

    def test_overlapping_scope_conflict_fails_clearly(self) -> None:
        registry = copy.deepcopy(self.registry)
        conflicting = copy.deepcopy(registry["entries"][0])
        conflicting["canonical_ingredient_identity"] = "Sunflower Oil"
        conflicting["country_scope"] = ["DE"]
        registry["entries"].append(conflicting)
        with self.assertRaisesRegex(ValueError, "overlapping governance scopes"):
            validate_registry(registry, self.references)

    def test_circular_alias_relationship_is_rejected(self) -> None:
        registry = copy.deepcopy(self.registry)
        first = copy.deepcopy(registry["entries"][0])
        first.update(
            {
                "raw_source_token": "Rapeseed Oil",
                "normalized_source_token": "rapeseed oil",
                "canonical_ingredient_identity": "Sunflower Oil",
            }
        )
        second = copy.deepcopy(registry["entries"][0])
        second.update(
            {
                "raw_source_token": "Sunflower Oil",
                "normalized_source_token": "sunflower oil",
                "canonical_ingredient_identity": "Rapeseed Oil",
            }
        )
        registry["entries"].extend((first, second))
        with self.assertRaisesRegex(ValueError, "circular governance alias relationship"):
            validate_registry(registry, self.references)

    def test_ambiguous_generic_token_is_withheld(self) -> None:
        result = match_ingredient(self.evidence("Starch"), self.references)
        self.assertEqual(result.classification, "ambiguous")
        self.assertIsNone(result.canonical_name)
        self.assertEqual(result.candidates, ("Corn Starch", "Potato Starch", "Wheat Starch"))

    def test_generic_token_overreach_is_rejected(self) -> None:
        registry = copy.deepcopy(self.registry)
        starch = next(
            entry
            for entry in registry["entries"]
            if entry["normalized_source_token"] == "starch"  # noqa: S105 - ingredient token, not a credential
        )
        starch.update(
            {
                "canonical_ingredient_identity": "Corn Starch",
                "mapping_classification": "approved_alias",
                "review_status": "approved",
                "allergen_derivation_allowed": True,
                "parent_child_inference_allowed": True,
            }
        )
        with self.assertRaisesRegex(ValueError, "generic token cannot map"):
            validate_registry(registry, self.references)

    def test_source_artifact_is_quarantined(self) -> None:
        result = match_ingredient(self.evidence("Kcal 0 8", category="Drinks"), self.references)
        self.assertEqual(result.classification, "quarantined")
        self.assertIsNone(result.canonical_name)

    def test_safe_and_unsafe_parent_child_relationships(self) -> None:
        safe = match_ingredients(
            [
                self.evidence("Water", position=1),
                self.evidence("Rapeseed", position=2, is_sub=True, parent="Water"),
            ],
            self.references,
        )
        self.assertEqual(len(linkable_matches(safe)), 2)
        unsafe = match_ingredients(
            [
                self.evidence("Vegetable Oil", position=1),
                self.evidence("Sunflower", position=2, is_sub=True, parent="Vegetable Oil"),
            ],
            self.references,
        )
        self.assertEqual(linkable_matches(unsafe), [])

    def test_allergen_derivation_permissions_are_explicit(self) -> None:
        starch = governed_token_entry(self.registry, "starch", "DE", "Dairy")
        rapeseed = governed_token_entry(self.registry, "rapeseed", "DE", "Dairy")
        self.assertIs(starch["allergen_derivation_allowed"], False)
        self.assertIs(rapeseed["allergen_derivation_allowed"], True)
        self.assertEqual(_derived_allergen_tags("Wheat Flour"), {"gluten"})

    def test_explicit_and_derived_allergen_provenance_are_separate(self) -> None:
        provenance = build_report()["allergen_provenance"]
        self.assertEqual(provenance["explicit_source_contains_records"], 1278)
        self.assertEqual(provenance["explicit_source_may_contain_records"], 1110)
        self.assertEqual(provenance["deterministic_ingredient_derived_records"], 32)
        self.assertEqual(provenance["total_records_after_provenance_union"], 2420)

    def test_missing_evidence_remains_unknown(self) -> None:
        report = build_report()
        self.assertEqual(report["allergen_provenance"]["products_unknown_due_to_missing_evidence"], 202)
        self.assertIs(report["allergen_provenance"]["missing_evidence_is_allergen_free"], False)
        self.assertEqual(report["drinks_de_analysis"]["selected_products_unknown_due_to_missing_evidence"], 176)

    def test_duplicate_prevention_and_rerun_stability(self) -> None:
        duplicate = self.evidence("Water")
        self.assertEqual(len(match_ingredients([duplicate, duplicate], self.references)), 1)
        self.assertEqual(build_report(), build_report())

    def test_cross_platform_report_is_canonical_lf(self) -> None:
        report = build_report()
        markdown = render_markdown(report)
        self.assertNotIn("\r", markdown)
        self.assertEqual(len(report["governance_checksum_sha256"]), 64)

    def test_phase4b_results_and_generated_sql_are_unchanged(self) -> None:
        outputs, stats = build_outputs(PHASE4B_PATH)
        self.assertEqual(stats["selected_products"], 941)
        self.assertEqual(stats["linked_ingredient_rows"], 9988)
        self.assertEqual(stats["canonical_allergen_rows"], 2388)
        self.assertEqual(stats["ambiguous_matches"], 27)
        self.assertEqual(stats["quarantined_matches"], 2)
        self.assertEqual(stats["parent_safety_withheld"], 11)
        self.assertTrue(all(path.read_text(encoding="utf-8") == content for path, content in outputs.items()))


if __name__ == "__main__":
    unittest.main()
