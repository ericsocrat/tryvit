"""Tests for pipeline.csv_importer — CSV bulk import tool.

Covers: valid import, missing columns, bad EAN, formula injection,
row limit, duplicate detection, empty file, invalid category,
nutrition cap violations, cross-field checks, dry-run mode.
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from pipeline.csv_importer import (
    MAX_ROWS,
    VALID_CATEGORIES,
    VALID_COUNTRIES,
    VALID_PREP_METHODS,
    CSVImporter,
    CSVImportError,
)


def _write_csv(tmp_path: Path, content: str) -> Path:
    """Write CSV content to a temp file and return its path."""
    p = tmp_path / "test_import.csv"
    p.write_text(textwrap.dedent(content).strip(), encoding="utf-8")
    return p


# Valid EAN-13 checksum values for test data
_VALID_EAN_1 = "5901234567893"
_VALID_EAN_2 = "4012345678901"
_VALID_EAN_3 = "5901112223330"

_HEADER = (
    "ean,brand,product_name,category,country,product_type,prep_method,"
    "store_availability,controversies,calories_kcal,total_fat_g,"
    "saturated_fat_g,trans_fat_g,carbs_g,sugars_g,fibre_g,protein_g,"
    "salt_g,nutri_score_label,nova_group,ingredients_text"
)

_VALID_ROW_1 = (
    f"{_VALID_EAN_1},Test Brand,Test Yogurt,Dairy,PL,yogurt,not-applicable,"
    ",none,65,3.2,2.1,0,8.5,5.2,0,4.5,0.12,B,1,milk"
)

_VALID_ROW_2 = (
    f"{_VALID_EAN_2},DE Brand,Test Bread,Bread,DE,bread,baked,"
    "Lidl,none,245,1.2,0.2,0,47,3.5,6.8,8.9,1.1,A,2,flour"
)


# ═══════════════════════════════════════════════════════════════════════════
# Valid import
# ═══════════════════════════════════════════════════════════════════════════


class TestValidImport:
    """Tests for a well-formed CSV import."""

    def test_valid_import_returns_correct_counts(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_ROW_1}
            {_VALID_ROW_2}
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["total_rows"] == 2
        assert result["valid_rows"] == 2
        assert result["errors"] == []
        assert "Dairy" in result["categories"]
        assert "Bread" in result["categories"]
        assert len(result["files_written"]) > 0

    def test_valid_import_creates_sql_files(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_ROW_1}
            """,
        )
        out_dir = tmp_path / "out"
        importer = CSVImporter(csv_path, output_dir=out_dir)
        result = importer.run()

        for f in result["files_written"]:
            assert Path(f).exists()


# ═══════════════════════════════════════════════════════════════════════════
# Missing columns
# ═══════════════════════════════════════════════════════════════════════════


