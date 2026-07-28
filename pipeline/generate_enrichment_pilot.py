"""Generate the Phase 4A pilot's ordered ``02_enrichment`` SQL files.

The only source is a committed migration snapshot.  No network or database
connection is used, which makes generation safe for local use and CI.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

from pipeline.enrichment import (
    AllergenEvidence,
    IngredientEvidence,
    generate_enrichment_sql,
    linkable_matches,
    match_ingredients,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PILOT_PATH = Path(__file__).with_name("enrichment_pilot.json")

_SQL_STRING = r"'(?:''|[^'])*'"
_INGREDIENT_RE = re.compile(
    rf"^\s*\((?P<country>{_SQL_STRING}), (?P<ean>{_SQL_STRING}), "
    rf"(?P<name>{_SQL_STRING}), (?P<position>\d+), "
    rf"(?P<percent>NULL|-?\d+(?:\.\d+)?)::numeric, "
    rf"(?P<estimate>NULL|-?\d+(?:\.\d+)?)::numeric, "
    rf"(?P<sub>true|false), (?P<parent>NULL|{_SQL_STRING})\),?\s*$"
)
_ALLERGEN_RE = re.compile(
    rf"^\s*\((?P<country>{_SQL_STRING}), (?P<ean>{_SQL_STRING}), "
    rf"(?P<tag>{_SQL_STRING}), '(?P<kind>contains|traces)'\),?\s*$"
)
_REFERENCE_RE = re.compile(
    rf"^\s*\((?P<name>{_SQL_STRING}), (?P<additive>true|false), "
    rf"(?P<vegan>{_SQL_STRING}), (?P<vegetarian>{_SQL_STRING}), "
    rf"(?P<palm>{_SQL_STRING})\),?\s*$"
)


def _unquote(value: str) -> str:
    return value[1:-1].replace("''", "'")


def _none_or_text(value: str) -> str | None:
    return None if value == "NULL" else _unquote(value)


def load_pilot(path: Path = PILOT_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def parse_snapshot(
    path: Path,
) -> tuple[
    list[IngredientEvidence],
    list[AllergenEvidence],
    set[str],
    dict[str, tuple[bool, str, str, str]],
]:
    ingredients: list[IngredientEvidence] = []
    allergens: list[AllergenEvidence] = []
    reference_names: set[str] = set()
    reference_properties: dict[str, tuple[bool, str, str, str]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        reference = _REFERENCE_RE.match(line)
        if reference:
            data = reference.groupdict()
            name = _unquote(data["name"])
            reference_properties[name] = (
                data["additive"] == "true",
                _unquote(data["vegan"]),
                _unquote(data["vegetarian"]),
                _unquote(data["palm"]),
            )
            continue
        ingredient = _INGREDIENT_RE.match(line)
        if ingredient:
            data = ingredient.groupdict()
            name = _unquote(data["name"])
            reference_names.add(name)
            ingredients.append(
                IngredientEvidence(
                    country=_unquote(data["country"]),
                    ean=_unquote(data["ean"]),
                    source_text=name,
                    position=int(data["position"]),
                    percent=None if data["percent"] == "NULL" else data["percent"],
                    percent_estimate=(None if data["estimate"] == "NULL" else data["estimate"]),
                    is_sub_ingredient=data["sub"] == "true",
                    parent_source_text=_none_or_text(data["parent"]),
                )
            )
            continue
        allergen = _ALLERGEN_RE.match(line)
        if allergen:
            data = allergen.groupdict()
            allergens.append(
                AllergenEvidence(
                    country=_unquote(data["country"]),
                    ean=_unquote(data["ean"]),
                    source_tag=_unquote(data["tag"]),
                    kind=data["kind"],
                )
            )
    return ingredients, allergens, reference_names, reference_properties


def _folder_for(category: str, country: str) -> Path:
    slug = category.casefold().replace(" ", "-")
    if country != "PL":
        slug += f"-{country.casefold()}"
    return PROJECT_ROOT / "db" / "pipelines" / slug


def build_outputs(pilot_path: Path = PILOT_PATH) -> tuple[dict[Path, str], dict]:
    pilot = load_pilot(pilot_path)
    snapshot_path = PROJECT_ROOT / pilot["source"]
    ingredients, allergens, references, reference_properties = parse_snapshot(snapshot_path)
    selected = {(item["category"], item["country"], item["ean"]) for item in pilot["products"]}
    category_for = {(country, ean): category for category, country, ean in selected}
    ingredient_groups: dict[tuple[str, str], list[IngredientEvidence]] = defaultdict(list)
    allergen_groups: dict[tuple[str, str], list[AllergenEvidence]] = defaultdict(list)

    for row in ingredients:
        category = category_for.get((row.country, row.ean))
        if category:
            ingredient_groups[(category, row.country)].append(row)
    for row in allergens:
        category = category_for.get((row.country, row.ean))
        if category:
            allergen_groups[(category, row.country)].append(row)

    missing = sorted(
        (category, country, ean)
        for category, country, ean in selected
        if not any(row.country == country and row.ean == ean for row in ingredient_groups[(category, country)])
    )
    if missing:
        raise ValueError(f"Pilot products lack committed ingredient evidence: {missing}")

    outputs: dict[Path, str] = {}
    all_matches = []
    for category, country in sorted(ingredient_groups):
        matches = match_ingredients(ingredient_groups[(category, country)], references)
        all_matches.extend(matches)
        folder = _folder_for(category, country)
        slug = folder.name
        path = folder / f"PIPELINE__{slug}__02_enrichment.sql"
        outputs[path] = generate_enrichment_sql(
            category,
            matches,
            allergen_groups[(category, country)],
            pilot["source_label"],
            reference_properties,
        )

    classification = Counter(row.classification for row in all_matches)
    products_with_ingredients = {(row.evidence.country, row.evidence.ean) for row in all_matches}
    products_with_allergens = {(row.country, row.ean) for rows in allergen_groups.values() for row in rows}
    stats = {
        "pilot_products": len(selected),
        "products_with_ingredient_evidence": len(products_with_ingredients),
        "products_with_allergen_evidence": len(products_with_allergens),
        "ingredient_evidence_rows": len(all_matches),
        "linked_ingredient_rows": len(linkable_matches(all_matches)),
        "exact_matches": classification["exact"],
        "alias_matches": classification["alias"],
        "reviewed_matches": classification["reviewed"],
        "unresolved_matches": classification["unresolved"],
        "ambiguous_matches": classification["ambiguous"],
        "allergen_evidence_rows": sum(len(rows) for rows in allergen_groups.values()),
        "generated_files": len(outputs),
    }
    return outputs, stats


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if committed SQL is stale")
    parser.add_argument("--stats-json", action="store_true", help="print machine-readable statistics")
    args = parser.parse_args(argv)
    outputs, stats = build_outputs()
    stale: list[str] = []
    for path, content in outputs.items():
        if args.check:
            if not path.is_file() or path.read_text(encoding="utf-8") != content:
                stale.append(str(path.relative_to(PROJECT_ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
    if stale:
        print("Stale deterministic enrichment outputs:", file=sys.stderr)  # noqa: T201
        for path in stale:
            print(f"  {path}", file=sys.stderr)  # noqa: T201
        return 1
    print(json.dumps(stats, indent=2, sort_keys=True) if args.stats_json else stats)  # noqa: T201
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
