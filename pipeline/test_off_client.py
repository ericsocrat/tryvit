"""Focused provenance and missing-evidence tests for the OFF client."""

from __future__ import annotations

from typing import Any

import pytest

from pipeline import off_client


def _raw_product(**overrides: Any) -> dict[str, Any]:
    product: dict[str, Any] = {
        "code": "5901234123457",
        "product_name": "Test chips",
        "brands": "Test brand",
        "categories_tags": ["en:chips"],
        "nutriments": {
            "energy-kcal_100g": 501,
            "fat_100g": 31.2,
            "proteins_100g": 6,
        },
    }
    product.update(overrides)
    return product


class _ContextSession:
    def __enter__(self) -> object:
        return object()

    def __exit__(self, *_args: object) -> None:
        return None


def test_search_results_capture_successful_fetch_time_without_mutating_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw = _raw_product()
    monkeypatch.setattr(
        off_client,
        "_get_json",
        lambda *_args, **_kwargs: {"products": [raw], "count": 1},
    )
    monkeypatch.setattr(off_client, "_utc_now_iso", lambda: "2026-09-04T16:00:00Z")
    monkeypatch.setattr(off_client.time, "sleep", lambda _seconds: None)

    results: list[dict] = []
    off_client._search_by_tags(object(), ["en:chips"], set(), results, 1)

    assert results[0]["_tryvit_fetched_at"] == "2026-09-04T16:00:00Z"
    assert "_tryvit_fetched_at" not in raw


def test_product_lookup_captures_successful_fetch_time(monkeypatch: pytest.MonkeyPatch) -> None:
    raw = _raw_product(rev=42)
    monkeypatch.setattr(off_client, "_session", _ContextSession)
    monkeypatch.setattr(
        off_client,
        "_get_json",
        lambda *_args, **_kwargs: {"status": 1, "product": raw},
    )
    monkeypatch.setattr(off_client, "_utc_now_iso", lambda: "2026-09-04T16:01:00Z")

    result = off_client.fetch_product_by_ean("5901234123457")

    assert result is not None
    assert result["rev"] == 42
    assert result["_tryvit_fetched_at"] == "2026-09-04T16:01:00Z"
    assert "_tryvit_fetched_at" not in raw


def test_extractor_retains_revision_fetch_time_and_explicit_field_presence() -> None:
    product = _raw_product(
        rev="42",
        _tryvit_fetched_at="2026-09-04T16:02:00Z",
        categories_tags=["en:chips", "en:smoked-products"],
        stores="Lidl",
        ingredients_text="Potatoes, palm oil",
        ingredients=[{"id": "en:potato", "text": "Potatoes"}],
        allergens_tags=["en:milk"],
        traces_tags=["en:nuts"],
        additives_n=0,
        nova_groups_tags=["en:4-ultra-processed-food-and-drink-products"],
        nutriscore_grade="b",
        image_url="https://images.openfoodfacts.org/front.jpg",
        image_front_url="https://images.openfoodfacts.org/front.jpg",
        image_ingredients_url="https://images.openfoodfacts.org/ingredients.jpg",
        image_nutrition_url="https://images.openfoodfacts.org/nutrition.jpg",
        nutriments={
            "energy-kcal_100g": 501,
            "fat_100g": 31.2,
            "saturated-fat_100g": 0,
            "trans-fat_100g": 0,
            "carbohydrates_100g": 50,
            "sugars_100g": 2.5,
            "fiber_100g": 4.1,
            "proteins_100g": 6,
            "salt_100g": 1.2,
        },
    )

    result = off_client.extract_product_data(product)

    assert result is not None
    assert result["_off_revision"] == 42
    assert result["_fetched_at"] == "2026-09-04T16:02:00Z"
    assert result["additives_count"] == 0
    assert result["controversies"] == "palm oil"
    assert result["saturated_fat_g"] == "0.0"
    assert result["trans_fat_g"] == "0.0"
    assert result["_off_fields_present"] == (
        "product_name",
        "brand",
        "ean",
        "category",
        "prep_method",
        "controversies",
        "calories_100g",
        "fat_100g",
        "saturated_fat_100g",
        "trans_fat_100g",
        "carbs_100g",
        "sugars_100g",
        "fiber_100g",
        "protein_100g",
        "salt_100g",
        "nutri_score_label",
        "nova_classification",
        "image_url",
        "image_ingredients_url",
        "image_nutrition_url",
    )