class TestMissingColumns:
    """Tests for missing required CSV columns."""

    def test_missing_required_column_raises(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            """\
            ean,brand,product_name,country
            5901234567893,Brand,Name,PL
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        with pytest.raises(CSVImportError, match="Missing required columns"):
            importer.run()


# ═══════════════════════════════════════════════════════════════════════════
# Bad EAN
# ═══════════════════════════════════════════════════════════════════════════


class TestBadEAN:
    """Tests for invalid EAN values."""

    def test_invalid_ean_checksum_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            1234567890123,Brand,Product,Dairy,PL,,,,none,,,,,,,,,,,,milk
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any("Invalid EAN" in w for w in result["warnings"])

    def test_missing_ean_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            ,Brand,Product,Dairy,PL,,,,none,,,,,,,,,,,,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any("Missing required field 'ean'" in w for w in result["warnings"])


# ═══════════════════════════════════════════════════════════════════════════
# Formula injection
# ═══════════════════════════════════════════════════════════════════════════


class TestFormulaInjection:
    """Tests for formula injection defence."""

    def test_equals_sign_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},=cmd|'/C calc'!A0,Product,Dairy,PL,,,,none,,,,,,,,,,,,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any("formula injection" in w.lower() for w in result["warnings"])

    def test_at_sign_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},@SUM(A1),Product,Dairy,PL,,,,none,,,,,,,,,,,,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0


# ═══════════════════════════════════════════════════════════════════════════
# Row limit
# ═══════════════════════════════════════════════════════════════════════════


class TestRowLimit:
    """Tests for MAX_ROWS enforcement."""

    def test_max_rows_constant_is_10000(self) -> None:
        assert MAX_ROWS == 10_000


# ═══════════════════════════════════════════════════════════════════════════
# Duplicate detection
# ═══════════════════════════════════════════════════════════════════════════


class TestDuplicateDetection:
    """Tests for deduplication by (country, brand, product_name) and EAN."""

    def test_duplicate_name_deduped(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},Brand,Same Product,Dairy,PL,,,,none,65,3,2,0,8,5,0,4,0.1,B,1,"milk"
            {_VALID_EAN_2},Brand,Same Product,Dairy,PL,,,,none,70,4,2,0,9,6,0,5,0.2,B,1,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["total_rows"] == 2
        assert result["valid_rows"] == 1
        assert any("Duplicate skipped" in w for w in result["warnings"])

    def test_duplicate_ean_deduped(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},Brand A,Product A,Dairy,PL,,,,none,65,3,2,0,8,5,0,4,0.1,B,1,"milk"
            {_VALID_EAN_1},Brand B,Product B,Dairy,PL,,,,none,70,4,2,0,9,6,0,5,0.2,B,1,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 1
        assert any("Duplicate EAN" in w for w in result["warnings"])


# ═══════════════════════════════════════════════════════════════════════════
# Empty file
# ═══════════════════════════════════════════════════════════════════════════


class TestEmptyFile:
    """Tests for empty or header-only CSV files."""

    def test_no_header_raises(self, tmp_path: Path) -> None:
        csv_path = _write_csv(tmp_path, "")
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        with pytest.raises(CSVImportError, match="empty"):
            importer.run()

    def test_header_only_zero_rows(self, tmp_path: Path) -> None:
        csv_path = _write_csv(tmp_path, _HEADER)
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["total_rows"] == 0
        assert result["valid_rows"] == 0


# ═══════════════════════════════════════════════════════════════════════════
# Invalid category
# ═══════════════════════════════════════════════════════════════════════════


class TestInvalidCategory:
    """Tests for invalid category values."""

    def test_unknown_category_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},Brand,Product,Nonexistent Category,PL,,,,none,,,,,,,,,,,,"x"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any("Invalid category" in w for w in result["warnings"])

    def test_valid_categories_set_has_28_entries(self) -> None:
        assert len(VALID_CATEGORIES) == 28


# ═══════════════════════════════════════════════════════════════════════════
# Nutrition cap violations
# ═══════════════════════════════════════════════════════════════════════════


class TestNutritionCaps:
    """Tests for absolute nutrition cap enforcement."""

    def test_calories_over_cap_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},Brand,Product,Dairy,PL,,,,none,999,3,2,0,8,5,0,4,0.1,B,1,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any("exceeds absolute cap" in w for w in result["warnings"])

    def test_negative_nutrition_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},Brand,Product,Dairy,PL,,,,none,-10,3,2,0,8,5,0,4,0.1,B,1,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any("Negative value" in w for w in result["warnings"])


# ═══════════════════════════════════════════════════════════════════════════
# Cross-field nutrition checks
# ═══════════════════════════════════════════════════════════════════════════


class TestCrossFieldChecks:
    """Tests for sugars <= carbs and sat_fat <= total_fat constraints."""

    def test_sugars_exceeding_carbs_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},Brand,Product,Dairy,PL,,,,none,65,3,2,0,8,15,0,4,0.1,B,1,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any("sugars_g" in w and "carbs_g" in w for w in result["warnings"])

    def test_sat_fat_exceeding_total_fat_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},Brand,Product,Dairy,PL,,,,none,65,3,10,0,8,5,0,4,0.1,B,1,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any(
            "saturated_fat_g" in w and "total_fat_g" in w
            for w in result["warnings"]
        )


# ═══════════════════════════════════════════════════════════════════════════
# Dry run mode
# ═══════════════════════════════════════════════════════════════════════════


class TestDryRun:
    """Tests for dry-run mode (validate without writing files)."""

    def test_dry_run_writes_no_files(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_ROW_1}
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out", dry_run=True)
        result = importer.run()

        assert result["valid_rows"] == 1
        assert result["files_written"] == []
        assert result["errors"] == []

    def test_dry_run_still_validates(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            1234567890123,Brand,Product,Dairy,PL,,,,none,,,,,,,,,,,,milk
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out", dry_run=True)
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any("Invalid EAN" in w for w in result["warnings"])


# ═══════════════════════════════════════════════════════════════════════════
# File-not-found
# ═══════════════════════════════════════════════════════════════════════════


class TestFileNotFound:
    """Tests for missing input file."""

    def test_missing_file_raises(self, tmp_path: Path) -> None:
        importer = CSVImporter(
            tmp_path / "nonexistent.csv", output_dir=tmp_path / "out"
        )
        with pytest.raises(CSVImportError, match="File not found"):
            importer.run()


# ═══════════════════════════════════════════════════════════════════════════
# Invalid country
# ═══════════════════════════════════════════════════════════════════════════


class TestInvalidCountry:
    """Tests for invalid country codes."""

    def test_unknown_country_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},Brand,Product,Dairy,FR,,,,none,65,3,2,0,8,5,0,4,0.1,B,1,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any("Invalid country" in w for w in result["warnings"])

    def test_valid_countries(self) -> None:
        assert frozenset({"PL", "DE"}) == VALID_COUNTRIES


# ═══════════════════════════════════════════════════════════════════════════
# Invalid prep method
# ═══════════════════════════════════════════════════════════════════════════


class TestInvalidPrepMethod:
    """Tests for invalid prep_method values."""

    def test_unknown_prep_method_rejected(self, tmp_path: Path) -> None:
        csv_path = _write_csv(
            tmp_path,
            f"""\
            {_HEADER}
            {_VALID_EAN_1},Brand,Product,Dairy,PL,,boiled,,none,65,3,2,0,8,5,0,4,0.1,B,1,"milk"
            """,
        )
        importer = CSVImporter(csv_path, output_dir=tmp_path / "out")
        result = importer.run()

        assert result["valid_rows"] == 0
        assert any("Invalid prep_method" in w for w in result["warnings"])

    def test_valid_prep_methods_has_15_entries(self) -> None:
        assert len(VALID_PREP_METHODS) == 15
