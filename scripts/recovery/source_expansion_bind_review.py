"""Bind the fresh read-only production identity audit to the release manifest."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipeline.source_expansion import bind_production_review, sha256_bytes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--acquisition-manifest", required=True, type=Path)
    parser.add_argument("--confirm-acquisition-manifest-sha256", required=True)
    parser.add_argument("--production-review", required=True, type=Path)
    parser.add_argument("--confirm-production-review-sha256", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    manifest = bind_production_review(
        args.acquisition_manifest,
        args.confirm_acquisition_manifest_sha256,
        args.production_review,
        args.confirm_production_review_sha256,
        args.output,
    )
    print(
        json.dumps(
            {
                "accepted": len(manifest["entries"]),
                "held": len(manifest["held"]),
                "manifestSha256": manifest["manifestSha256"],
                "fileSha256": sha256_bytes(args.output.read_bytes()),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