def test_missing_optional_evidence_stays_unknown_instead_of_becoming_zero_or_absence() -> None:
    result = off_client.extract_product_data(_raw_product())

    assert result is not None
    assert result["saturated_fat_g"] is None
    assert result["trans_fat_g"] is None
    assert result["carbs_g"] is None
    assert result["sugars_g"] is None
    assert result["fibre_g"] is None
    assert result["salt_g"] is None
    assert result["additives_count"] is None
    assert result["controversies"] is None
    assert result["_fetched_at"] is None
    assert "saturated_fat_100g" not in result["_off_fields_present"]
    assert "trans_fat_100g" not in result["_off_fields_present"]
    assert "fiber_100g" not in result["_off_fields_present"]
    assert "ingredients_text" not in result["_off_fields_present"]
    assert "allergens" not in result["_off_fields_present"]
    assert "controversies" not in result["_off_fields_present"]


def test_additive_ingredient_allergen_and_store_sets_are_not_certified_as_replaced() -> None:
    result = off_client.extract_product_data(
        _raw_product(
            stores="Unrecognized independent shop",
            ingredients_text="Milk",
            ingredients=[{"id": "en:milk", "text": "Milk"}],
            allergens_tags=["en:milk"],
            traces_tags=["en:nuts"],
        )
    )

    assert result is not None
    assert "store_availability" not in result["_off_fields_present"]
    assert "ingredients_text" not in result["_off_fields_present"]
    assert "allergens" not in result["_off_fields_present"]


def test_explicit_zero_and_explicit_no_palm_oil_remain_distinct_from_missing() -> None:
    result = off_client.extract_product_data(
        _raw_product(
            additives_n="0",
            ingredients_text="Potatoes, sunflower oil",
            nutriments={
                "energy-kcal_100g": 0,
                "fat_100g": 0,
                "proteins_100g": 0,
                "fiber_100g": 0,
                "trans-fat_100g": 0,
            },
        )
    )

    assert result is not None
    assert result["calories"] == "0.0"
    assert result["total_fat_g"] == "0.0"
    assert result["protein_g"] == "0.0"
    assert result["fibre_g"] == "0.0"
    assert result["trans_fat_g"] == "0.0"
    assert result["additives_count"] == 0
    assert result["controversies"] == "none"
    assert "fiber_100g" in result["_off_fields_present"]
    assert "trans_fat_100g" in result["_off_fields_present"]
    assert "controversies" in result["_off_fields_present"]


@pytest.mark.parametrize("revision", [None, 0, -1, "", "0", "-2", "1.5", 3.5, True])
def test_invalid_or_nonpositive_revision_is_not_fabricated(revision: object) -> None:
    result = off_client.extract_product_data(_raw_product(rev=revision))

    assert result is not None
    assert result["_off_revision"] is None


@pytest.mark.parametrize("bad_value", ["unknown", float("nan"), float("inf"), True])
def test_invalid_required_nutrition_rejects_product(bad_value: object) -> None:
    product = _raw_product()
    product["nutriments"] = {
        "energy-kcal_100g": bad_value,
        "fat_100g": 1,
        "proteins_100g": 1,
    }

    assert off_client.extract_product_data(product) is None


def test_invalid_optional_nutrition_remains_unknown_and_has_no_provenance() -> None:
    product = _raw_product(
        nutriments={
            "energy-kcal_100g": 100,
            "fat_100g": 1,
            "proteins_100g": 2,
            "fiber_100g": "unknown",
            "trans-fat_100g": float("nan"),
        }
    )

    result = off_client.extract_product_data(product)

    assert result is not None
    assert result["fibre_g"] is None
    assert result["trans_fat_g"] is None
    assert "fiber_100g" not in result["_off_fields_present"]
    assert "trans_fat_100g" not in result["_off_fields_present"]


def test_untrusted_or_naive_fetch_metadata_is_not_forwarded() -> None:
    invalid = off_client.extract_product_data(
        _raw_product(_tryvit_fetched_at="not-a-timestamp")
    )
    naive = off_client.extract_product_data(
        _raw_product(_tryvit_fetched_at="2026-09-04T16:02:00")
    )

    assert invalid is not None
    assert naive is not None
    assert invalid["_fetched_at"] is None
    assert naive["_fetched_at"] is None


def test_unpersistable_images_and_unknown_nutriscore_do_not_gain_provenance() -> None:
    result = off_client.extract_product_data(
        _raw_product(
            nutriscore_grade="unknown",
            image_front_url="http://images.openfoodfacts.org/front.jpg",
            image_ingredients_url="not-a-url",
            image_nutrition_url=42,
        )
    )

    assert result is not None
    assert result["nutri_score_label"] is None
    assert "nutri_score_label" not in result["_off_fields_present"]
    assert "image_url" not in result["_off_fields_present"]
    assert "image_ingredients_url" not in result["_off_fields_present"]
    assert "image_nutrition_url" not in result["_off_fields_present"]
