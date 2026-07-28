# Phase 4A deterministic enrichment pilot

## Scope and category choice

Phase 4A is limited to 18 products across three categories:

- **Frozen Vegetables (PL, 6 products):** includes short, structured labels and compound prepared-vegetable products.
- **Chips (DE, 6 products):** exercises inconsistent German/English tokens, nested ingredients, generic terms, and extensive declared/trace evidence.
- **Meat (PL, 6 products):** exercises long compound formulations and meaningful contains/may-contain declarations.

The pilot uses the committed OFF-derived snapshot in
`supabase/migrations/20260601173035_populate_ingredients_allergens.sql`. It performs no network request and does not connect to either hosted Supabase project.

## Data flow

The standard generator retains explicit `ingredients`, `allergens_tags`, and
`traces_tags` evidence from its normalized product input. For the three pilot
scopes it writes an ordered `PIPELINE__*__02_enrichment.sql` between product
identity (`01`) and nutrition/scoring (`03`/`04`). The SQL:

1. ensures only the required committed ingredient references exist;
2. resolves products by `(country, EAN, category)`;
3. links unambiguous ingredients in source order;
4. records only explicit `contains` and `traces` allergen evidence; and
5. uses conflict-safe inserts, so reruns do not update timestamps or create rows.

Scoring remains step `04`, after enrichment. The post-enrichment CI reconciliation now also scores every active category-country pair, covering categories omitted by its historical hard-coded list.

## Matching and allergen semantics

Ingredient matching has four linkable outcomes and two non-linkable outcomes:

- `exact`: source text is an exact committed reference name;
- `alias`: conservative normalization or an explicit spelling alias;
- `reviewed`: a mapping explicitly recorded in `enrichment_registry.json`;
- `unresolved`: no reliable reference;
- `ambiguous`: multiple plausible references, deliberately withheld.

Sub-ingredients are withheld when their parent is unresolved or ambiguous. No
fuzzy matching, LLM, paid API, or runtime network service is used.

Allergens retain `contains` and `traces` separately and preserve the original
tag in `source_tag`. Missing tags and missing ingredient text remain **unknown**.
There is no negative or "allergen-free" state in the generated SQL.

## Reproducible results

The canonical Phase 3 baseline in `data-quality/baselines/ci-v1.json` contains
8,552 active products. (The 8,652 figure in the audit brief does not match the
checked-in baseline or the reproduced database.) The baseline and post-pilot
reports both passed with zero data-quality failures and zero warnings.

| Metric | Before | After | Result |
|---|---:|---:|---|
| Active products | 8,552 | 8,552 | stable |
| Product-ingredient rows, overall | 13,356 | 13,678 | +322 |
| Product-ingredient rows, pilot | 0 | 322 | populated |
| Products with ingredient links, pilot | 0/18 in pilot output | 18/18 (100%) | target met |
| Overall ingredient coverage | 961 (11.2%) | 979 (11.4%) | +18 products |
| Products with usable allergen evidence, pilot | 16 | 16 | stable evidence set |
| Known allergen coverage, pilot evidence | — | 16/16 (100%) | target met |
| Overall known-contains coverage | 694 (8.1%) | 708 (8.3%) | +14 products |
| Usable core nutrition | 8,552 (100.0%) | 8,552 (100.0%) | stable |
| Valid EAN | 8,545 (99.9%) | 8,545 (99.9%) | stable |
| Missing critical identity | 0 | 0 | stable |
| Duplicate pilot ingredient/allergen keys | 0 | 0 | stable |
| Data-quality failures / warnings | 0 / 0 | 0 / 0 | stable |

The deterministic source pass classified 333 ingredient tokens: 321 exact, 4
alias, 2 reviewed, 0 unresolved, and 6 ambiguous (1.8%). Five otherwise matched
sub-ingredients were also withheld because their ambiguous parent was not
linked, leaving 322 linkable rows. The two pilot products without explicit
allergen tags remain unknown.

Applying all three enrichment files a second time produced identical checksums
for `product_ingredient` and `product_allergen_info`. The database QA suite
passed 769/769 checks after scoring reconciliation; its non-blocking Source
Coverage suite remains informational and is unrelated to Phase 4A.

## Expansion recommendation and limitations

The architecture is safe to expand category by category because identity,
classification, ordering, SQL, and allergen semantics are deterministic and
CI-enforced. Expansion should remain gated on reviewed registries and per-batch
metrics. It should not become a full-catalog backfill yet.

Known limitations:

- exact matching preserves some noisy but already committed reference names;
- source-language ingredient label text has no dedicated provenance column;
- ambiguity review is intentionally manual and small;
- the pilot proves linkage and safety, not full semantic cleanup of the ingredient dictionary.

No Phase 3 threshold or baseline was changed. No scanner, country expansion,
production demo messaging, hosted Supabase data, or paid service is included.
