"""Strict validation for the scheduled refresh product limit."""

from __future__ import annotations

import argparse
import re

NON_NEGATIVE_INTEGER = re.compile(r"[0-9]+")


def parse_max_products(value: str) -> int:
    if NON_NEGATIVE_INTEGER.fullmatch(value) is None:
        raise ValueError("max_products must be a non-negative integer")
    return int(value)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("value")
    args = parser.parse_args()

    try:
        max_products = parse_max_products(args.value)
    except ValueError as error:
        parser.error(str(error))

    print(max_products)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
