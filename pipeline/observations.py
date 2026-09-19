"""Lossless, allowlisted OFF observations; no network or database side effects.

The normalized OFF ``_100g`` suffix can mean 100 ml for liquids. Without
explicit source basis we keep it unknown, never infer density from category.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from copy import deepcopy
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation

from pipeline.categories import CATEGORY_POLICY_VERSION

EXTRACTOR_VERSION_V1 = "off-observations-v1"
EXTRACTOR_VERSION = "off-observations-v2"
SUPPORTED_EXTRACTOR_VERSIONS = frozenset({EXTRACTOR_VERSION_V1, EXTRACTOR_VERSION})
NUTRIENTS = {
    "calories_100g": ("energy-kcal", "kcal"),
    "fat_100g": ("fat", "g"),
    "saturated_fat_100g": ("saturated-fat", "g"),
    "trans_fat_100g": ("trans-fat", "g"),
    "carbs_100g": ("carbohydrates", "g"),
    "sugars_100g": ("sugars", "g"),
    "fiber_100g": ("fiber", "g"),
    "protein_100g": ("proteins", "g"),
    "salt_100g": ("salt", "g"),
}
_DECIMAL = re.compile(r"^\s*(<=|>=|<|>|≤|≥|~|≈)?\s*([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?)\s*$")
_MODIFIERS = {"<": "lt", "<=": "lte", "≤": "lte", ">": "gt", ">=": "gte", "≥": "gte", "~": "approx", "≈": "approx"}


def parse_quantity(value: object) -> dict:
    """Keep zero and censoring distinct; reject non-finite/malformed values."""
    if value is None or value == "":
        return {"value": None, "qualifier": None, "state": "missing"}
    text = str(value)
    match = None if isinstance(value, bool) or len(text) > 128 else _DECIMAL.fullmatch(text)
    if match is None:
        return {"value": None, "qualifier": None, "state": "invalid"}
    try:
        number = Decimal(match[2].replace(",", "."))
    except InvalidOperation:
        return {"value": None, "qualifier": None, "state": "invalid"}
    if (
        not number.is_finite()
        or number < 0
        or abs(number.as_tuple().exponent) > 18
        or len(number.as_tuple().digits) > 30
    ):
        return {"value": None, "qualifier": None, "state": "invalid"}
    qualifier = _MODIFIERS.get(match[1], "eq")
    return {"value": format(number, "f"), "qualifier": qualifier, "state": "recorded"}


def _nutrition_basis(raw: dict, extractor_version: str) -> str:
    """Return only a basis explicitly declared by the retained OFF source.

    V1 is preserved byte-for-behaviour for historical replay. V2 never treats
    the normalized ``_100g`` field suffix, category, quantities, or unit alone
    as evidence. A contradictory explicit unit invalidates the declaration but
    a matching unit is not independently sufficient.
    """
    declared = raw.get("nutrition_data_per")
    explicit_unit = raw.get("nutrition_data_per_unit")
    if extractor_version == EXTRACTOR_VERSION_V1:
        basis = {"g": "per_100g", "ml": "per_100ml"}.get(explicit_unit, "unknown")
        return "per_100ml" if declared == "100ml" else basis
    if extractor_version != EXTRACTOR_VERSION:
        raise ValueError("Unsupported OFF observation extractor version")
    declared_basis = {"100g": "per_100g", "100ml": "per_100ml"}.get(declared)
    contradictory_unit = {"g": "per_100g", "ml": "per_100ml"}.get(explicit_unit)
    if declared_basis is None or (contradictory_unit is not None and contradictory_unit != declared_basis):
        return "unknown"
    return declared_basis


def observation_from_off(raw: dict, product: dict, *, extractor_version: str = EXTRACTOR_VERSION) -> dict:
    """Create an immutable-ready record without retaining contributor identities."""
    nutrients = raw.get("nutriments")
    if not isinstance(nutrients, dict):
        nutrients = {}
    # OFF normalized data uses _100g even for liquids. Only the exact retained
    # declaration establishes mass versus volume under the v2 contract.
    explicit_unit = raw.get("nutrition_data_per_unit")
    declared_basis = raw.get("nutrition_data_per")
    basis = _nutrition_basis(raw, extractor_version)
    fields = {}
    sanitized_nutrients = {}
    for logical, (off_name, unit) in NUTRIENTS.items():
        source_field = off_name + "_100g"
        raw_value = nutrients.get(source_field)
        parsed = parse_quantity(raw_value)
        modifier = nutrients.get(off_name + "_modifier")
        if modifier is not None and str(modifier).strip():
            qualifier = _MODIFIERS.get(str(modifier).strip())
            if qualifier is None:
                parsed = {"value": None, "qualifier": None, "state": "invalid"}
            elif parsed["state"] == "recorded":
                if parsed["qualifier"] not in ("eq", qualifier):
                    parsed = {"value": None, "qualifier": None, "state": "conflicting"}
                else:
                    parsed = {**parsed, "qualifier": qualifier}
            sanitized_nutrients[off_name + "_modifier"] = str(modifier)
        fields[logical] = {
            **parsed,
            "unit": unit,
            "basis": basis,
            "preparation_state": "as_sold",
            "source_field": source_field,
            "transformation": "off_normalized_value",
        }
        if isinstance(raw_value, (str, int, float)) and not isinstance(raw_value, bool):
            # Invalid non-finite source values remain named findings, not JSON NaN.
            sanitized_nutrients[source_field] = str(raw_value)
    name_source = (
        "product_name"
        if isinstance(raw.get("product_name"), str) and raw["product_name"].strip()
        else "abbreviated_product_name"
    )
    identity_sources = {
        "product_name": (name_source, "off_product_name_v1"),
        "brand": ("brands", "off_primary_brand_v1"),
        "ean": ("code", "source_string"),
        "category": ("categories_tags", "off_category_v1"),
    }
    for logical, (source_field, transform) in identity_sources.items():
        source = raw.get(source_field)
        present = bool(source.strip()) if isinstance(source, str) else bool(source)
        value = product.get(logical) if present else None
        fields[logical] = {
            "value": value,
            "state": "recorded" if value is not None else "missing",
            "source_field": source_field,
            "transformation": transform,
        }
        if logical == "category":
            fields[logical]["policy_version"] = CATEGORY_POLICY_VERSION
    grade = raw.get("nutriscore_grade")
    grade = (
        grade.strip().upper()
        if isinstance(grade, str) and grade.strip().upper() in "ABCDE" and len(grade.strip()) == 1
        else None
    )
    nova = raw.get("nova_group")
    # OFF commonly uses nova_group; source tags are not a locally inferred group.
    nova = str(nova) if not isinstance(nova, bool) and str(nova) in {"1", "2", "3", "4"} else None
    version = raw.get("nutriscore_version")
    version = str(version) if isinstance(version, (str, int)) and not isinstance(version, bool) else None
    fields["nutri_score_label"] = {
        "value": grade,
        "state": "recorded" if grade else "missing",
        "source_field": "nutriscore_grade",
        "version": version,
        "transformation": "uppercase_source_grade",
    }
    fields["nova_classification"] = {
        "value": nova,
        "state": "recorded" if nova else "missing",
        "source_field": "nova_group",
        "transformation": "source_integer",
    }
    ingredients = _ingredient_assertions(raw.get("ingredients"))
    complete_ingredients = (
        bool(ingredients) and isinstance(raw.get("ingredients"), list) and len(ingredients) == len(raw["ingredients"])
    )
    payload = {
        "code": str(raw.get("code")) if raw.get("code") is not None else None,
        "rev": raw.get("rev"),
        "product_name": raw.get("product_name") if isinstance(raw.get("product_name"), str) else None,
        "abbreviated_product_name": raw.get("abbreviated_product_name")
        if isinstance(raw.get("abbreviated_product_name"), str)
        else None,
        "brands": raw.get("brands") if isinstance(raw.get("brands"), str) else None,
        "categories_tags": _string_tags(raw.get("categories_tags")),
        "nutriments": sanitized_nutrients,
        "nutrition_data_per": declared_basis,
        "nutrition_data_per_unit": explicit_unit,
        "last_modified_t": raw.get("last_modified_t")
        if isinstance(raw.get("last_modified_t"), (str, int, float))
        else None,
        "ingredients_text": product.get("ingredients_raw"),
        "ingredients": ingredients,
        "nutriscore_grade": raw.get("nutriscore_grade") if isinstance(raw.get("nutriscore_grade"), str) else None,
        "nutriscore_version": version,
        "nova_group": raw.get("nova_group")
        if isinstance(raw.get("nova_group"), (str, int)) and not isinstance(raw.get("nova_group"), bool)
        else None,
        "image_front_url": product.get("image_front_url"),
        "allergens_tags": _string_tags(raw.get("allergens_tags")),
        "traces_tags": _string_tags(raw.get("traces_tags")),
    }
    record = {
        "external_id": product.get("ean"),
        "identity": {
            "brand": fields["brand"]["value"],
            "product_name": fields["product_name"]["value"],
            "category": product.get("category"),
            "ean": product.get("ean"),
        },
        "source_revision": product.get("_off_revision"),
        "sanitized_payload": payload,
        "extracted_fields": fields,
        "source_url": "https://world.openfoodfacts.org/product/" + str(product.get("ean", "")),
        "license": "ODbL-1.0; contents DbCL-1.0",
        "retrieved_at": product.get("_fetched_at"),
        "source_updated_at": _source_updated_at(raw.get("last_modified_t")),
        "validation_findings": [
            {"field": key, "reason": "invalid_numeric_or_modifier"}
            for key, val in fields.items()
            if val["state"] in ("invalid", "conflicting")
        ] + [
            {"field": key, "reason": "invalid_allergen_tag"}
            for key in ("allergens_tags", "traces_tags")
            if isinstance(raw.get(key), list)
            and any(not isinstance(tag, str) or not tag.removeprefix("en:").strip() for tag in raw[key])
        ],
        # A positive-only source cannot establish absent allergens. This array
        # is replaced source-locally; raw ingredient completeness stays unknown.
        "allergen_assertions": [
            {"tag": tag.removeprefix("en:"), "type": kind}
            for kind, key in (("contains", "allergens_tags"), ("traces", "traces_tags"))
            for tag in payload[key]
        ],
        "ingredients": ingredients,
        "ingredients_state": "reported" if complete_ingredients else "missing",
        "allergens_state": "reported"
        if isinstance(raw.get("allergens_tags"), list)
        and isinstance(raw.get("traces_tags"), list)
        and (any(tag.removeprefix("en:").strip().lower() not in ("", "none")
                 for tag in payload["allergens_tags"] + payload["traces_tags"]) or complete_ingredients)
        else "missing",
    }
    return seal_observation(record, extractor_version=extractor_version)


def seal_observation(record: dict, *, extractor_version: str | None = None) -> dict:
    """Bind the trusted versioned extractor's outputs to its retained raw inputs.

    SQL validates this equality/lineage; it does not reimplement this parser.
    This is integrity between envelope parts, not authentication of OFF itself.
    """
    sealed = deepcopy(record)
    payload = sealed["sanitized_payload"]
    version = extractor_version or payload.get("extractor_version") or EXTRACTOR_VERSION
    if version not in SUPPORTED_EXTRACTOR_VERSIONS:
        raise ValueError("Unsupported OFF observation extractor version")
    payload["extractor_version"] = version
    payload["extraction"] = deepcopy(sealed["extracted_fields"])
    payload["projected_identity"] = deepcopy(sealed["identity"])
    payload["ingredient_assertions"] = deepcopy(sealed.get("ingredients"))
    payload["allergen_assertions"] = deepcopy(sealed.get("allergen_assertions", []))
    payload["set_states"] = {key: sealed.get(key, "missing") for key in ("ingredients_state", "allergens_state")}
    payload["observation_metadata"] = {
        key: deepcopy(sealed.get(key))
        for key in (
            "source_revision",
            "source_url",
            "license",
            "retrieved_at",
            "source_updated_at",
            "validation_findings",
        )
    }
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    sealed["payload_canonical"] = canonical
    sealed["payload_hash"] = hashlib.sha256(canonical.encode()).hexdigest()
    return sealed


def upgrade_observation_to_v2(record: dict, derivation: dict) -> dict:
    """Derive a v2 observation from one immutable, canonical v1 observation."""
    if record.get("sanitized_payload", {}).get("extractor_version") != EXTRACTOR_VERSION_V1:
        raise ValueError("Basis recovery requires an OFF v1 source observation")
    if hashlib.sha256(record.get("payload_canonical", "").encode()).hexdigest() != record.get("payload_hash"):
        raise ValueError("Source observation payload hash mismatch")
    if json.loads(record["payload_canonical"]) != record["sanitized_payload"]:
        raise ValueError("Source observation canonical payload mismatch")
    upgraded = deepcopy(record)
    basis = _nutrition_basis(upgraded["sanitized_payload"], EXTRACTOR_VERSION)
    for nutrient in NUTRIENTS:
        upgraded["extracted_fields"][nutrient]["basis"] = basis
    upgraded["sanitized_payload"]["derivation"] = deepcopy(derivation)
    return seal_observation(upgraded, extractor_version=EXTRACTOR_VERSION)


def _source_updated_at(value: object) -> str | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return datetime.fromtimestamp(value, UTC).isoformat().replace("+00:00", "Z")
        except (OverflowError, OSError, ValueError):
            pass
    return None


def _ingredient_assertions(value: object) -> list[dict] | None:
    if not isinstance(value, list) or not value:
        return None
    result = []
    for item in value:
        if not isinstance(item, dict):
            continue
        if not any(isinstance(item.get(key), str) and item[key].strip() for key in ("id", "text")):
            continue
        # OFF taxonomy identity is source-reported, not proof of suitability.
        result.append(
            {
                key: item[key]
                for key in ("id", "text", "percent", "percent_estimate")
                if key in item
                and (
                    isinstance(item[key], str)
                    or (
                        isinstance(item[key], (int, float))
                        and not isinstance(item[key], bool)
                        and math.isfinite(item[key])
                    )
                )
            }
        )
    return result or None


def _string_tags(value: object) -> list[str]:
    return [tag for tag in value if isinstance(tag, str)] if isinstance(value, list) else []


def observation_sql(category: str, products: list[dict], country: str) -> str:
    """Emit a transaction; each source revision is retained and applied atomically."""
    from pipeline.sql_generator import _sql_text

    records = []
    for product in products:
        record = dict(product["_source_observation"])
        if not record.get("retrieved_at"):
            raise ValueError("A source observation requires an explicit successful retrieval timestamp")
        record["identity"] = {**record["identity"], "category": category}
        records.append(seal_observation(record))
    versions = {record["sanitized_payload"]["extractor_version"] for record in records}
    if len(versions) != 1:
        raise ValueError("One observation batch cannot mix extractor versions")
    extractor_version = versions.pop()
    digest = hashlib.sha256(json.dumps(records, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    batch = {
        "source_key": "off_api",
        "country": country,
        "extractor_version": extractor_version,
        "idempotency_key": f"{country}:{digest}",
        "scope": {"category": category, "kind": "partial_upsert"},
    }
    batch_sql = _sql_text(json.dumps(batch, ensure_ascii=False)) + "::jsonb"
    statements = ["-- Evidence-first partial import: no deprecation, no rescore.", "BEGIN;"]
    for record in records:
        statements.append(
            "SELECT public.ingestion_apply_observation("
            + batch_sql
            + ", "
            + _sql_text(json.dumps(record, ensure_ascii=False))
            + "::jsonb);"
        )
    statements.extend(["COMMIT;", ""])
    return "\n".join(statements)
