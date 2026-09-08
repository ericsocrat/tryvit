"""Evidence-first import regression contracts; only synthetic fixtures."""

from __future__ import annotations

import hashlib
import json

import pytest

from pipeline.observations import observation_from_off, observation_sql, parse_quantity
from pipeline.off_client import extract_product_data
from pipeline.sql_generator import _gen_01_insert_products, _gen_03_add_nutrition, _sql_num


@pytest.mark.parametrize(
    ("raw", "value", "qualifier", "state"),
    [
        (0, "0", "eq", "recorded"),
        (None, None, None, "missing"),
        ("0,125", "0.125", "eq", "recorded"),
        ("1e-3", "0.001", "eq", "recorded"),
        ("<0.1", "0.1", "lt", "recorded"),
        ("≥2.5", "2.5", "gte", "recorded"),
        ("NaN", None, None, "invalid"),
        (float("inf"), None, None, "invalid"),
        (-1, None, None, "invalid"),
        (True, None, None, "invalid"),
        ("1,000.1", None, None, "invalid"),
    ],
)
def test_quantity_semantics(raw, value, qualifier, state):
    assert parse_quantity(raw) == {"value": value, "qualifier": qualifier, "state": state}


def fixture():
    raw = {
        "product_name": "Test",
        "brands": "Fixture",
        "code": "5903767003176",
        "rev": 4,
        "nutriments": {"energy-kcal_100g": 80, "fat_100g": 1.1234, "proteins_100g": 6, "salt_100g": "<0.01"},
        "creator": "private-contributor",
        "ingredients": [{"id": "en:milk", "text": "milk", "vegan": "unknown"}],
        "allergens_tags": ["en:milk"],
        "last_modified_t": 1700000000,
    }
    product = extract_product_data(raw)
    assert product is not None
    product["_fetched_at"] = "2026-09-05T08:00:00Z"
    product["_source_observation"] = observation_from_off(raw, product)
    return raw, product


def test_precision_qualifiers_unknown_basis_and_sanitized_snapshot():
    raw, product = fixture()
    assert product["total_fat_g"] == "1.1234"
    assert product["salt_g"] is None  # censored value is not an exact nutrient
    record = product["_source_observation"]
    assert record["extracted_fields"]["salt_100g"]["qualifier"] == "lt"
    assert record["extracted_fields"]["fat_100g"]["basis"] == "unknown"
    assert "private-contributor" not in json.dumps(record)
    assert record["payload_hash"] == hashlib.sha256(record["payload_canonical"].encode()).hexdigest()
    assert record["source_updated_at"] == "2023-11-14T22:13:20Z"
    assert record["ingredients"] == [{"id": "en:milk", "text": "milk"}]
    assert record["allergen_assertions"] == [{"tag": "milk", "type": "contains"}]
    raw["nutrition_data_per"] = "100ml"
    assert observation_from_off(raw, product)["extracted_fields"]["fat_100g"]["basis"] == "per_100ml"


def test_real_import_is_atomic_observations_not_rescore_or_retirement():
    _, product = fixture()
    sql = observation_sql("Dairy", [product], "PL")
    assert "ingestion_apply_observation" in sql
    assert "BEGIN;" in sql and "COMMIT;" in sql
    assert "score_category" not in sql and "is_deprecated" not in sql
    assert "creator" not in sql and "private-contributor" not in sql
    product["_source_observation"]["retrieved_at"] = None
    with pytest.raises(ValueError, match="retrieval"):
        observation_sql("Dairy", [product], "PL")


def test_legacy_partial_import_never_removes_unseen_rows():
    _, product = fixture()
    sql = _gen_01_insert_products("Dairy", [product], "2026-09-05", "PL")
    assert "ingestion_upsert_product" in sql
    assert "is_deprecated" not in sql and "ean = null" not in sql.lower()
    assert "delete" not in _gen_03_add_nutrition("Dairy", [product]).lower()


def test_legacy_numbers_never_truncate_exponents_or_qualifiers():
    assert _sql_num("1e-3") == "0.001"
    assert _sql_num("0,25") == "0.25"
    with pytest.raises(ValueError):
        _sql_num("<0.1")
    with pytest.raises(ValueError):
        _sql_num("NaN")


