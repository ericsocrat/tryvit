"""Create the immutable release manifest from a completed acquisition run."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipeline.source_expansion import build_release_manifest, sha256_bytes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--selection", required=True, type=Path)
    parser.add_argument("--confirm-selection-sha256", required=True)
    parser.add_argument("--acquisition-receipt", required=True, type=Path)
    parser.add_argument("--confirm-acquisition-sha256", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    manifest = build_release_manifest(
        args.selection,
        args.confirm_selection_sha256,
        args.acquisition_receipt,
        args.confirm_acquisition_sha256,
        args.output,
    )
    print(
        json.dumps(
            {
                "accepted": len(manifest["entries"]),
                "held": len(manifest["held"]),
                "notFound": len(manifest["notFound"]),
                "fetchFailed": len(manifest["fetchFailed"]),
                "manifestSha256": manifest["manifestSha256"],
                "fileSha256": sha256_bytes(args.output.read_bytes()),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
