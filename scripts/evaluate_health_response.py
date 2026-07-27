"""Interpret the public health endpoint for deployment smoke tests."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

READY_STATUSES = {"healthy", "degraded"}


def evaluate_health_response(http_status: int, response_body: str) -> tuple[bool, str]:
    """Return whether the response proves the data backend is available."""
    if not 200 <= http_status < 300:
        return False, f"data backend unavailable (HTTP {http_status})"

    try:
        payload = json.loads(response_body)
    except (json.JSONDecodeError, TypeError):
        return False, "health endpoint returned an invalid response"

    status = payload.get("status") if isinstance(payload, dict) else None
    if status not in READY_STATUSES:
        return False, "health endpoint did not report a ready state"

    return True, f"data backend {status} (HTTP {http_status})"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("http_status", type=int)
    parser.add_argument("body_file", type=Path)
    args = parser.parse_args()

    body = args.body_file.read_text(encoding="utf-8")
    ready, message = evaluate_health_response(args.http_status, body)
    print(message)
    return 0 if ready else 1


if __name__ == "__main__":
    raise SystemExit(main())
