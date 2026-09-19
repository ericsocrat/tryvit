"""CLI for the frozen, bounded source-expansion acquisition."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipeline.source_expansion import acquire_selection, sha256_bytes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--selection", required=True, type=Path)
    parser.add_argument("--confirm-selection-sha256", required=True)
    parser.add_argument("--output-directory", required=True, type=Path)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    receipt = acquire_selection(
        args.selection,
        args.confirm_selection_sha256,
        args.output_directory,
        resume=args.resume,
        on_progress=lambda processed, total: print(
            json.dumps({"processed": processed, "total": total}), flush=True
        ),
    )
    print(
        json.dumps(
            {
                "result": receipt["result"],
                "counts": receipt["counts"],
                "receiptSha256": sha256_bytes((args.output_directory / "receipt.json").read_bytes()),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