def test_classification_requires_raw_source_fields_not_legacy_product_values():
    raw, product = fixture()
    product["nutri_score_label"] = "A"
    product["nova_classification"] = "1"
    missing = observation_from_off(raw, product)["extracted_fields"]
    assert missing["nutri_score_label"]["state"] == "missing"
    assert missing["nova_classification"]["state"] == "missing"
    raw.update(nutriscore_grade="b", nutriscore_version="2023", nova_group=4)
    source = observation_from_off(raw, product)["extracted_fields"]
    assert source["nutri_score_label"]["value"] == "B"
    assert source["nutri_score_label"]["version"] == "2023"
    assert source["nova_classification"]["value"] == "4"


def test_missing_nutrition_keeps_identity_and_explicit_missing_observations():
    product = extract_product_data(
        {"product_name": "Recorded identity only", "brands": "Fixture", "code": "5903767003176", "nutriments": None}
    )
    assert product is not None
    assert product["calories"] is None
    assert product["_source_observation"]["extracted_fields"]["calories_100g"]["state"] == "missing"


@pytest.mark.parametrize("tag", ["", " ", "en:", None, 3])
def test_malformed_allergen_tags_are_retained_as_invalid_not_collected_absence(tag):
    raw, product = fixture()
    raw.update(allergens_tags=[tag], traces_tags=[], ingredients=None)
    record = observation_from_off(raw, product)
    assert {"field": "allergens_tags", "reason": "invalid_allergen_tag"} in record["validation_findings"]


def test_empty_allergen_defaults_without_ingredients_are_not_collected_absence():
    raw, product = fixture()
    raw.update(allergens_tags=[], traces_tags=[], ingredients=None)
    record = observation_from_off(raw, product)
    assert record["allergens_state"] == "missing"


def test_no_allergen_sentinel_without_ingredients_does_not_clear_positive_evidence():
    raw, product = fixture()
    raw.update(allergens_tags=["en:none"], traces_tags=[], ingredients=None)
    record = observation_from_off(raw, product)
    assert record["allergens_state"] == "missing"
    assert record["sanitized_payload"]["allergens_tags"] == ["en:none"]
    assert record["ingredients_state"] == "missing"


@pytest.mark.parametrize(
    ("modifier", "qualifier", "state"),
    [
        ("<", "lt", "recorded"),
        ("~", "approx", "recorded"),
        ("≈", "approx", "recorded"),
        ("unexpected", None, "invalid"),
    ],
)
def test_off_wire_modifier_is_preserved(modifier, qualifier, state):
    raw, product = fixture()
    raw["nutriments"].update(salt_100g=0.1, salt_modifier=modifier)
    record = observation_from_off(raw, product)
    field = record["extracted_fields"]["salt_100g"]
    assert field["qualifier"] == qualifier
    assert field["state"] == state
    assert record["sanitized_payload"]["nutriments"]["salt_modifier"] == modifier


def test_missing_raw_identity_is_not_fallback_source_evidence():
    raw, product = fixture()
    raw.pop("brands")
    product = extract_product_data(raw)
    assert product is not None
    assert product["brand"] == "Unknown"  # legacy display-only fallback
    record = product["_source_observation"]
    assert record["identity"]["brand"] is None
    assert record["extracted_fields"]["brand"]["state"] == "missing"
    assert record["sanitized_payload"]["brands"] is None
    raw.pop("product_name")
    nameless = extract_product_data(raw)
    assert nameless is not None  # barcode still identifies the source record
    assert nameless["_source_observation"]["identity"]["product_name"] is None
    assert nameless["_source_observation"]["extracted_fields"]["product_name"]["state"] == "missing"


def test_canonical_payload_binds_raw_input_and_every_projected_assertion():
    _, product = fixture()
    record = product["_source_observation"]
    payload = json.loads(record["payload_canonical"])
    assert payload["code"] == record["external_id"] == record["identity"]["ean"]
    assert payload["extraction"] == record["extracted_fields"]
    assert payload["projected_identity"] == record["identity"]
    assert payload["ingredients"] == payload["ingredient_assertions"] == record["ingredients"]
    assert payload["allergen_assertions"] == record["allergen_assertions"]
    assert payload["set_states"]["ingredients_state"] == record["ingredients_state"]
    assert payload["observation_metadata"]["retrieved_at"] == record["retrieved_at"]
