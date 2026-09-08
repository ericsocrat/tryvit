"""CLI entry point for the CSV bulk import tool.

Usage::

    python -m pipeline.csv_import --file products.csv
    python -m pipeline.csv_import --file products.csv --dry-run
    python -m pipeline.csv_import --file products.csv --output-dir db/pipelines/csv-import
"""

from __future__ import annotations

import argparse
import sys

from pipeline.csv_importer import CSVImporter, CSVImportError


class _DiagnosticArgumentParser(argparse.ArgumentParser):
    """Do not echo unknown arguments, which may contain private paths/data."""

    def error(self, message: str) -> None:
        self.exit(2, "ERROR: CSV_ARGUMENTS_INVALID; use --help for supported options.\n")


def main() -> None:
    parser = _DiagnosticArgumentParser(
        prog="python -m pipeline.csv_import",
        description="Import products from a CSV file into pipeline SQL.",
    )
    parser.add_argument(
        "--file",
        required=True,
        help="Path to the UTF-8 CSV file to import.",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory for generated SQL files (default: db/pipelines/csv-import/).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate without writing SQL files.",
    )
    args = parser.parse_args()

    try:
        importer = CSVImporter(
            csv_path=args.file,
            output_dir=args.output_dir,
            dry_run=args.dry_run,
        )
        result = importer.run()
    except CSVImportError:
        print("FATAL: CSV_INPUT_REJECTED; check the local file and CSV template.", file=sys.stderr)
        sys.exit(1)
    except OSError:
        print("FATAL: CSV_IO_FAILED; check local file access and output permissions.", file=sys.stderr)
        sys.exit(1)
    except Exception:
        # CLI boundary: exception text/tracebacks may embed CSV cells or paths.
        print("FATAL: CSV_IMPORT_FAILED; import did not complete.", file=sys.stderr)
        sys.exit(1)

    # Report
    print()
    print("CSV Import Summary")
    print("=" * 40)
    print(f"  Total rows:  {result['total_rows']}")
    print(f"  Valid rows:  {result['valid_rows']}")
    print(f"  Category groups: {len(result['categories'])}")

    if result["warnings"]:
        print(f"\n  CSV_WARNINGS: {len(result['warnings'])}")
        print("  Review the local CSV against the import template; cell values are not logged.")

    if result["errors"]:
        print(f"\n  CSV_VALIDATION_FAILED: {len(result['errors'])} errors")
        sys.exit(1)

    if result["files_written"]:
        print(f"\n  Files written: {len(result['files_written'])}")

    if args.dry_run:
        print("\n  (dry-run — no files written)")

    print()


if __name__ == "__main__":
    main()
