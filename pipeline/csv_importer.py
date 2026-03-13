"""CSV bulk import tool for the tryvit pipeline.

Reads a UTF-8 CSV file, validates each row, deduplicates, and delegates
SQL generation to :func:`pipeline.sql_generator.generate_pipeline`.

Usage (via CLI wrapper)::

    python -m pipeline.csv_import --file products.csv --output-dir db/pipelines/csv-import
    python -m pipeline.csv_import --file products.csv --dry-run
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

from pipeline.categories import (
    CAT_ALCOHOL,
    CAT_BABY,
    CAT_BREAD,
    CAT_BREAKFAST,
    CAT_CANNED,
    CAT_CEREALS,
    CAT_CHIPS,
    CAT_COFFEE_TEA,
    CAT_CONDIMENTS,
    CAT_DAIRY,
    CAT_DESSERTS,
    CAT_DRINKS,
    CAT_FROZEN,
    CAT_FROZEN_VEG,
    CAT_INSTANT,
    CAT_MEAT,
    CAT_NUTS,
    CAT_OILS,
    CAT_PASTA_RICE,
    CAT_PLANT,
    CAT_READY_MEALS,
    CAT_SAUCES,
    CAT_SEAFOOD,
    CAT_SNACKS,
    CAT_SOUPS,
    CAT_SPICES,
    CAT_SPREADS,
    CAT_SWEETS,
)
from pipeline.sql_generator import generate_pipeline
from pipeline.utils import slug as _slug
from pipeline.validator import ABSOLUTE_CAPS, validate_ean_checksum

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_ROWS = 10_000

VALID_CATEGORIES: frozenset[str] = frozenset(
    {
        CAT_CHIPS,
        CAT_DAIRY,
        CAT_BREAD,
        CAT_CEREALS,
        CAT_DRINKS,
        CAT_MEAT,
        CAT_SWEETS,
        CAT_CANNED,
        CAT_SAUCES,
        CAT_CONDIMENTS,
        CAT_SNACKS,
        CAT_NUTS,
        CAT_BABY,
        CAT_ALCOHOL,
        CAT_FROZEN,
        CAT_BREAKFAST,
        CAT_INSTANT,
        CAT_PLANT,
        CAT_SEAFOOD,
        CAT_OILS,
        CAT_SPREADS,
        CAT_PASTA_RICE,
        CAT_SOUPS,
        CAT_COFFEE_TEA,
        CAT_FROZEN_VEG,
        CAT_READY_MEALS,
        CAT_DESSERTS,
        CAT_SPICES,
    }
)

VALID_COUNTRIES: frozenset[str] = frozenset({"PL", "DE"})

VALID_PREP_METHODS: frozenset[str] = frozenset(
    {
        "air-popped",
        "baked",
        "fried",
        "deep-fried",
        "grilled",
        "roasted",
        "smoked",
        "steamed",
        "marinated",
        "pasteurized",
        "fermented",
        "dried",
        "raw",
        "none",
        "not-applicable",
    }
)

VALID_NUTRI_SCORES: frozenset[str] = frozenset(
    {"A", "B", "C", "D", "E", "UNKNOWN", "NOT-APPLICABLE"}
)

VALID_NOVA: frozenset[str] = frozenset({"1", "2", "3", "4"})

REQUIRED_COLUMNS: frozenset[str] = frozenset(
    {"ean", "brand", "product_name", "category", "country"}
)

NUTRITION_COLUMNS: tuple[str, ...] = (
    "calories_kcal",
    "total_fat_g",
    "saturated_fat_g",
    "carbs_g",
    "sugars_g",
    "fibre_g",
    "protein_g",
    "salt_g",
    "trans_fat_g",
)

# Regex to detect formula injection — values starting with =, +, -, @, \t, \r
_FORMULA_RE = re.compile(r"^[=+\-@\t\r]")


# ---------------------------------------------------------------------------
# Importer
# ---------------------------------------------------------------------------


class CSVImportError(Exception):
    """Raised for fatal import errors (file not found, wrong encoding, etc.)."""


class CSVImporter:
    """Validate, deduplicate, and convert a CSV file into pipeline SQL.

    Parameters
    ----------
    csv_path:
        Path to the UTF-8 CSV file.
    output_dir:
        Directory for generated SQL files.  When *None*, defaults to
        ``db/pipelines/csv-import/``.
    dry_run:
        If *True*, validate and report without writing SQL files.
    """

    def __init__(
        self,
        csv_path: str | Path,
        output_dir: str | Path | None = None,
        dry_run: bool = False,
    ) -> None:
        self.csv_path = Path(csv_path)
        self.dry_run = dry_run
        self.errors: list[str] = []
        self.warnings: list[str] = []

        if output_dir is None:
            project_root = Path(__file__).resolve().parent.parent
            self.output_dir = project_root / "db" / "pipelines" / "csv-import"
        else:
            self.output_dir = Path(output_dir)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(self) -> dict:
        """Execute the full import pipeline.

        Returns
        -------
        dict
            Summary with keys ``total_rows``, ``valid_rows``, ``errors``,
            ``warnings``, ``categories``, ``files_written``.
        """
        rows = self._read_csv()
        validated = self._validate_rows(rows)
        deduped = self._dedup(validated)

        # Abort if >50% rows failed validation
        total = len(rows)
        valid = len(deduped)
        if total > 0 and valid / total < 0.5:
            self.errors.append(
                f"Only {valid}/{total} rows passed validation (< 50%) — "
                f"likely format mismatch. Import aborted."
            )

        files_written: list[str] = []
        categories_found: set[str] = set()

        if not self.errors:
            # Group by (category, country)
            groups = self._group_by_category_country(deduped)
            categories_found = {cat for cat, _ in groups}

            if not self.dry_run:
                for (cat, country), products in groups.items():
                    written = self._generate_sql(cat, country, products)
                    files_written.extend(str(f) for f in written)

        return {
            "total_rows": total,
            "valid_rows": valid,
            "errors": list(self.errors),
            "warnings": list(self.warnings),
            "categories": sorted(categories_found),
            "files_written": files_written,
        }

    # ------------------------------------------------------------------
    # Internal — reading
    # ------------------------------------------------------------------

    def _read_csv(self) -> list[dict]:
        """Read and parse the CSV file with safety checks."""
        if not self.csv_path.exists():
            raise CSVImportError(f"File not found: {self.csv_path}")

        try:
            text = self.csv_path.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            raise CSVImportError(
                f"File is not valid UTF-8: {self.csv_path} ({exc})"
            ) from exc

        reader = csv.DictReader(text.splitlines())

        if reader.fieldnames is None:
            raise CSVImportError("CSV file is empty or has no header row.")

        # Normalise header names: strip whitespace, lowercase
        clean_fields = [f.strip().lower() for f in reader.fieldnames]
        missing = REQUIRED_COLUMNS - set(clean_fields)
        if missing:
            raise CSVImportError(
                f"Missing required columns: {', '.join(sorted(missing))}. "
                f"Required: {', '.join(sorted(REQUIRED_COLUMNS))}"
            )

        rows: list[dict] = []
        for raw_row in reader:
            if len(rows) >= MAX_ROWS:
                self.warnings.append(
                    f"Row limit reached ({MAX_ROWS}). "
                    f"Remaining rows skipped."
                )
                break
            # Re-key with clean header names (ignore extra columns)
            row = {}
            for i, (_, v) in enumerate(raw_row.items()):
                if i < len(clean_fields):
                    row[clean_fields[i]] = v.strip() if v else ""
            rows.append(row)

        return rows

    # ------------------------------------------------------------------
    # Internal — validation
    # ------------------------------------------------------------------

    def _validate_rows(self, rows: list[dict]) -> list[dict]:
        """Validate each row; collect errors and return valid product dicts."""
        valid: list[dict] = []
        for line_num, row in enumerate(rows, start=2):  # line 1 = header
            product, row_errors = self._validate_single_row(row, line_num)
            if row_errors:
                for err in row_errors:
                    self.warnings.append(f"Row {line_num}: {err}")
            else:
                valid.append(product)
        return valid

    def _validate_single_row(
        self, row: dict, line_num: int
    ) -> tuple[dict | None, list[str]]:
        """Validate a single CSV row and return (product_dict, errors)."""
        errors: list[str] = []

        # Formula injection defence
        for col, val in row.items():
            if val and _FORMULA_RE.match(val):
                # Allow negative numbers in nutrition columns
                if col in NUTRITION_COLUMNS:
                    try:
                        float(val)
                        continue
                    except ValueError:
                        pass
                errors.append(
                    f"Potential formula injection in column '{col}': "
                    f"value starts with '{val[0]}'"
                )

        if errors:
            return None, errors

        # Required fields
        brand = row.get("brand", "").strip()
        product_name = row.get("product_name", "").strip()
        category = row.get("category", "").strip()
        country = row.get("country", "").strip().upper()
        ean = row.get("ean", "").strip()

        if not brand:
            errors.append("Missing required field 'brand'")
        if not product_name:
            errors.append("Missing required field 'product_name'")
        if not category:
            errors.append("Missing required field 'category'")
        elif category not in VALID_CATEGORIES:
            errors.append(
                f"Invalid category '{category}'. "
                f"Must be one of: {', '.join(sorted(VALID_CATEGORIES))}"
            )
        if not country:
            errors.append("Missing required field 'country'")
        elif country not in VALID_COUNTRIES:
            errors.append(f"Invalid country '{country}'. Must be PL or DE.")

        # EAN validation
        if not ean:
            errors.append("Missing required field 'ean'")
        elif not validate_ean_checksum(ean):
            errors.append(f"Invalid EAN checksum: '{ean}'")

        if errors:
            return None, errors

        # Optional fields with validation
        prep_method = row.get("prep_method", "").strip() or "not-applicable"
        if prep_method not in VALID_PREP_METHODS:
            errors.append(
                f"Invalid prep_method '{prep_method}'. "
                f"Must be one of: {', '.join(sorted(VALID_PREP_METHODS))}"
            )

        nutri_score = row.get("nutri_score_label", "").strip().upper()
        if nutri_score and nutri_score not in VALID_NUTRI_SCORES:
            errors.append(
                f"Invalid nutri_score_label '{nutri_score}'. "
                f"Must be one of: {', '.join(sorted(VALID_NUTRI_SCORES))}"
            )

        nova = row.get("nova_group", "").strip()
        if nova and nova not in VALID_NOVA:
            errors.append(f"Invalid nova_group '{nova}'. Must be 1, 2, 3, or 4.")

        # Nutrition parsing
        nutrition: dict[str, float | None] = {}
        for col in NUTRITION_COLUMNS:
            raw = row.get(col, "").strip()
            if not raw:
                nutrition[col] = None
                continue
            try:
                val = float(raw)
                if val < 0:
                    errors.append(f"Negative value for '{col}': {val}")
                    continue
                nutrition[col] = val
            except ValueError:
                errors.append(f"Non-numeric value for '{col}': '{raw}'")

        # Cross-field nutrition checks
        sat_fat = nutrition.get("saturated_fat_g")
        total_fat = nutrition.get("total_fat_g")
        if sat_fat is not None and total_fat is not None and sat_fat > total_fat:
            errors.append(
                f"saturated_fat_g ({sat_fat}) > total_fat_g ({total_fat})"
            )

        sugars = nutrition.get("sugars_g")
        carbs = nutrition.get("carbs_g")
        if sugars is not None and carbs is not None and sugars > carbs:
            errors.append(f"sugars_g ({sugars}) > carbs_g ({carbs})")

        # Absolute caps check (reuse validator)
        cap_map = {
            "calories_kcal": "calories",
            "total_fat_g": "total_fat_g",
            "saturated_fat_g": "saturated_fat_g",
            "carbs_g": "carbs_g",
            "sugars_g": "sugars_g",
            "fibre_g": "fibre_g",
            "protein_g": "protein_g",
            "salt_g": "salt_g",
            "trans_fat_g": "trans_fat_g",
        }
        for csv_col, cap_key in cap_map.items():
            val = nutrition.get(csv_col)
            if val is not None and cap_key in ABSOLUTE_CAPS and val > ABSOLUTE_CAPS[cap_key]:
                    errors.append(
                        f"'{csv_col}' ({val}) exceeds absolute cap "
                        f"({ABSOLUTE_CAPS[cap_key]})"
                    )

        if errors:
            return None, errors

        # Build product dict matching generate_pipeline() expectations
        product: dict = {
            "brand": brand,
            "product_name": product_name,
            "ean": ean,
            "category": category,
            "product_type": row.get("product_type", "").strip() or "Grocery",
            "prep_method": prep_method,
            "store_availability": row.get("store_availability", "").strip() or None,
            "controversies": row.get("controversies", "").strip() or "none",
            "ingredients_text": row.get("ingredients_text", "").strip() or None,
            # Nutrition fields (mapped to the key names sql_generator expects)
            "calories": nutrition.get("calories_kcal"),
            "total_fat_g": nutrition.get("total_fat_g"),
            "saturated_fat_g": nutrition.get("saturated_fat_g"),
            "trans_fat_g": nutrition.get("trans_fat_g"),
            "carbs_g": nutrition.get("carbs_g"),
            "sugars_g": nutrition.get("sugars_g"),
            "fibre_g": nutrition.get("fibre_g"),
            "protein_g": nutrition.get("protein_g"),
            "salt_g": nutrition.get("salt_g"),
            # Scoring fields
            "nutri_score_label": nutri_score or None,
            "nova": nova or None,
            # Source provenance — CSV imports use file path as source
            "source_url": str(self.csv_path),
            "source_type": "csv_import",
            # Country stored on product for grouping
            "_country": country,
        }

        return product, []

    # ------------------------------------------------------------------
    # Internal — deduplication
    # ------------------------------------------------------------------

    def _dedup(self, products: list[dict]) -> list[dict]:
        """Deduplicate by (country, brand, product_name), first-seen wins."""
        seen: set[tuple[str, str, str]] = set()
        unique: list[dict] = []
        for p in products:
            key = (
                p["_country"],
                p["brand"].lower().strip(),
                p["product_name"].lower().strip(),
            )
            if key in seen:
                self.warnings.append(
                    f"Duplicate skipped: {p['brand']} / {p['product_name']} "
                    f"({p['_country']})"
                )
                continue
            seen.add(key)
            unique.append(p)

        # Also dedup EANs — first-seen wins
        ean_seen: set[str] = set()
        ean_unique: list[dict] = []
        for p in unique:
            ean = p.get("ean", "")
            if ean and ean in ean_seen:
                self.warnings.append(
                    f"Duplicate EAN skipped: {p['brand']} / {p['product_name']} "
                    f"(EAN {ean})"
                )
                continue
            if ean:
                ean_seen.add(ean)
            ean_unique.append(p)

        return ean_unique

    # ------------------------------------------------------------------
    # Internal — grouping & SQL generation
    # ------------------------------------------------------------------

    def _group_by_category_country(
        self, products: list[dict]
    ) -> dict[tuple[str, str], list[dict]]:
        """Group products by (category, country)."""
        groups: dict[tuple[str, str], list[dict]] = {}
        for p in products:
            key = (p["category"], p["_country"])
            groups.setdefault(key, []).append(p)
        return groups

    def _generate_sql(
        self, category: str, country: str, products: list[dict]
    ) -> list[Path]:
        """Generate pipeline SQL files for one (category, country) group."""
        slug_base = _slug(category)
        dir_slug = f"{slug_base}-{country.lower()}" if country != "PL" else slug_base
        out_dir = self.output_dir / dir_slug

        return generate_pipeline(
            category=category,
            products=products,
            output_dir=str(out_dir),
            country=country,
        )
