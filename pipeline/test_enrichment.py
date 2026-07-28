"""Focused Phase 4A deterministic enrichment tests."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

import pipeline.sql_generator as sql_generator
from pipeline.enrichment import (
    AllergenEvidence,
    IngredientEvidence,
    canonicalize_allergens,
    evidence_from_products,
    generate_enrichment_sql,
    match_ingredient,
    match_ingredients,
    normalize_token,
)
from pipeline.generate_enrichment_pilot import build_outputs
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

    def test_committed_pilot_outputs_are_reproducible(self) -> None:
        first, first_stats = build_outputs()
        second, second_stats = build_outputs()
        self.assertEqual(first, second)
        self.assertEqual(first_stats, second_stats)
        self.assertEqual(first_stats["pilot_products"], 18)
        self.assertEqual(first_stats["products_with_ingredient_evidence"], 18)
        self.assertTrue(all(path.read_text(encoding="utf-8") == content for path, content in first.items()))

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
        self.assertLess(
            names.index("PIPELINE__chips-de__01_insert_products.sql"),
            names.index("PIPELINE__chips-de__02_enrichment.sql"),
        )
        self.assertLess(
            names.index("PIPELINE__chips-de__02_enrichment.sql"),
            names.index("PIPELINE__chips-de__03_add_nutrition.sql"),
        )


if __name__ == "__main__":
    unittest.main()
