"""Focused Phase 4A deterministic enrichment tests."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

import pipeline.sql_generator as sql_generator
from pipeline.enrichment import (
    PHASE4B_PATH,
    AllergenEvidence,
    IngredientEvidence,
    canonicalize_allergens,
    enrichment_scopes,
    evidence_from_products,
    generate_enrichment_sql,
    match_ingredient,
    match_ingredients,
    normalize_token,
    taxonomy_backed_reference_names,
    validate_registry,
)
from pipeline.generate_enrichment_pilot import build_outputs, load_manifest
from pipeline.sql_generator import generate_pipeline

REFERENCES = {
    "Water",
    "Rapeseed Oil",
    "Paprika Or Bell Pepper",
    "Corn Starch",
    "Potato Starch",
    "Wheat Starch",
}
REGISTRY = {
    "aliases": {"rapeseed": "Rapeseed Oil"},
    "reviewed": {"papryka": "Paprika Or Bell Pepper"},
    "ambiguous": {"starch": ["Corn Starch", "Potato Starch", "Wheat Starch"]},
    "allergen_aliases": {"nuts": "tree-nuts"},
}


def ingredient(text: str, position: int = 1, *, country: str = "PL") -> IngredientEvidence:
    return IngredientEvidence(country, "5900000000001", text, position)


class EnrichmentTests(unittest.TestCase):
    def test_normalization_is_conservative_and_repeatable(self) -> None:
        self.assertEqual(normalize_token("  RAPESEED—oil_ "), "rapeseed oil")
        self.assertEqual(normalize_token("  RAPESEED—oil_ "), normalize_token("rapeseed-oil"))

    def test_exact_alias_reviewed_unresolved_and_ambiguous_matching(self) -> None:
        self.assertEqual(match_ingredient(ingredient("Water"), REFERENCES, REGISTRY).classification, "exact")
        self.assertEqual(match_ingredient(ingredient("WATER"), REFERENCES, REGISTRY).classification, "alias")
        self.assertEqual(match_ingredient(ingredient("rapeseed"), REFERENCES, REGISTRY).canonical_name, "Rapeseed Oil")
        self.assertEqual(match_ingredient(ingredient("papryka"), REFERENCES, REGISTRY).classification, "reviewed")
        self.assertEqual(
            match_ingredient(ingredient("mystery powder"), REFERENCES, REGISTRY).classification,
            "unresolved",
        )
        ambiguous = match_ingredient(ingredient("starch"), REFERENCES, REGISTRY)
        self.assertEqual(ambiguous.classification, "ambiguous")
        self.assertIsNone(ambiguous.canonical_name)
        self.assertEqual(ambiguous.candidates, ("Corn Starch", "Potato Starch", "Wheat Starch"))

    def test_quarantined_source_artifact_is_never_linkable(self) -> None:
        registry = REGISTRY | {"quarantined": {"kcal": "nutrition-label artifact"}}
        result = match_ingredient(ingredient("KCAL"), REFERENCES | {"KCAL"}, registry)
        self.assertEqual(result.classification, "quarantined")
        self.assertIsNone(result.canonical_name)

    def test_exact_matching_can_require_an_independently_trusted_reference(self) -> None:
        references = REFERENCES | {"2000 Kcal"}
        trusted = REFERENCES

        trusted_exact = match_ingredient(
            ingredient("Water"),
            references,
            REGISTRY,
            exact_reference_names=trusted,
        )
        normalized_alias = match_ingredient(
            ingredient("WATER"),
            references,
            REGISTRY,
            exact_reference_names=trusted,
        )
        untrusted = match_ingredient(
            ingredient("2000 Kcal"),
            references,
            REGISTRY,
            exact_reference_names=trusted,
        )

        self.assertEqual((trusted_exact.classification, trusted_exact.canonical_name), ("exact", "Water"))
        self.assertEqual((normalized_alias.classification, normalized_alias.canonical_name), ("alias", "Water"))
        self.assertEqual(untrusted.classification, "untrusted_reference")
        self.assertIsNone(untrusted.canonical_name)
        self.assertEqual(untrusted.candidates, ("2000 Kcal",))

    def test_taxonomy_metadata_defines_the_conservative_exact_boundary(self) -> None:
        properties = {
            "Water": (False, "yes", "yes", "no"),
            "E250": (True, "unknown", "unknown", "unknown"),
            "2000 Kcal": (False, "unknown", "unknown", "unknown"),
        }

        self.assertEqual(
            taxonomy_backed_reference_names(properties),
            frozenset({"Water", "E250"}),
        )

    def test_exact_reference_boundary_must_be_a_subset(self) -> None:
        with self.assertRaisesRegex(ValueError, "subset of reference names"):
            match_ingredient(
                ingredient("Water"),
                REFERENCES,
                REGISTRY,
                exact_reference_names=REFERENCES | {"outside"},
            )

    def test_conflicting_registry_aliases_are_rejected(self) -> None:
        registry = {
            "aliases": {"water": "Water"},
            "reviewed": {"water": "Water"},
            "ambiguous": {},
            "allergen_aliases": {},
        }
        with self.assertRaisesRegex(ValueError, "conflicting enrichment registry tokens"):
            validate_registry(registry, REFERENCES)

    def test_duplicate_prevention_and_deterministic_ordering(self) -> None:
        evidence = [
            ingredient("Water", 2, country="DE"),
            ingredient("Water", 1),
            ingredient("Water", 1),
        ]
        first = match_ingredients(evidence, REFERENCES, REGISTRY)
        second = match_ingredients(list(reversed(evidence)), REFERENCES, REGISTRY)
        self.assertEqual(first, second)
        self.assertEqual(
            [(row.evidence.country, row.evidence.position) for row in first],
            [("DE", 2), ("PL", 1)],
        )

    def test_declared_trace_unknown_and_duplicate_allergen_semantics(self) -> None:
        evidence = [
            AllergenEvidence("PL", "5900000000001", "en:milk", "contains"),
            AllergenEvidence("PL", "5900000000001", "en:milk", "contains"),
            AllergenEvidence("PL", "5900000000001", "en:nuts", "traces"),
            AllergenEvidence("PL", "5900000000001", "en:milk", "absent"),
        ]
        result = canonicalize_allergens(evidence, REGISTRY)
        self.assertEqual(
            [(row.source_tag, row.kind) for row in result],
            [("en:milk", "contains"), ("en:nuts", "traces")],
        )
        self.assertEqual(canonicalize_allergens([], REGISTRY), [])

    def test_products_without_ingredient_text_remain_unknown(self) -> None:
        products = [
            {
                "ean": "5900000000001",
                "_ingredients": [],
                "_allergens_tags": [],
                "_traces_tags": [],
            }
        ]
        ingredients, allergens = evidence_from_products(products, "PL")
        self.assertEqual(ingredients, [])
        self.assertEqual(allergens, [])

    def test_sql_preserves_country_provenance_and_is_byte_identical(self) -> None:
        matches = match_ingredients([ingredient("Water")], REFERENCES, REGISTRY)
        allergens = [AllergenEvidence("PL", "5900000000001", "en:milk", "contains")]
        first = generate_enrichment_sql("Chips", matches, allergens, "fixture-v1")
        second = generate_enrichment_sql("Chips", list(reversed(matches)), list(reversed(allergens)), "fixture-v1")
        self.assertEqual(first, second)
        self.assertIn("p.country = e.country AND p.ean = e.ean", first)
        self.assertIn("source_tag", first)
        self.assertIn("'en:milk'", first)
        self.assertEqual(first.count("ON CONFLICT"), 3)
        self.assertIn("DO NOTHING", first)
        self.assertNotIn("now()", first.lower())
        self.assertNotIn("UPDATE SET", first.upper())

    def test_phase4e_sql_densely_reindexes_retained_positions_only(self) -> None:
        matches = match_ingredients(
            [
                IngredientEvidence(
                    "PL",
                    "5900000000001",
                    "Rapeseed Oil",
                    4,
                    is_sub_ingredient=True,
                    parent_source_text="Water",
                ),
                ingredient("Water", 7),
            ],
            REFERENCES,
            REGISTRY,
        )
        phase4e = generate_enrichment_sql("Snacks", matches, [], "fixture-v1", phase="4E")
        historical = generate_enrichment_sql("Snacks", matches, [], "fixture-v1", phase="4D")

        self.assertIn("'Water', 1, NULL::numeric", phase4e)
        self.assertIn("'Rapeseed Oil', 2, NULL::numeric", phase4e)
        self.assertIn("'Water', 7, NULL::numeric", historical)
        self.assertIn("'Rapeseed Oil', 4, NULL::numeric", historical)

    def test_committed_pilot_outputs_are_reproducible(self) -> None:
        first, first_stats = build_outputs()
        second, second_stats = build_outputs()
        self.assertEqual(first, second)
        self.assertEqual(first_stats, second_stats)
        self.assertEqual(first_stats["pilot_products"], 18)
        self.assertEqual(first_stats["products_with_ingredient_evidence"], 18)
        self.assertTrue(all(path.read_text(encoding="utf-8") == content for path, content in first.items()))

    def test_generator_rejects_unapproved_manifests(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            outside = Path(temp_dir) / "untrusted.json"
            outside.write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "unsupported enrichment manifest"):
                load_manifest(outside)

    def test_phase4b_outputs_are_bounded_reproducible_and_quarantined(self) -> None:
        first, first_stats = build_outputs(PHASE4B_PATH)
        second, second_stats = build_outputs(PHASE4B_PATH)
        self.assertEqual(first, second)
        self.assertEqual(first_stats, second_stats)
        self.assertEqual(first_stats["selected_products"], 941)
        self.assertEqual(first_stats["generated_files"], 4)
        self.assertEqual(first_stats["ambiguous_matches"], 27)
        self.assertEqual(first_stats["quarantined_matches"], 2)
        self.assertEqual(first_stats["unresolved_matches"], 0)
        self.assertEqual(first_stats["linked_ingredient_rows"], 9988)
        expected_names = {
            "PIPELINE__breakfast-grain-based-de__02_enrichment.sql",
            "PIPELINE__dairy-de__02_enrichment.sql",
            "PIPELINE__drinks-de__02_enrichment.sql",
            "PIPELINE__sweets-de__02_enrichment.sql",
        }
        self.assertEqual({path.name for path in first}, expected_names)
        self.assertTrue(all("-- Phase: 4B" in content for content in first.values()))
        self.assertTrue(all("p.is_deprecated IS NOT TRUE" in content for content in first.values()))
        combined = "\n".join(first.values())
        self.assertNotIn("('Kcal', false", combined)
        self.assertNotIn("('Kcal 0 8', false", combined)

    def test_approved_scopes_include_phase4a_and_only_four_phase4b_scopes(self) -> None:
        scopes = enrichment_scopes()
        phase4b = {
            ("Breakfast & Grain-Based", "DE"),
            ("Dairy", "DE"),
            ("Drinks", "DE"),
            ("Sweets", "DE"),
        }
        self.assertTrue(phase4b <= scopes)
        self.assertEqual(len(phase4b), 4)
        self.assertNotIn(("Sauces", "DE"), scopes)

    def test_standard_generation_emits_ordered_enrichment_output(self) -> None:
        product = {
            "brand": "Test",
            "product_name": "Test chips",
            "ean": "4018077010316",
            "product_type": "Grocery",
            "prep_method": "not-applicable",
            "store_availability": None,
            "controversies": "none",
            "calories": 100,
            "total_fat_g": 1,
            "saturated_fat_g": 0,
            "trans_fat_g": 0,
            "carbs_g": 10,
            "sugars_g": 1,
            "fibre_g": 1,
            "protein_g": 1,
            "salt_g": 0.1,
            "nutri_score_label": "B",
            "nova_group": "2",
            "_ingredients": [{"text": "Water", "id": "en:water"}],
            "_allergens_tags": ["en:milk"],
            "_traces_tags": ["en:nuts"],
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            output = root / "chips-de"
            with mock.patch.object(sql_generator, "PIPELINES_ROOT", root):
                files = generate_pipeline("Chips", [product], str(output), country="DE")
            names = [path.name for path in files]
            enrichment = next(path for path in files if path.name.endswith("__02_enrichment.sql"))
            enrichment_sql = enrichment.read_text(encoding="utf-8")
        self.assertLess(
            names.index("PIPELINE__chips-de__01_insert_products.sql"),
            names.index("PIPELINE__chips-de__02_enrichment.sql"),
        )
        self.assertLess(
            names.index("PIPELINE__chips-de__02_enrichment.sql"),
            names.index("PIPELINE__chips-de__03_add_nutrition.sql"),
        )
        self.assertNotIn("\nBEGIN;\n", enrichment_sql)
        self.assertNotIn("\nCOMMIT;\n", enrichment_sql)

    def test_standard_phase4b_generation_retains_ci_deferral_marker(self) -> None:
        product = {
            "brand": "Test",
            "product_name": "Test dairy",
            "ean": "4018077010316",
            "product_type": "Grocery",
            "prep_method": "not-applicable",
            "store_availability": None,
            "controversies": "none",
            "calories": 100,
            "total_fat_g": 1,
            "saturated_fat_g": 0,
            "trans_fat_g": 0,
            "carbs_g": 10,
            "sugars_g": 1,
            "fibre_g": 1,
            "protein_g": 1,
            "salt_g": 0.1,
            "nutri_score_label": "B",
            "nova_group": "2",
            "_ingredients": [{"text": "Water", "id": "en:water"}],
            "_allergens_tags": ["en:milk"],
            "_traces_tags": [],
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            output = root / "dairy-de"
            with mock.patch.object(sql_generator, "PIPELINES_ROOT", root):
                files = generate_pipeline("Dairy", [product], str(output), country="DE")
            enrichment = next(path for path in files if path.name.endswith("__02_enrichment.sql"))
            content = enrichment.read_text(encoding="utf-8")
        self.assertIn("-- Phase: 4B", content)


if __name__ == "__main__":
    unittest.main()
