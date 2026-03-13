"""Tests for batch SQL generation (Issue #864).

Validates that the pipeline correctly splits large product sets into
multiple batch files while preserving backward compatibility for
small categories.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from pipeline.sql_generator import _chunk, generate_pipeline

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_PRODUCT_TEMPLATE = {
    "brand": "TestBrand",
    "product_name": "Product",
    "ean": "5900000000000",
    "product_type": "Grocery",
    "prep_method": "not-applicable",
    "store_availability": None,
    "controversies": "none",
    "calories": 100,
    "total_fat_g": 5.0,
    "saturated_fat_g": 2.0,
    "trans_fat_g": 0.0,
    "carbs_g": 15.0,
    "sugars_g": 5.0,
    "fibre_g": 1.0,
    "protein_g": 3.0,
    "salt_g": 0.5,
    "nutri_score_label": "C",
    "nutri_score_source": "off_computed",
    "nova_group": "3",
    "source_url": "https://world.openfoodfacts.org/product/1234",
    "image_url": "https://images.openfoodfacts.org/img.jpg",
}


def _make_products(n: int) -> list[dict]:
    """Create *n* distinct product dicts for testing."""
    products = []
    for i in range(1, n + 1):
        p = dict(_PRODUCT_TEMPLATE)
        p["brand"] = f"Brand{i}"
        p["product_name"] = f"Product {i}"
        p["ean"] = f"{5900000000000 + i}"
        products.append(p)
    return products


@pytest.fixture()
def tmp_output(tmp_path: Path) -> Path:
    """Return a fresh output directory for a fake category."""
    out = tmp_path / "test-cat"
    out.mkdir()
    return out


# ---------------------------------------------------------------------------
# _chunk helper
# ---------------------------------------------------------------------------


class TestChunk:
    def test_exact_division(self) -> None:
        result = _chunk(list(range(10)), 5)
        assert result == [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]]

    def test_remainder(self) -> None:
        result = _chunk(list(range(7)), 3)
        assert len(result) == 3
        assert result[-1] == [6]

    def test_size_larger_than_items(self) -> None:
        result = _chunk([1, 2], 100)
        assert result == [[1, 2]]

    def test_empty(self) -> None:
        assert _chunk([], 10) == []


# ---------------------------------------------------------------------------
# Backward compatibility (≤ batch_size → single files)
# ---------------------------------------------------------------------------


class TestSingleFileMode:
    """When product count ≤ batch_size, output matches original single-file format."""

    def test_single_files_below_threshold(self, tmp_output: Path) -> None:
        products = _make_products(50)
        files = generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        names = [f.name for f in files]
        assert "PIPELINE__test-cat__01_insert_products.sql" in names
        assert "PIPELINE__test-cat__03_add_nutrition.sql" in names
        assert not any("_batch_" in n for n in names)

    def test_single_file_at_exact_threshold(self, tmp_output: Path) -> None:
        products = _make_products(100)
        files = generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        names = [f.name for f in files]
        assert "PIPELINE__test-cat__01_insert_products.sql" in names
        assert not any("_batch_" in n for n in names)

    def test_unbatched_always_has_six_files(self, tmp_output: Path) -> None:
        products = _make_products(10)
        files = generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        assert len(files) == 6

    def test_batch_size_zero_disables_batching(self, tmp_output: Path) -> None:
        products = _make_products(200)
        files = generate_pipeline("TestCat", products, str(tmp_output), batch_size=0)
        names = [f.name for f in files]
        assert "PIPELINE__test-cat__01_insert_products.sql" in names
        assert not any("_batch_" in n for n in names)


# ---------------------------------------------------------------------------
# Batched mode (> batch_size → batch files)
# ---------------------------------------------------------------------------


class TestBatchedMode:
    """When product count > batch_size, steps 01 and 03 are split into batch files."""

    def test_batch_file_count(self, tmp_output: Path) -> None:
        products = _make_products(250)
        files = generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        names = [f.name for f in files]
        # 3 batch files for 01 + 3 batch files for 03 + 4 single files (04-07) = 10
        assert len(files) == 10
        batch_01 = [n for n in names if "01_batch" in n]
        batch_03 = [n for n in names if "03_batch" in n]
        assert len(batch_01) == 3
        assert len(batch_03) == 3

    def test_batch_filenames_sort_correctly(self, tmp_output: Path) -> None:
        products = _make_products(250)
        files = generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        names = [f.name for f in files]
        # Verify batch numbering is zero-padded and sorts correctly
        batch_01 = sorted(n for n in names if "01_batch" in n)
        assert batch_01 == [
            "PIPELINE__test-cat__01_batch_001_insert_products.sql",
            "PIPELINE__test-cat__01_batch_002_insert_products.sql",
            "PIPELINE__test-cat__01_batch_003_insert_products.sql",
        ]

    def test_batch_naming_pattern(self, tmp_output: Path) -> None:
        products = _make_products(150)
        files = generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        names = [f.name for f in files]
        assert "PIPELINE__test-cat__01_batch_001_insert_products.sql" in names
        assert "PIPELINE__test-cat__01_batch_002_insert_products.sql" in names
        assert "PIPELINE__test-cat__03_batch_001_add_nutrition.sql" in names
        assert "PIPELINE__test-cat__03_batch_002_add_nutrition.sql" in names

    def test_steps_04_through_07_remain_single(self, tmp_output: Path) -> None:
        products = _make_products(200)
        files = generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        names = [f.name for f in files]
        assert "PIPELINE__test-cat__04_scoring.sql" in names
        assert "PIPELINE__test-cat__05_source_provenance.sql" in names
        assert "PIPELINE__test-cat__06_add_images.sql" in names
        assert "PIPELINE__test-cat__07_store_availability.sql" in names


# ---------------------------------------------------------------------------
# Batch SQL content validation
# ---------------------------------------------------------------------------


class TestBatchContent:
    """Validate SQL content in batch files."""

    def test_first_batch_has_preamble(self, tmp_output: Path) -> None:
        products = _make_products(150)
        generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        batch1 = (tmp_output / "PIPELINE__test-cat__01_batch_001_insert_products.sql").read_text()
        assert "0a. DEPRECATE old products" in batch1
        assert "0b. Release EANs" in batch1
        assert "0c. Deprecate cross-category" in batch1

    def test_middle_batch_no_preamble(self, tmp_output: Path) -> None:
        products = _make_products(350)
        generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        batch2 = (tmp_output / "PIPELINE__test-cat__01_batch_002_insert_products.sql").read_text()
        assert "0a. DEPRECATE" not in batch2
        assert "0b. Release" not in batch2
        assert "0c. Deprecate cross-category" not in batch2

    def test_last_batch_has_postscript(self, tmp_output: Path) -> None:
        products = _make_products(150)
        generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        batch2 = (tmp_output / "PIPELINE__test-cat__01_batch_002_insert_products.sql").read_text()
        assert "2. DEPRECATE removed products" in batch2

    def test_postscript_lists_all_products(self, tmp_output: Path) -> None:
        products = _make_products(150)
        generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        batch2 = (tmp_output / "PIPELINE__test-cat__01_batch_002_insert_products.sql").read_text()
        # All 150 product names should be listed in the NOT IN clause
        for p in products:
            assert p["product_name"] in batch2

    def test_every_batch_has_on_conflict(self, tmp_output: Path) -> None:
        products = _make_products(250)
        generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        for i in range(1, 4):
            path = tmp_output / f"PIPELINE__test-cat__01_batch_{i:03d}_insert_products.sql"
            content = path.read_text()
            assert "on conflict (country, brand, product_name)" in content.lower()

    def test_nutrition_batch_1_has_delete(self, tmp_output: Path) -> None:
        products = _make_products(150)
        generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        batch1 = (tmp_output / "PIPELINE__test-cat__03_batch_001_add_nutrition.sql").read_text()
        assert "delete from nutrition_facts" in batch1.lower()

    def test_nutrition_batch_2_no_delete(self, tmp_output: Path) -> None:
        products = _make_products(150)
        generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        batch2 = (tmp_output / "PIPELINE__test-cat__03_batch_002_add_nutrition.sql").read_text()
        assert "delete from nutrition_facts" not in batch2.lower()

    def test_nutrition_all_batches_have_on_conflict(self, tmp_output: Path) -> None:
        products = _make_products(250)
        generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        for i in range(1, 4):
            path = tmp_output / f"PIPELINE__test-cat__03_batch_{i:03d}_add_nutrition.sql"
            content = path.read_text()
            assert "on conflict (product_id)" in content.lower()

    def test_batch_header_comment(self, tmp_output: Path) -> None:
        products = _make_products(150)
        generate_pipeline("TestCat", products, str(tmp_output), batch_size=100)
        batch1 = (tmp_output / "PIPELINE__test-cat__01_batch_001_insert_products.sql").read_text()
        assert "Batch 1/2: products 1-100" in batch1
        batch2 = (tmp_output / "PIPELINE__test-cat__01_batch_002_insert_products.sql").read_text()
        assert "Batch 2/2: products 101-150" in batch2


# ---------------------------------------------------------------------------
# Stale file cleanup
# ---------------------------------------------------------------------------


class TestStaleFileCleanup:
    """Switching between single-file and batched modes cleans up stale files."""

    def test_single_to_batch_cleans_single_files(self, tmp_output: Path) -> None:
        # First run: small → single files
        generate_pipeline("TestCat", _make_products(50), str(tmp_output), batch_size=100)
        assert (tmp_output / "PIPELINE__test-cat__01_insert_products.sql").exists()

        # Second run: large → batch files (should delete single file)
        generate_pipeline("TestCat", _make_products(200), str(tmp_output), batch_size=100)
        assert not (tmp_output / "PIPELINE__test-cat__01_insert_products.sql").exists()
        assert (tmp_output / "PIPELINE__test-cat__01_batch_001_insert_products.sql").exists()

    def test_batch_to_single_cleans_batch_files(self, tmp_output: Path) -> None:
        # First run: large → batch files
        generate_pipeline("TestCat", _make_products(200), str(tmp_output), batch_size=100)
        assert (tmp_output / "PIPELINE__test-cat__01_batch_001_insert_products.sql").exists()

        # Second run: small → single files (should delete batch files)
        generate_pipeline("TestCat", _make_products(50), str(tmp_output), batch_size=100)
        assert (tmp_output / "PIPELINE__test-cat__01_insert_products.sql").exists()
        assert not (tmp_output / "PIPELINE__test-cat__01_batch_001_insert_products.sql").exists()

    def test_rebatch_cleans_old_batches(self, tmp_output: Path) -> None:
        # First run: 300 products → 3 batches
        generate_pipeline("TestCat", _make_products(300), str(tmp_output), batch_size=100)
        assert (tmp_output / "PIPELINE__test-cat__01_batch_003_insert_products.sql").exists()

        # Second run: 150 products → 2 batches (batch 003 should be deleted)
        generate_pipeline("TestCat", _make_products(150), str(tmp_output), batch_size=100)
        assert (tmp_output / "PIPELINE__test-cat__01_batch_002_insert_products.sql").exists()
        assert not (tmp_output / "PIPELINE__test-cat__01_batch_003_insert_products.sql").exists()


# ---------------------------------------------------------------------------
# check_pipeline_structure.py integration
# ---------------------------------------------------------------------------


class TestStructureCheckerCompat:
    """Verify check_pipeline_structure.py recognises batch files."""

    def test_batch_files_satisfy_required_steps(self, tmp_output: Path) -> None:
        from check_pipeline_structure import _check_required_files

        products = _make_products(200)
        generate_pipeline("test-cat", products, str(tmp_output), batch_size=100)
        violations = _check_required_files("test-cat", tmp_output)
        assert violations == []

    def test_single_files_still_recognised(self, tmp_output: Path) -> None:
        from check_pipeline_structure import _check_required_files

        products = _make_products(50)
        generate_pipeline("test-cat", products, str(tmp_output), batch_size=100)
        violations = _check_required_files("test-cat", tmp_output)
        assert violations == []
