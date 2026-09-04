"""SQL file generator for the tryvit pipeline.

Generates the ordered SQL pattern used by every category pipeline:

1. ``PIPELINE__{cat}__01_insert_products.sql``
2. ``PIPELINE__{cat}__02_enrichment.sql`` (Phase 4A pilot categories)
3. ``PIPELINE__{cat}__03_add_nutrition.sql``
4. ``PIPELINE__{cat}__04_scoring.sql``
5. ``PIPELINE__{cat}__05_source_provenance.sql``
6. ``PIPELINE__{cat}__06_add_images.sql``
7. ``PIPELINE__{cat}__07_store_availability.sql``
"""

from __future__ import annotations

import datetime
import hashlib
from pathlib import Path

from pipeline.enrichment import (
    PHASE4B_PATH,
    PHASE4D_PATH,
    PHASE4E_PATH,
    enrichment_scopes,
    evidence_from_products,
    generate_enrichment_sql,
    load_snapshot_reference_names,
    load_snapshot_reference_properties,
    manifest_scopes,
    match_ingredients,
    taxonomy_backed_reference_names,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PIPELINES_ROOT = PROJECT_ROOT / "db" / "pipelines"

# Field names in ``product_field_provenance`` are a stable logical contract,
# not necessarily the physical column names in ``nutrition_facts``.  These
# names are consumed by the comparison/export trust gates.
_DIRECT_OFF_PROVENANCE_FIELDS = frozenset(
    {
        "product_name",
        "brand",
        "ean",
        "category",
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
    }
)

# These fields are replaced or invalidated by every OFF refresh. Ingredient,
# allergen, and store junctions are additive today, so their aggregate claims
# are cleared but never refreshed until those sets can be replaced atomically.
_OFF_REPLACED_PROVENANCE_FIELDS = tuple(
    sorted(
        _DIRECT_OFF_PROVENANCE_FIELDS
        | {
            "prep_method",
            "store_availability",
            "ingredients_text",
            "allergens",
            "controversies",
        }
    )
)

_SCORING_PROVENANCE_FIELDS = (
    "score_model_version",
)

# A refresh mutates these logical fields. If another source owns one of them,
# the atomic category transaction must stop for explicit reconciliation.
_PIPELINE_MUTATED_PROVENANCE_FIELDS = tuple(
    sorted(
        set(_OFF_REPLACED_PROVENANCE_FIELDS)
        | set(_SCORING_PROVENANCE_FIELDS)
        | {
            "product_type",
            "nutri_score_source",
            "unhealthiness_score",
            "data_completeness_pct",
            "confidence",
            "additive_count",
            "additives_count",
            "ingredient_concern_level",
            "ingredients_raw",
            "allergen_tags",
            "calories",
            "total_fat_g",
            "saturated_fat_g",
            "trans_fat_g",
            "carbs_g",
            "sugars_g",
            "fibre_g",
            "protein_g",
            "salt_g",
            "image_front_url",
        }
    )
)


class PipelineOutputPathError(ValueError):
    """Raised when a generated SQL path escapes the trusted pipeline root."""


def _resolve_pipeline_output_dir(output_dir: str | Path) -> Path:
    """Resolve an output directory and require it to stay under db/pipelines."""
    root = PIPELINES_ROOT.resolve()
    try:
        path = Path(output_dir).resolve()
    except (OSError, RuntimeError) as exc:
        raise PipelineOutputPathError(f"Invalid pipeline output directory: {output_dir!s}") from exc
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise PipelineOutputPathError("Refusing to write outside db/pipelines: " + str(output_dir)) from exc
    return path


def _validated_pipeline_output_path(relative_path: str | Path) -> Path:
    """Resolve a relative generated-file path under the trusted pipeline root."""
    requested = Path(relative_path)
    if requested.is_absolute():
        raise PipelineOutputPathError(f"Pipeline output path must be relative: {relative_path!s}")
    if requested == Path("."):
        raise PipelineOutputPathError("Pipeline output path must name a file")

    trusted_root = PIPELINES_ROOT.resolve()
    try:
        candidate = (trusted_root / requested).resolve()
    except (OSError, RuntimeError) as exc:
        raise PipelineOutputPathError(f"Invalid pipeline output path: {relative_path!s}") from exc

    try:
        candidate.relative_to(trusted_root)
    except ValueError as exc:
        raise PipelineOutputPathError(f"Refusing to write outside db/pipelines: {relative_path!s}") from exc
    if candidate == trusted_root:
        raise PipelineOutputPathError("Pipeline output path must name a file")
    return candidate


def _write_pipeline_file(relative_path: str | Path, content: str) -> Path:
    """Validate and write one UTF-8 SQL file below ``PIPELINES_ROOT``."""
    path = _validated_pipeline_output_path(relative_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # S8707's residual flow follows SQL content, not this validated path.
    path.write_text(content, encoding="utf-8")  # NOSONAR
    return path


def _sql_text(value: str | None) -> str:
    """Wrap a value in single quotes, escaping internal apostrophes.

    Returns the SQL literal ``null`` when *value* is ``None``.
    Also normalises Unicode curly quotes (U+2018, U+2019) to straight
    apostrophes so SQL literals never contain invisible encoding surprises.
    """
    if value is None:
        return "null"
    s = str(value)
    # Normalise Unicode curly single-quotes to ASCII apostrophe
    s = s.replace("\u2019", "'").replace("\u2018", "'")
    return "'" + s.replace("'", "''") + "'"


def _sql_num(value: str | float | int | None) -> str:
    """Return a bare numeric literal or a typed SQL ``null``.

    Strips non-numeric characters (except ``-`` and ``.``) so values like
    ``"12.5 g"`` become ``12.5``.
    """
    if value is None:
        return "null::numeric"
    s = str(value).strip()
    if not s:
        return "null::numeric"
    # Strip trailing units / whitespace
    cleaned = ""
    for ch in s:
        if ch in "0123456789.-":
            cleaned += ch
        elif cleaned:
            break
    if not cleaned or cleaned in (".", "-", "-."):
        return "null::numeric"
    return cleaned


def _sql_null_or_text(value: str | None) -> str:
    """Return ``null`` for None / empty, otherwise a quoted text literal."""
    if not value:
        return "null"
    return _sql_text(value)


def _sql_text_array(values: list[str] | tuple[str, ...]) -> str:
    """Return a deterministic PostgreSQL ``text[]`` literal."""
    if not values:
        return "ARRAY[]::text[]"
    return "ARRAY[" + ", ".join(_sql_text(value) for value in values) + "]::text[]"


def _validated_fetched_at(value: object) -> str | None:
    """Validate and normalize an explicit successful-fetch timestamp.

    Missing metadata is allowed for historical/manual generator callers, but a
    supplied timestamp must be an ISO-8601 UTC string.  This keeps a malformed
    fetch signal from becoming database freshness evidence.
    """
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValueError("_fetched_at must be a non-empty ISO-8601 UTC string")
    candidate = value.strip()
    try:
        parsed = datetime.datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("_fetched_at must be a valid ISO-8601 UTC timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != datetime.timedelta(0):
        raise ValueError("_fetched_at must include the UTC timezone")
    return parsed.astimezone(datetime.UTC).isoformat().replace("+00:00", "Z")


def _validated_off_revision(value: object) -> int | None:
    """Return a positive OFF revision, rejecting invalid supplied metadata."""
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError("_off_revision must be a positive integer or None")
    return value


def _explicit_off_fields(product: dict) -> tuple[str, ...]:
    """Return recognized, explicitly source-backed logical field names.

    The extractor contract uses a deterministic tuple.  Accept other ordinary
    collections for compatibility with serialized fixtures, while ignoring
    unknown future keys rather than turning them into provenance claims.
    """
    raw_fields = product.get("_off_fields_present", ())
    if raw_fields is None:
        return ()
    if isinstance(raw_fields, (str, bytes)) or not isinstance(
        raw_fields, (list, tuple, set, frozenset)
    ):
        raise ValueError("_off_fields_present must be a collection of field names")
    return tuple(
        sorted(
            {
                field
                for field in raw_fields
                if isinstance(field, str) and field in _DIRECT_OFF_PROVENANCE_FIELDS
            }
        )
    )


def _identity_key(brand: str, product_name: str) -> str:
    """Compute the same identity_key the DB uses (GENERATED ALWAYS STORED).

    Formula: ``md5(lower(trim(brand)) || '::' || lower(trim(product_name)))``
    """
    raw = f"{brand.lower().strip()}::{product_name.lower().strip()}"
    return hashlib.md5(raw.encode("utf-8"), usedforsecurity=False).hexdigest()


# Recognised Polish retail chains, ordered by market presence.
_POLISH_CHAINS = [
    "Biedronka",
    "Lidl",
    "Żabka",
    "Kaufland",
    "Auchan",
    "Dino",
    "Carrefour",
    "Netto",
    "Stokrotka",
    "Tesco",
    "Lewiatan",
    "Aldi",
    "Penny",
    "Selgros",
    "Delikatesy Centrum",
    "Dealz",
    "Ikea",
    "Rossmann",
]


def _normalize_store(raw: str | None) -> str | None:
    """Extract the primary Polish chain from a raw OFF store string.

    Returns ``None`` when no recognised Polish chain is found.

    .. deprecated::
        Use :func:`_extract_stores` for multi-store extraction feeding
        the ``product_store_availability`` junction table.
    """
    if not raw:
        return None
    low = raw.lower()
    for chain in _POLISH_CHAINS:
        if chain.lower() in low:
            return chain
    return None


# German retail chains, ordered by market presence.
_GERMAN_CHAINS = [
    "Aldi",
    "Lidl",
    "Edeka",
    "REWE",
    "Penny",
    "Netto",
    "Kaufland",
    "dm",
    "Rossmann",
    "Real",
    "Norma",
    "Tegut",
]

# Country → chain list mapping for multi-store extraction
_CHAINS_BY_COUNTRY: dict[str, list[str]] = {
    "PL": _POLISH_CHAINS,
    "DE": _GERMAN_CHAINS,
}


def _extract_stores(raw: str | None, country: str = "PL") -> list[str]:
    """Extract ALL recognised chains from a raw OFF store string.

    Returns a list of matching chain names (may be empty).
    Used to populate ``product_store_availability`` junction table.
    """
    if not raw:
        return []
    low = raw.lower()
    chains = _CHAINS_BY_COUNTRY.get(country, _POLISH_CHAINS)
    return [chain for chain in chains if chain.lower() in low]


# ---------------------------------------------------------------------------
# Individual file generators
# ---------------------------------------------------------------------------


def _gen_01_insert_products(category: str, products: list[dict], today: str, country: str = "PL") -> str:
    """Generate file 01 — insert_products.sql."""
    lines: list[str] = []

    # Values rows
    for i, p in enumerate(products):
        brand = _sql_text(p["brand"])
        name = _sql_text(p["product_name"])
        ean = _sql_text(p.get("ean") or "")
        product_type = _sql_text(p.get("product_type", "Grocery"))
        prep = _sql_null_or_text(p.get("prep_method"))
        store = _sql_null_or_text(_normalize_store(p.get("store_availability")))
        controversies = _sql_text(p.get("controversies", "none"))

        comma = "," if i < len(products) - 1 else ""
        lines.append(
            f"  ({_sql_text(country)}, {brand}, {product_type}, {_sql_text(category)}, "
            f"{name}, {prep}, {store}, {controversies}, {ean}){comma}"
        )

    values_block = "\n".join(lines)

    # Product names for deprecation block
    name_literals = ", ".join(_sql_text(p["product_name"]) for p in products)

    # EAN list for cross-category release
    eans_with_values = [p.get("ean", "") for p in products if p.get("ean")]
    ean_release_block = ""
    if eans_with_values:
        ean_literals = ", ".join(_sql_text(e) for e in eans_with_values)
        ean_release_block = f"""
-- 0b. Release EANs across ALL categories to prevent unique constraint conflicts
update products set ean = null
where ean in ({ean_literals})
  and ean is not null;
"""

    # Identity-key list for cross-category conflict deprecation
    identity_keys = [_identity_key(p["brand"], p["product_name"]) for p in products]
    unique_keys = sorted(set(identity_keys))
    key_literals = ", ".join(_sql_text(k) for k in unique_keys)
    identity_key_block = f"""
-- 0c. Deprecate cross-category products whose identity_key collides with this batch
update products
set is_deprecated = true,
    deprecated_reason = 'Reassigned to {category} by pipeline',
    ean = null
where country = {_sql_text(country)}
  and category != {_sql_text(category)}
  and identity_key in ({key_literals})
  and is_deprecated is not true;
"""

    return f"""\
-- PIPELINE ({category}): insert products
-- Source: Open Food Facts API (automated pipeline)
-- Generated: {today}

-- 0a. DEPRECATE old products in this category & release their EANs
update products
set is_deprecated = true, deprecated_reason = 'Replaced by pipeline refresh', ean = null
where country = {_sql_text(country)}
  and category = {_sql_text(category)}
  and is_deprecated is not true;
{ean_release_block}{identity_key_block}
-- 1. INSERT products
insert into products (country, brand, product_type, category, product_name, prep_method, store_availability, controversies, ean)
values
{values_block}
on conflict (country, brand, product_name) do update set
  category = excluded.category,
  ean = excluded.ean,
  product_type = excluded.product_type,
  store_availability = excluded.store_availability,
  controversies = excluded.controversies,
  prep_method = excluded.prep_method,
  is_deprecated = false;

-- 2. DEPRECATE removed products
update products
set is_deprecated = true, deprecated_reason = 'Removed from pipeline batch'
where country = {_sql_text(country)} and category = {_sql_text(category)}
  and is_deprecated is not true
  and product_name not in ({name_literals});
"""


def _gen_03_add_nutrition(category: str, products: list[dict], country: str = "PL") -> str:
    """Generate file 03 — add_nutrition.sql."""
    nutrition_lines: list[str] = []
    for i, p in enumerate(products):
        brand = _sql_text(p["brand"])
        name = _sql_text(p["product_name"])
        vals = ", ".join(
            _sql_num(p[k])
            for k in (
                "calories",
                "total_fat_g",
                "saturated_fat_g",
                "trans_fat_g",
                "carbs_g",
                "sugars_g",
                "fibre_g",
                "protein_g",
                "salt_g",
            )
        )
        comma = "," if i < len(products) - 1 else ""
        nutrition_lines.append(f"    ({brand}, {name}, {vals}){comma}")

    nutrition_block = "\n".join(nutrition_lines)

    return f"""\
-- PIPELINE ({category}): add nutrition facts
-- Source: Open Food Facts verified per-100g data

-- 1) Remove existing
delete from nutrition_facts
where product_id in (
  select p.product_id
  from products p
  where p.country = {_sql_text(country)} and p.category = {_sql_text(category)}
    and p.is_deprecated is not true
);

-- 2) Insert
insert into nutrition_facts
  (product_id, calories, total_fat_g, saturated_fat_g, trans_fat_g,
   carbs_g, sugars_g, fibre_g, protein_g, salt_g)
select
  p.product_id,
  d.calories, d.total_fat_g, d.saturated_fat_g, d.trans_fat_g,
  d.carbs_g, d.sugars_g, d.fibre_g, d.protein_g, d.salt_g
from (
  values
{nutrition_block}
) as d(brand, product_name, calories, total_fat_g, saturated_fat_g, trans_fat_g,
       carbs_g, sugars_g, fibre_g, protein_g, salt_g)
join products p on p.country = {_sql_text(country)} and p.brand = d.brand and p.product_name = d.product_name
  and p.category = {_sql_text(category)} and p.is_deprecated is not true
on conflict (product_id) do update set
  calories = excluded.calories,
  total_fat_g = excluded.total_fat_g,
  saturated_fat_g = excluded.saturated_fat_g,
  trans_fat_g = excluded.trans_fat_g,
  carbs_g = excluded.carbs_g,
  sugars_g = excluded.sugars_g,
  fibre_g = excluded.fibre_g,
  protein_g = excluded.protein_g,
  salt_g = excluded.salt_g;
"""


def _gen_04_scoring(category: str, products: list[dict], today: str, country: str = "PL") -> str:
    """Generate file 04 — scoring.sql."""

    # (additives_count and ingredients_raw are now derived from
    #  product_ingredient + ingredient_ref junction at query time;
    #  no INSERT/UPDATE to ingredients table needed.)

    # Nutri-Score values
    ns_lines: list[str] = []
    for i, p in enumerate(products):
        ns = p.get("nutri_score_label")
        comma = "," if i < len(products) - 1 else ""
        ns_lines.append(
            f"    ({_sql_text(p['brand'])}, {_sql_text(p['product_name'])}, {_sql_null_or_text(ns)}){comma}"
        )
    nutriscore_block = "\n".join(ns_lines)

    # NOVA values
    nova_lines: list[str] = []
    for i, p in enumerate(products):
        nova_raw = p.get("nova_classification")
        nova = str(nova_raw) if str(nova_raw) in ("1", "2", "3", "4") else None
        comma = "," if i < len(products) - 1 else ""
        nova_lines.append(
            f"    ({_sql_text(p['brand'])}, {_sql_text(p['product_name'])}, "
            f"{_sql_null_or_text(nova)}){comma}"
        )
    nova_block = "\n".join(nova_lines)

    scoring_sql = f"""\
-- PIPELINE ({category}): scoring
-- Generated: {today}

-- 2. Nutri-Score
update products p set
  nutri_score_label = d.ns
from (
  values
{nutriscore_block}
) as d(brand, product_name, ns)
where p.country = {_sql_text(country)} and p.brand = d.brand and p.product_name = d.product_name;

-- 2b. Nutri-Score source provenance (derived from label)
update products p set
  nutri_score_source = case
    when p.nutri_score_label is null            then null
    when p.nutri_score_label = 'NOT-APPLICABLE' then null
    when p.nutri_score_label = 'UNKNOWN'        then 'unknown'
    else 'off_computed'
  end
where p.country = {_sql_text(country)}
  and p.category = {_sql_text(category)}
  and p.is_deprecated is not true;

-- 3. NOVA classification
update products p set
  nova_classification = d.nova
from (
  values
{nova_block}
) as d(brand, product_name, nova)
where p.country = {_sql_text(country)} and p.brand = d.brand and p.product_name = d.product_name;

-- 0/1/4/5. Score category (concern defaults, unhealthiness, flags, confidence)
CALL score_category({_sql_text(category)}, 100, {_sql_text(country)});
"""

    return scoring_sql


def _gen_05_source_provenance(category: str, products: list[dict], today: str, country: str = "PL") -> str:
    """Generate file 05 — source provenance.

    Product-level source/freshness metadata and field-level provenance are
    emitted only for records carrying the extractor's explicit successful-fetch
    signals.  Fallback-normalized values never create provenance by themselves.
    """
    evidence_rows: list[str] = []
    for p in products:
        fetched_at = _validated_fetched_at(p.get("_fetched_at"))
        if fetched_at is None:
            # Historical/manual generator callers have no successful-fetch
            # receipt.  They must not acquire synthetic OFF provenance.
            continue

        revision = _validated_off_revision(p.get("_off_revision"))
        fields = _explicit_off_fields(p)
        ean = str(p.get("ean") or "")
        ean_is_explicit = "ean" in fields and bool(ean)
        source_ean = _sql_text(ean) if ean_is_explicit else "null"
        source_url = (
            _sql_text(f"https://world.openfoodfacts.org/product/{ean}")
            if ean_is_explicit
            else "null"
        )
        raw_fields = set(p.get("_off_fields_present") or ())
        derived_fields = [
            field
            for field in ("prep_method", "controversies")
            if field in raw_fields
        ]
        evidence_rows.append(
            "    ("
            + ", ".join(
                (
                    _sql_text(p["brand"]),
                    _sql_text(p["product_name"]),
                    source_url,
                    source_ean,
                    f"{_sql_text(fetched_at)}::timestamptz",
                    "null::integer" if revision is None else str(revision),
                    _sql_text_array(fields),
                    _sql_text_array(derived_fields),
                )
            )
            + ")"
        )

    if not evidence_rows:
        return f"""\
-- PIPELINE ({category}): source provenance
-- Generated: {today}

-- No explicit successful-fetch metadata was supplied.  Source, freshness,
-- revision, and field-level provenance intentionally remain unchanged.
"""

    evidence_block = ",\n".join(evidence_rows)
    replaced_fields = _sql_text_array(_OFF_REPLACED_PROVENANCE_FIELDS)
    derived_refresh_fields = _sql_text_array(
        ("prep_method", "controversies", *_SCORING_PROVENANCE_FIELDS)
    )
    mutated_fields = _sql_text_array(_PIPELINE_MUTATED_PROVENANCE_FIELDS)

    return f"""\
-- PIPELINE ({category}): source provenance and freshness
-- Generated: {today}
-- Only extractor-confirmed fields receive OFF provenance.

-- 0. Fail closed before this atomic category transaction can replace a value
-- owned by a different source. Such rows require explicit reconciliation.
DO $provenance_guard$
DECLARE
  conflicting_record record;
BEGIN
  WITH fetch_evidence(
    brand, product_name, source_url, source_ean, fetched_at, off_revision,
    direct_fields, derived_fields
  ) AS (
    VALUES
{evidence_block}
  )
  SELECT conflict.product_id, conflict.field_name, conflict.source_type
  INTO conflicting_record
  FROM (
    SELECT p.product_id, 'source_type'::text AS field_name, p.source_type
    FROM fetch_evidence d
    JOIN products p ON p.country = {_sql_text(country)}
      AND p.brand = d.brand AND p.product_name = d.product_name
    WHERE p.source_type IS NOT NULL
      AND p.source_type NOT IN ('off_api', 'off_search')

    UNION ALL

    SELECT p.product_id, pf.field_name, pf.source_type
    FROM fetch_evidence d
    JOIN products p ON p.country = {_sql_text(country)}
      AND p.brand = d.brand AND p.product_name = d.product_name
    JOIN product_field_provenance pf ON pf.product_id = p.product_id
    WHERE pf.field_name = ANY({mutated_fields})
      AND pf.source_type NOT IN ('off_api', 'derived_calculation')
  ) AS conflict
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING MESSAGE = format(
      'Pipeline refresh requires source reconciliation for product %s field %s owned by %s',
      conflicting_record.product_id,
      conflicting_record.field_name,
      conflicting_record.source_type
    );
  END IF;
END
$provenance_guard$;

-- 1. Update product-level source and successful-fetch metadata.
WITH fetch_evidence(
  brand, product_name, source_url, source_ean, fetched_at, off_revision,
  direct_fields, derived_fields
) AS (
  VALUES
{evidence_block}
)
UPDATE products p SET
  source_type = 'off_api',
  source_url = d.source_url,
  source_ean = d.source_ean,
  last_fetched_at = d.fetched_at,
  off_revision = d.off_revision
FROM fetch_evidence d
WHERE p.country = {_sql_text(country)} AND p.brand = d.brand
  AND p.product_name = d.product_name
  AND p.category = {_sql_text(category)} AND p.is_deprecated IS NOT TRUE;

-- 2. Clear prior OFF claims for fields this refresh replaces.  Additive
-- ingredient/allergen evidence is retained when the new response omits it.
WITH fetch_evidence(
  brand, product_name, source_url, source_ean, fetched_at, off_revision,
  direct_fields, derived_fields
) AS (
  VALUES
{evidence_block}
)
DELETE FROM product_field_provenance pf
USING products p, fetch_evidence d
WHERE pf.product_id = p.product_id
  AND p.country = {_sql_text(country)} AND p.brand = d.brand
  AND p.product_name = d.product_name
  AND p.category = {_sql_text(category)} AND p.is_deprecated IS NOT TRUE
  AND pf.source_type = 'off_api'
  AND pf.field_name = ANY({replaced_fields});

-- 3. Record only explicitly present OFF fields, using fetch time rather than
-- SQL execution time as the evidence timestamp.
WITH fetch_evidence(
  brand, product_name, source_url, source_ean, fetched_at, off_revision,
  direct_fields, derived_fields
) AS (
  VALUES
{evidence_block}
)
INSERT INTO product_field_provenance (
  product_id, field_name, source_type, source_url, confidence,
  verified_at, verified_by, notes, recorded_at
)
SELECT
  p.product_id,
  field_name,
  'off_api',
  d.source_url,
  source.base_confidence,
  null,
  null,
  'Automated ingestion from explicit Open Food Facts evidence',
  d.fetched_at
FROM fetch_evidence d
JOIN products p ON p.country = {_sql_text(country)} AND p.brand = d.brand
  AND p.product_name = d.product_name
  AND p.category = {_sql_text(category)} AND p.is_deprecated IS NOT TRUE
CROSS JOIN LATERAL unnest(d.direct_fields) AS field_name
JOIN data_sources source ON source.source_key = 'off_api'
ON CONFLICT (product_id, field_name) DO UPDATE SET
  source_type = excluded.source_type,
  source_url = excluded.source_url,
  confidence = excluded.confidence,
  verified_at = excluded.verified_at,
  verified_by = excluded.verified_by,
  notes = excluded.notes,
  recorded_at = excluded.recorded_at
WHERE product_field_provenance.source_type = excluded.source_type;

-- 4. Refresh provenance for deterministic values produced from the current
-- source cohort, then record only values that actually exist.
WITH fetch_evidence(
  brand, product_name, source_url, source_ean, fetched_at, off_revision,
  direct_fields, derived_fields
) AS (
  VALUES
{evidence_block}
)
DELETE FROM product_field_provenance pf
USING products p, fetch_evidence d
WHERE pf.product_id = p.product_id
  AND p.country = {_sql_text(country)} AND p.brand = d.brand
  AND p.product_name = d.product_name
  AND p.category = {_sql_text(category)} AND p.is_deprecated IS NOT TRUE
  AND pf.source_type = 'derived_calculation'
  AND pf.field_name = ANY({derived_refresh_fields});

WITH fetch_evidence(
  brand, product_name, source_url, source_ean, fetched_at, off_revision,
  direct_fields, derived_fields
) AS (
  VALUES
{evidence_block}
)
INSERT INTO product_field_provenance (
  product_id, field_name, source_type, source_url, confidence,
  verified_at, verified_by, notes, recorded_at
)
SELECT
  p.product_id,
  derived.field_name,
  'derived_calculation',
  d.source_url,
  source.base_confidence,
  null,
  null,
  'Deterministically derived during the same atomic OFF refresh',
  d.fetched_at
FROM fetch_evidence d
JOIN products p ON p.country = {_sql_text(country)} AND p.brand = d.brand
  AND p.product_name = d.product_name
  AND p.category = {_sql_text(category)} AND p.is_deprecated IS NOT TRUE
CROSS JOIN LATERAL (
  VALUES
    ('prep_method', CASE WHEN 'prep_method' = ANY(d.derived_fields) THEN to_jsonb(p.prep_method) END),
    ('controversies', CASE WHEN 'controversies' = ANY(d.derived_fields) THEN to_jsonb(p.controversies) END),
    ('score_model_version', to_jsonb(p.score_model_version))
) AS derived(field_name, field_value)
JOIN data_sources source ON source.source_key = 'derived_calculation'
WHERE derived.field_value IS NOT NULL
  AND derived.field_value <> 'null'::jsonb
ON CONFLICT (product_id, field_name) DO UPDATE SET
  source_type = excluded.source_type,
  source_url = excluded.source_url,
  confidence = excluded.confidence,
  verified_at = excluded.verified_at,
  verified_by = excluded.verified_by,
  notes = excluded.notes,
  recorded_at = excluded.recorded_at
WHERE product_field_provenance.source_type = excluded.source_type;

-- score_category refreshed this view before source_type was updated above.
-- Refresh it again after provenance so the committed view matches the cohort.
REFRESH MATERIALIZED VIEW CONCURRENTLY v_product_confidence;
"""


def _gen_06_add_images(category: str, products: list[dict], today: str, country: str = "PL") -> str:
    """Generate file 06 — add product images.

    Inserts image URLs from the OFF API into the ``product_images`` table.
    Each product can have up to 3 images: front, ingredients, nutrition_label.
    """
    # Gather products that have image URLs
    image_rows: list[str] = []
    for p in products:
        ean = p.get("ean") or ""
        if not ean:
            continue

        brand = _sql_text(p["brand"])
        name = _sql_text(p["product_name"])

        # Try each image type
        for off_key, image_type in [
            ("image_front_url", "front"),
            ("image_ingredients_url", "ingredients"),
            ("image_nutrition_url", "nutrition_label"),
        ]:
            url = p.get(off_key)
            if not url or not url.startswith("https://"):
                continue

            is_primary = "true" if image_type == "front" else "false"
            off_id = _sql_text(f"{image_type}_{ean}")
            alt = _sql_text(f"{image_type.replace('_', ' ').title()} — EAN {ean}")

            image_rows.append(
                f"    ({brand}, {name}, {_sql_text(url)}, 'off_api', "
                f"{_sql_text(image_type)}, {is_primary}, {alt}, {off_id})"
            )

    if not image_rows:
        return f"""\
-- PIPELINE ({category}): add product images
-- Generated: {today}

-- No product images available from OFF API for this category.
"""

    image_block = ",\n".join(image_rows)

    return f"""\
-- PIPELINE ({category}): add product images
-- Source: Open Food Facts API image URLs
-- Generated: {today}

-- 1. Remove existing OFF images for this category
DELETE FROM product_images
WHERE source = 'off_api'
  AND product_id IN (
    SELECT p.product_id FROM products p
    WHERE p.country = {_sql_text(country)} AND p.category = {_sql_text(category)}
      AND p.is_deprecated IS NOT TRUE
  );

-- 2. Insert images
INSERT INTO product_images
  (product_id, url, source, image_type, is_primary, alt_text, off_image_id)
SELECT
  p.product_id, d.url, d.source, d.image_type, d.is_primary, d.alt_text, d.off_image_id
FROM (
  VALUES
{image_block}
) AS d(brand, product_name, url, source, image_type, is_primary, alt_text, off_image_id)
JOIN products p ON p.country = {_sql_text(country)} AND p.brand = d.brand AND p.product_name = d.product_name
  AND p.category = {_sql_text(category)} AND p.is_deprecated IS NOT TRUE
ON CONFLICT (off_image_id) WHERE off_image_id IS NOT NULL DO UPDATE SET
  url = EXCLUDED.url,
  image_type = EXCLUDED.image_type,
  is_primary = EXCLUDED.is_primary,
  alt_text = EXCLUDED.alt_text;
"""


def _gen_07_store_availability(category: str, products: list[dict], today: str, country: str = "PL") -> str:
    """Generate file 07 — store availability junction inserts."""
    rows: list[str] = []
    for p in products:
        stores = _extract_stores(p.get("store_availability"), country)
        if not stores:
            continue
        brand = _sql_text(p["brand"])
        name = _sql_text(p["product_name"])
        for store_name in stores:
            rows.append(f"    ({brand}, {name}, {_sql_text(store_name)})")

    if not rows:
        return f"""\
-- PIPELINE ({category}): store availability
-- Generated: {today}

-- No store availability data found for this category.
"""

    values_block = ",\n".join(rows)

    return f"""\
-- PIPELINE ({category}): store availability
-- Source: Open Food Facts API store field
-- Generated: {today}

INSERT INTO product_store_availability (product_id, store_id, verified_at, source)
SELECT
  p.product_id,
  sr.store_id,
  NOW(),
  'pipeline'
FROM (
  VALUES
{values_block}
) AS d(brand, product_name, store_name)
JOIN products p ON p.country = {_sql_text(country)} AND p.brand = d.brand AND p.product_name = d.product_name
  AND p.category = {_sql_text(category)} AND p.is_deprecated IS NOT TRUE
JOIN store_ref sr ON sr.country = {_sql_text(country)} AND sr.store_name = d.store_name AND sr.is_active = true
ON CONFLICT (product_id, store_id) DO NOTHING;
"""


# ---------------------------------------------------------------------------
# Batching support
# ---------------------------------------------------------------------------

BATCH_SIZE = 100


def _chunk(items: list, size: int) -> list[list]:
    """Split *items* into chunks of at most *size* elements."""
    return [items[i : i + size] for i in range(0, len(items), size)]


def _gen_01_batch(
    category: str,
    batch_products: list[dict],
    all_products: list[dict],
    today: str,
    country: str,
    batch_num: int,
    total_batches: int,
    batch_start: int,
    batch_end: int,
) -> str:
    """Generate one batch file for step 01 (insert products).

    Batch 1 includes preamble (deprecation, EAN release, cross-category).
    Last batch includes postscript (deprecate removed products).
    All batches include an INSERT with ON CONFLICT.
    """
    parts: list[str] = [
        f"-- PIPELINE ({category}): insert products",
        f"-- Batch {batch_num}/{total_batches}: products {batch_start}-{batch_end}",
        "-- Source: Open Food Facts API (automated pipeline)",
        f"-- Generated: {today}",
    ]

    # ── Preamble (first batch only) ──────────────────────────────────────
    if batch_num == 1:
        parts.append(f"""
-- 0a. DEPRECATE old products in this category & release their EANs
update products
set is_deprecated = true, deprecated_reason = 'Replaced by pipeline refresh', ean = null
where country = {_sql_text(country)}
  and category = {_sql_text(category)}
  and is_deprecated is not true;""")

        eans = [p.get("ean", "") for p in all_products if p.get("ean")]
        if eans:
            ean_literals = ", ".join(_sql_text(e) for e in eans)
            parts.append(f"""
-- 0b. Release EANs across ALL categories to prevent unique constraint conflicts
update products set ean = null
where ean in ({ean_literals})
  and ean is not null;""")

        keys = sorted({_identity_key(p["brand"], p["product_name"]) for p in all_products})
        key_literals = ", ".join(_sql_text(k) for k in keys)
        parts.append(f"""
-- 0c. Deprecate cross-category products whose identity_key collides with this batch
update products
set is_deprecated = true,
    deprecated_reason = 'Reassigned to {category} by pipeline',
    ean = null
where country = {_sql_text(country)}
  and category != {_sql_text(category)}
  and identity_key in ({key_literals})
  and is_deprecated is not true;""")

    # ── INSERT block ─────────────────────────────────────────────────────
    lines: list[str] = []
    for i, p in enumerate(batch_products):
        brand = _sql_text(p["brand"])
        name = _sql_text(p["product_name"])
        ean = _sql_text(p.get("ean") or "")
        product_type = _sql_text(p.get("product_type", "Grocery"))
        prep = _sql_null_or_text(p.get("prep_method"))
        store = _sql_null_or_text(_normalize_store(p.get("store_availability")))
        controversies = _sql_text(p.get("controversies", "none"))
        comma = "," if i < len(batch_products) - 1 else ""
        lines.append(
            f"  ({_sql_text(country)}, {brand}, {product_type}, {_sql_text(category)}, "
            f"{name}, {prep}, {store}, {controversies}, {ean}){comma}"
        )
    values_block = "\n".join(lines)

    parts.append(f"""
-- 1. INSERT products (batch {batch_num}/{total_batches})
insert into products (country, brand, product_type, category, product_name, prep_method, store_availability, controversies, ean)
values
{values_block}
on conflict (country, brand, product_name) do update set
  category = excluded.category,
  ean = excluded.ean,
  product_type = excluded.product_type,
  store_availability = excluded.store_availability,
  controversies = excluded.controversies,
  prep_method = excluded.prep_method,
  is_deprecated = false;""")

    # ── Postscript (last batch only) ─────────────────────────────────────
    if batch_num == total_batches:
        name_literals = ", ".join(_sql_text(p["product_name"]) for p in all_products)
        parts.append(f"""
-- 2. DEPRECATE removed products
update products
set is_deprecated = true, deprecated_reason = 'Removed from pipeline batch'
where country = {_sql_text(country)} and category = {_sql_text(category)}
  and is_deprecated is not true
  and product_name not in ({name_literals});""")

    parts.append("")  # trailing newline
    return "\n".join(parts)


def _gen_03_batch(
    category: str,
    batch_products: list[dict],
    country: str,
    batch_num: int,
    total_batches: int,
    batch_start: int,
    batch_end: int,
) -> str:
    """Generate one batch file for step 03 (add nutrition).

    Batch 1 includes the DELETE (clean existing rows).
    All batches include an INSERT with ON CONFLICT.
    """
    nutrition_lines: list[str] = []
    for i, p in enumerate(batch_products):
        brand = _sql_text(p["brand"])
        name = _sql_text(p["product_name"])
        vals = ", ".join(
            _sql_num(p[k])
            for k in (
                "calories",
                "total_fat_g",
                "saturated_fat_g",
                "trans_fat_g",
                "carbs_g",
                "sugars_g",
                "fibre_g",
                "protein_g",
                "salt_g",
            )
        )
        comma = "," if i < len(batch_products) - 1 else ""
        nutrition_lines.append(f"    ({brand}, {name}, {vals}){comma}")
    nutrition_block = "\n".join(nutrition_lines)

    parts: list[str] = [
        f"-- PIPELINE ({category}): add nutrition facts",
        f"-- Batch {batch_num}/{total_batches}: products {batch_start}-{batch_end}",
        "-- Source: Open Food Facts verified per-100g data",
    ]

    # DELETE existing — only in first batch
    if batch_num == 1:
        parts.append(f"""
-- 1) Remove existing
delete from nutrition_facts
where product_id in (
  select p.product_id
  from products p
  where p.country = {_sql_text(country)} and p.category = {_sql_text(category)}
    and p.is_deprecated is not true
);""")

    parts.append(f"""
-- 2) Insert (batch {batch_num}/{total_batches})
insert into nutrition_facts
  (product_id, calories, total_fat_g, saturated_fat_g, trans_fat_g,
   carbs_g, sugars_g, fibre_g, protein_g, salt_g)
select
  p.product_id,
  d.calories, d.total_fat_g, d.saturated_fat_g, d.trans_fat_g,
  d.carbs_g, d.sugars_g, d.fibre_g, d.protein_g, d.salt_g
from (
  values
{nutrition_block}
) as d(brand, product_name, calories, total_fat_g, saturated_fat_g, trans_fat_g,
       carbs_g, sugars_g, fibre_g, protein_g, salt_g)
join products p on p.country = {_sql_text(country)} and p.brand = d.brand and p.product_name = d.product_name
  and p.category = {_sql_text(category)} and p.is_deprecated is not true
on conflict (product_id) do update set
  calories = excluded.calories,
  total_fat_g = excluded.total_fat_g,
  saturated_fat_g = excluded.saturated_fat_g,
  trans_fat_g = excluded.trans_fat_g,
  carbs_g = excluded.carbs_g,
  sugars_g = excluded.sugars_g,
  fibre_g = excluded.fibre_g,
  protein_g = excluded.protein_g,
  salt_g = excluded.salt_g;""")

    parts.append("")  # trailing newline
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def generate_pipeline(
    category: str,
    products: list[dict],
    output_dir: str,
    country: str = "PL",
    batch_size: int = BATCH_SIZE,
) -> list[Path]:
    """Generate SQL pipeline files for *category* in *country*.

    When ``len(products) > batch_size``, steps 01 and 03 are split into
    multiple batch files.  Steps 04--07 always produce a single file.

    Parameters
    ----------
    category:
        Database category name (e.g. ``"Dairy"``).
    products:
        List of validated, normalised product dicts.
    output_dir:
        Directory to write the SQL files into.
    country:
        ISO 3166-1 alpha-2 country code (default ``"PL"``).
    batch_size:
        Maximum products per batch file (default ``BATCH_SIZE``).
        Set to ``0`` to disable batching.

    Returns
    -------
    list[Path]
        Paths of the generated files.
    """
    out = _resolve_pipeline_output_dir(output_dir)
    relative_out = out.relative_to(PIPELINES_ROOT.resolve())

    # Use the directory name as the file slug so that files inside
    # ``dairy-de/`` are named ``PIPELINE__dairy-de__*`` (matches
    # check_pipeline_structure.py expectations).
    slug = out.name
    today = datetime.date.today().isoformat()

    files: list[Path] = []
    use_batching = batch_size > 0 and len(products) > batch_size

    # Step 02 is intentionally limited to approved Phase 4 category scopes.  Its input
    # comes from the same normalized product payload as steps 01/03, and the
    # reference vocabulary is a committed snapshot rather than a live API.
    if (category, country) in enrichment_scopes():
        ingredient_evidence, allergen_evidence = evidence_from_products(products, country, category)
        phase = (
            "4B"
            if (category, country) in manifest_scopes(PHASE4B_PATH)
            else "4D"
            if (category, country) in manifest_scopes(PHASE4D_PATH)
            else "4E"
            if (category, country) in manifest_scopes(PHASE4E_PATH)
            else None
        )
        references = load_snapshot_reference_names()
        matches = match_ingredients(
            ingredient_evidence,
            references,
            exact_reference_names=(
                taxonomy_backed_reference_names(load_snapshot_reference_properties())
                if phase == "4E"
                else references
            ),
        )
        path02 = _write_pipeline_file(
            relative_out / f"PIPELINE__{slug}__02_enrichment.sql",
            generate_enrichment_sql(
                category,
                matches,
                allergen_evidence,
                "normalized pipeline input (Open Food Facts explicit evidence)",
                phase=phase,
                include_transaction=False,
            ),
        )
    else:
        path02 = None

    if use_batching:
        chunks = _chunk(products, batch_size)
        total_batches = len(chunks)

        # Clean up stale single-file or old batch versions
        for old in out.glob(f"PIPELINE__{slug}__01_insert_products.sql"):
            old.unlink()
        for old in out.glob(f"PIPELINE__{slug}__01_batch_*_insert_products.sql"):
            old.unlink()
        for old in out.glob(f"PIPELINE__{slug}__03_add_nutrition.sql"):
            old.unlink()
        for old in out.glob(f"PIPELINE__{slug}__03_batch_*_add_nutrition.sql"):
            old.unlink()

        # 01 — batched insert products
        offset = 0
        for batch_num, chunk in enumerate(chunks, 1):
            batch_start = offset + 1
            batch_end = offset + len(chunk)
            offset += len(chunk)
            path = _write_pipeline_file(
                relative_out / f"PIPELINE__{slug}__01_batch_{batch_num:03d}_insert_products.sql",
                _gen_01_batch(
                    category,
                    chunk,
                    products,
                    today,
                    country,
                    batch_num,
                    total_batches,
                    batch_start,
                    batch_end,
                ),
            )
            files.append(path)

        # 03 — batched add nutrition
        offset = 0
        for batch_num, chunk in enumerate(chunks, 1):
            batch_start = offset + 1
            batch_end = offset + len(chunk)
            offset += len(chunk)
            path = _write_pipeline_file(
                relative_out / f"PIPELINE__{slug}__03_batch_{batch_num:03d}_add_nutrition.sql",
                _gen_03_batch(
                    category,
                    chunk,
                    country,
                    batch_num,
                    total_batches,
                    batch_start,
                    batch_end,
                ),
            )
            files.append(path)
    else:
        # Clean up stale batch files from previous runs
        for old in out.glob(f"PIPELINE__{slug}__01_batch_*_insert_products.sql"):
            old.unlink()
        for old in out.glob(f"PIPELINE__{slug}__03_batch_*_add_nutrition.sql"):
            old.unlink()

        # 01 — single insert products
        path01 = _write_pipeline_file(
            relative_out / f"PIPELINE__{slug}__01_insert_products.sql",
            _gen_01_insert_products(category, products, today, country),
        )
        files.append(path01)

        if path02 is not None:
            files.append(path02)

        # 03 — single add nutrition
        path03 = _write_pipeline_file(
            relative_out / f"PIPELINE__{slug}__03_add_nutrition.sql",
            _gen_03_add_nutrition(category, products, country),
        )
        files.append(path03)

    if use_batching and path02 is not None:
        # All 01 batches must execute before the single enrichment file.
        insert_at = sum("__01_" in path.name for path in files)
        files.insert(insert_at, path02)

    # 04 — scoring (always single file)
    path04 = _write_pipeline_file(
        relative_out / f"PIPELINE__{slug}__04_scoring.sql",
        _gen_04_scoring(category, products, today, country),
    )
    files.append(path04)

    # 05 — source provenance (always single file)
    path05 = _write_pipeline_file(
        relative_out / f"PIPELINE__{slug}__05_source_provenance.sql",
        _gen_05_source_provenance(category, products, today, country),
    )
    files.append(path05)

    # 06 — add images (always single file)
    path06 = _write_pipeline_file(
        relative_out / f"PIPELINE__{slug}__06_add_images.sql",
        _gen_06_add_images(category, products, today, country),
    )
    files.append(path06)

    # 07 — store availability (always single file)
    path07 = _write_pipeline_file(
        relative_out / f"PIPELINE__{slug}__07_store_availability.sql",
        _gen_07_store_availability(category, products, today, country),
    )
    files.append(path07)

    return files
