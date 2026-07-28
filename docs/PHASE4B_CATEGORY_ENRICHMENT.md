# Phase 4B controlled category enrichment

## Scope and selection

Phase 4B ranks 55 existing category-country pipelines using active product
volume, missing ingredient and allergen coverage, committed source completeness,
token safety, expected coverage gain, and a barcode/search relevance proxy. No
search-event dataset exists, so the relevance proxy is 70% product volume and
30% valid-EAN coverage.

The phase selects four distinct, existing DE categories:

| Rank | Category | Why selected |
|---:|---|---|
| 1 | Dairy | Highest reliable coverage gain and explicit allergen evidence for most selected products. |
| 2 | Sweets | Large ingredient/allergen gain with a 0.1% token ambiguity rate. |
| 4 | Drinks | High scan relevance, 97.6% source completeness, and no directly ambiguous selected token. |
| 6 | Breakfast & Grain-Based | 98.0% source completeness, dense evidence, and strong everyday relevance. |

Ranks 3 and 5 are PL versions of categories already represented by higher-ranked
DE scopes. Selecting the next distinct category keeps this batch category-level
and avoids turning it into a country expansion. The complete ranking and inputs
are in `data-quality/phase4b/candidate-ranking.json` and
`data-quality/phase4b/selected-products.csv`.

## Controlled architecture

Phase 4B extends the Phase 4A generator and registry. It does not create a
parallel backfill path. Each committed `02_enrichment.sql` file:

1. is restricted to its approved category, country, active-product state, and EAN list;
2. resolves normalized exact matches first and reviewed registry aliases second;
3. emits no fuzzy, semantic, or runtime AI match;
4. withholds ambiguous, conflicting, unknown, and unsafe child tokens;
5. records allergens only from explicit source tags or the existing deterministic ingredient rule pass; and
6. uses conflict-safe inserts and stable ordering.

Missing allergen evidence remains unknown. It never becomes an allergen-free
claim. The generator uses only the committed OFF-derived snapshot and never
connects to a hosted Supabase project.

## Reproduced results

The canonical fresh CI-style database contains 8,652 active products after
Phase 4A. Phase 4B evaluates 1,085 products in the four selected categories and
enriches all 941 evidence-backed products that were missing ingredient links.

| Metric | Result |
|---|---:|
| Products enriched | 941 |
| Ingredient links created | 9,988 |
| Explicit canonical source-allergen records emitted | 2,388 |
| Total allergen records created after deterministic derivation | 2,420 |
| Exact ingredient matches | 9,986 |
| Reviewed alias matches | 13 |
| Ambiguous token occurrences withheld | 27 |
| Unmatched token occurrences withheld | 0 |
| Source artifacts quarantined | 2 |
| Child tokens withheld because their parent was unsafe | 11 |

The 13 aliases are `Sunflower` to `Sunflower Oil` (7) and `Rapeseed` to
`Rapeseed Oil` (6). The ambiguity queue contains `Starch` (23 occurrences) and
`Vegetable Oil` (4). `Kcal` and `Kcal 0 8` are quarantined nutrition-label
artifacts, not ingredients.

## Coverage change

| Category | Ingredient coverage | Allergen-evidence coverage |
|---|---:|---:|
| Breakfast & Grain-Based (DE) | 0.0% → 98.0% | 0.0% → 97.0% |
| Dairy (DE) | 9.8% → 97.9% | 9.1% → 92.0% |
| Drinks (DE) | 15.0% → 98.0% | 4.7% → 29.0% |
| Sweets (DE) | 16.1% → 97.7% | 16.1% → 94.6% |
| Overall catalog | 10.8% → 21.7% | 7.8% → 16.1% |

Average confidence rises from 61.5 to 65.0. Average product score remains 21.3;
the selected-category score changes range from +0.1 to +0.7 and result from the
existing deterministic scoring pass.

## Determinism and rollout gate

Two identical applications produced the same semantic checksums:

| Scope | Product-ingredient | Product-allergen |
|---|---|---|
| All active products | `7612f103bbc2dd31117d1609df191b64` | `39795bd2c395efb59c050153a0a980dd` |
| Selected categories | `882ee4f0332f0dd70c6580520f6fb797` | `3eb0b4f21e3d7b09164e92e09ae8a3b4` |
| Non-target categories | `32e9324880c77b8bb52879ed48c4ae39` | `2277d975d9f263ec769cfe703af8321f` |

The rerun created no duplicate keys, changed no deprecated-product links, and
left all non-target category checksums unchanged. CI regenerates the ranking,
selection, before snapshot, first-run snapshot, and rerun report from scratch.

The architecture is safe for another similarly bounded category batch after
manual review of:

- the 23 `Starch` and 4 `Vegetable Oil` ambiguity occurrences;
- whether new explicit aliases have sufficient label-level evidence;
- low allergen-source completeness in Drinks, which must remain unknown rather than inferred;
- any new ingredient-derived allergen rule and its tests; and
- the next batch's category ranking, source snapshot, and isolation report.

It is not yet approved for a full-catalog backfill. No baseline or data-quality
threshold is weakened, and no hosted Supabase project is read from or modified.
