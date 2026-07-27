"""Path-containment tests for pipeline file generation."""

from pathlib import Path

import pytest

from pipeline.image_importer import (
    PIPELINES_ROOT,
    _resolve_pipeline_output_dir,
    _safe_child_path as image_path,
    _safe_pipeline_subdirectory,
)
from pipeline.sql_generator import _safe_child_path as sql_path


def test_sql_generator_output_stays_inside_directory(tmp_path: Path) -> None:
    path = sql_path(tmp_path, "PIPELINE__chips__01_insert_products.sql")

    assert path.parent == tmp_path.resolve()


def test_sql_generator_rejects_path_traversal(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="outside pipeline directory"):
        sql_path(tmp_path, "../outside.sql")


def test_image_importer_rejects_output_outside_pipeline_root() -> None:
    with pytest.raises(ValueError, match="inside db/pipelines"):
        _resolve_pipeline_output_dir("../outside")


def test_image_importer_rejects_generated_path_traversal(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="outside output directory"):
        image_path(tmp_path, "../outside.sql")


def test_image_importer_rejects_category_directory_outside_pipeline_root() -> None:
    with pytest.raises(ValueError, match="outside pipeline root"):
        _safe_pipeline_subdirectory(PIPELINES_ROOT, "..")
