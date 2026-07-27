"""Path-containment tests for pipeline file generation."""

from __future__ import annotations

import datetime
from pathlib import Path

import pytest

import pipeline.sql_generator as sql_generator
from pipeline.image_importer import (
    PIPELINES_ROOT,
    _resolve_pipeline_output_dir,
    _safe_child_path as image_path,
    _safe_pipeline_subdirectory,
)
from pipeline.sql_generator import (
    PipelineOutputPathError,
    _gen_01_insert_products,
    _gen_03_add_nutrition,
    _gen_04_scoring,
    _gen_05_source_provenance,
    _gen_06_add_images,
    _gen_07_store_availability,
    _resolve_pipeline_output_dir as sql_output_dir,
    _validated_pipeline_output_path,
    _write_pipeline_file,
    generate_pipeline,
)


@pytest.fixture()
def trusted_sql_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(sql_generator, "PIPELINES_ROOT", tmp_path)
    return tmp_path


def test_sql_generator_accepts_relative_output_path(trusted_sql_root: Path) -> None:
    path = _validated_pipeline_output_path("PIPELINE__chips__01_insert_products.sql")

    assert path == trusted_sql_root / "PIPELINE__chips__01_insert_products.sql"


def test_sql_generator_accepts_nested_output_path(trusted_sql_root: Path) -> None:
    path = _validated_pipeline_output_path(
        Path("nested") / "category" / "PIPELINE__chips__04_scoring.sql"
    )

    assert path == (
        trusted_sql_root
        / "nested"
        / "category"
        / "PIPELINE__chips__04_scoring.sql"
    )


def test_sql_generator_rejects_path_traversal(trusted_sql_root: Path) -> None:
    with pytest.raises(PipelineOutputPathError, match="outside db/pipelines"):
        _validated_pipeline_output_path(Path("..") / "outside.sql")


def test_sql_generator_rejects_absolute_path(trusted_sql_root: Path) -> None:
    with pytest.raises(PipelineOutputPathError, match="must be relative"):
        _validated_pipeline_output_path(trusted_sql_root / "absolute.sql")


def test_sql_generator_rejects_normalized_escape(trusted_sql_root: Path) -> None:
    with pytest.raises(PipelineOutputPathError, match="outside db/pipelines"):
        _validated_pipeline_output_path(
            Path("nested") / ".." / ".." / "outside.sql"
        )


def test_sql_generator_rejects_empty_file_path(trusted_sql_root: Path) -> None:
    with pytest.raises(PipelineOutputPathError, match="must name a file"):
        _validated_pipeline_output_path(Path())


def test_sql_generator_creates_parent_only_after_validation(
    trusted_sql_root: Path,
) -> None:
    relative_path = Path("nested") / "category" / "generated.sql"

    path = _write_pipeline_file(relative_path, "select 1;\n")

    assert path == trusted_sql_root / relative_path
    assert path.parent.is_dir()
    assert path.read_text(encoding="utf-8") == "select 1;\n"


def test_sql_generator_rejects_output_outside_pipeline_root() -> None:
    with pytest.raises(PipelineOutputPathError, match="outside db/pipelines"):
        sql_output_dir("../outside")


@pytest.mark.parametrize(
    ("category", "slug", "country"),
    [("Dairy", "dairy", "PL"), ("Bread", "bread-de", "DE")],
)
def test_generated_paths_and_contents_remain_unchanged(
    trusted_sql_root: Path,
    category: str,
    slug: str,
    country: str,
) -> None:
    products: list[dict] = []
    output_dir = trusted_sql_root / slug
    today = datetime.date.today().isoformat()

    files = generate_pipeline(category, products, str(output_dir), country=country)

    expected = {
        f"PIPELINE__{slug}__01_insert_products.sql": _gen_01_insert_products(
            category, products, today, country
        ),
        f"PIPELINE__{slug}__03_add_nutrition.sql": _gen_03_add_nutrition(
            category, products, country
        ),
        f"PIPELINE__{slug}__04_scoring.sql": _gen_04_scoring(
            category, products, today, country
        ),
        f"PIPELINE__{slug}__05_source_provenance.sql": _gen_05_source_provenance(
            category, products, today, country
        ),
        f"PIPELINE__{slug}__06_add_images.sql": _gen_06_add_images(
            category, products, today, country
        ),
        f"PIPELINE__{slug}__07_store_availability.sql": _gen_07_store_availability(
            category, products, today, country
        ),
    }
    assert [path.name for path in files] == list(expected)
    for path in files:
        assert path == output_dir / path.name
        assert path.read_text(encoding="utf-8") == expected[path.name]


def test_all_flagged_writes_use_validated_writer(
    trusted_sql_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    recorded_paths: list[Path] = []
    real_writer = sql_generator._write_pipeline_file

    def recording_writer(relative_path: str | Path, content: str) -> Path:
        recorded_paths.append(Path(relative_path))
        return real_writer(relative_path, content)

    monkeypatch.setattr(sql_generator, "_write_pipeline_file", recording_writer)
    generate_pipeline("Dairy", [], str(trusted_sql_root / "dairy"))

    recorded_names = {path.name for path in recorded_paths}
    assert {
        "PIPELINE__dairy__03_add_nutrition.sql",
        "PIPELINE__dairy__04_scoring.sql",
        "PIPELINE__dairy__05_source_provenance.sql",
        "PIPELINE__dairy__06_add_images.sql",
        "PIPELINE__dairy__07_store_availability.sql",
    } <= recorded_names


def test_image_importer_rejects_output_outside_pipeline_root() -> None:
    with pytest.raises(ValueError, match="inside db/pipelines"):
        _resolve_pipeline_output_dir("../outside")


def test_image_importer_rejects_generated_path_traversal(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="outside output directory"):
        image_path(tmp_path, "../outside.sql")


def test_image_importer_rejects_category_directory_outside_pipeline_root() -> None:
    with pytest.raises(ValueError, match="outside pipeline root"):
        _safe_pipeline_subdirectory(PIPELINES_ROOT, "..")
