"""CSV CLI diagnostics must never publish cells, private paths or exceptions."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from pipeline import csv_import
from pipeline.csv_importer import CSVImportError

CANARY = "synthetic-private-csv-canary-7391"


def _args(monkeypatch: pytest.MonkeyPatch, file: str = CANARY) -> None:
    monkeypatch.setattr(sys, "argv", ["csv_import", "--file", file, "--dry-run"])


@pytest.mark.parametrize(
    ("exception", "code"),
    [
        (CSVImportError(CANARY), "CSV_INPUT_REJECTED"),
        (PermissionError(CANARY), "CSV_IO_FAILED"),
        (ValueError(CANARY), "CSV_IMPORT_FAILED"),
    ],
)
def test_fatal_diagnostics_do_not_echo_exceptions(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
    exception: Exception, code: str,
) -> None:
    _args(monkeypatch)

    def fail(_self: object) -> None:
        raise exception

    monkeypatch.setattr(csv_import.CSVImporter, "run", fail)
    with pytest.raises(SystemExit) as stopped:
        csv_import.main()
    assert stopped.value.code == 1
    captured = capsys.readouterr()
    assert code in captured.err
    assert captured.out == ""
    assert CANARY not in captured.err
    assert "Traceback" not in captured.err


@pytest.mark.parametrize("errors", [[], [CANARY]])
def test_summary_logs_counts_not_values_or_paths(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], errors: list[str],
) -> None:
    _args(monkeypatch)
    monkeypatch.setattr(csv_import.CSVImporter, "run", lambda _self: {
        "total_rows": 3, "valid_rows": 2, "categories": [CANARY],
        "warnings": [CANARY], "errors": errors, "files_written": [f"/private/{CANARY}.sql"],
    })
    if errors:
        with pytest.raises(SystemExit) as stopped:
            csv_import.main()
        assert stopped.value.code == 1
    else:
        csv_import.main()
    captured = capsys.readouterr()
    assert CANARY not in captured.out + captured.err
    assert "Total rows:  3" in captured.out
    assert "CSV_WARNINGS: 1" in captured.out
    assert ("CSV_VALIDATION_FAILED: 1 errors" if errors else "Files written: 1") in captured.out


def test_actual_invalid_csv_does_not_echo_cells_or_filename(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    file = tmp_path / f"{CANARY}.csv"
    file.write_text(
        "ean,brand,product_name,category,country\n"
        f"{CANARY},{CANARY},{CANARY},{CANARY},PL\n",
        encoding="utf-8",
    )
    _args(monkeypatch, str(file))
    with pytest.raises(SystemExit) as stopped:
        csv_import.main()
    assert stopped.value.code == 1
    captured = capsys.readouterr()
    assert CANARY not in captured.out + captured.err
    assert "CSV_WARNINGS: 2" in captured.out
    assert "CSV_VALIDATION_FAILED" in captured.out


def test_actual_duplicate_warning_does_not_echo_brand_or_product(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    file = tmp_path / f"{CANARY}.csv"
    row = f"5901234567893,{CANARY},{CANARY},Dairy,PL\n"
    file.write_text("ean,brand,product_name,category,country\n" + row + row, encoding="utf-8")
    _args(monkeypatch, str(file))
    csv_import.main()
    captured = capsys.readouterr()
    assert CANARY not in captured.out + captured.err
    assert "CSV_WARNINGS: 1" in captured.out
    assert "Valid rows:  1" in captured.out


def test_actual_missing_private_path_is_redacted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    _args(monkeypatch, str(tmp_path / f"{CANARY}.csv"))
    with pytest.raises(SystemExit):
        csv_import.main()
    captured = capsys.readouterr()
    assert CANARY not in captured.out + captured.err
    assert "CSV_INPUT_REJECTED" in captured.err


def test_parser_does_not_echo_unrecognized_private_arguments(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    _args(monkeypatch)
    monkeypatch.setattr(sys, "argv", [*sys.argv, f"--{CANARY}"])
    with pytest.raises(SystemExit) as stopped:
        csv_import.main()
    assert stopped.value.code == 2
    captured = capsys.readouterr()
    assert CANARY not in captured.out + captured.err
    assert "CSV_ARGUMENTS_INVALID" in captured.err
