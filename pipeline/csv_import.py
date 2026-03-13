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


def main() -> None:
    parser = argparse.ArgumentParser(
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
    except CSVImportError as exc:
        print(f"FATAL: {exc}", file=sys.stderr)
        sys.exit(1)

    # Report
    print()
    print("CSV Import Summary")
    print("=" * 40)
    print(f"  Total rows:  {result['total_rows']}")
    print(f"  Valid rows:  {result['valid_rows']}")
    print(f"  Categories:  {', '.join(result['categories']) or 'none'}")

    if result["warnings"]:
        print(f"\n  Warnings ({len(result['warnings'])}):")
        for w in result["warnings"][:20]:
            print(f"    ⚠ {w}")
        if len(result["warnings"]) > 20:
            print(f"    ... and {len(result['warnings']) - 20} more")

    if result["errors"]:
        print(f"\n  Errors ({len(result['errors'])}):")
        for e in result["errors"]:
            print(f"    ✗ {e}")
        sys.exit(1)

    if result["files_written"]:
        print(f"\n  Files written ({len(result['files_written'])}):")
        for f in result["files_written"]:
            print(f"    → {f}")

    if args.dry_run:
        print("\n  (dry-run — no files written)")

    print()


if __name__ == "__main__":
    main()
