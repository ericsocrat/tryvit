# Phase 4C Enrichment Governance Report

Status: **PASS**

Phase 4C adds governance only. It creates no new category batch and no product linkage changes.

## Registry summary

| Decision class | Registry entries | Observed Phase 4B occurrences |
|---|---:|---:|
| Approved global aliases | 2 | 13 |
| Approved scoped aliases | 3 | 0 |
| Ambiguous and withheld | 2 | 27 |
| Source artifacts quarantined | 2 | 2 |
| Unsafe dependent children withheld | 5 rules | 11 |

## Known-token review

- `Starch`: 23 occurrences remain withheld. The source does not identify corn, potato, or wheat.
- `Vegetable Oil`: 4 occurrences remain withheld. No specific oil is inferred.
- Nutrition artifacts: 2 occurrences are quarantined and cannot link or derive allergens.
- Parent-child safety: 11 child rows remain withheld beneath unsafe parents.

## Allergen provenance

| Provenance | Records |
|---|---:|
| Explicit source `contains` | 1278 |
| Explicit source `may contain` | 1110 |
| Deterministic ingredient-derived only | 32 |
| Total provenance union | 2420 |
| Products unknown due to missing evidence | 202 |

Missing evidence is never interpreted as allergen-free.

## Drinks DE finding

The low known-allergen coverage is primarily genuine absence of source declarations in the selected beverage records. Only two additional records are supported by deterministic ingredient rules; there are no ambiguous Drinks tokens withholding allergen evidence. The dominant unknown-product tokens are water, acids, sugar, flavourings, juices, and vitamins, so missing evidence remains unknown rather than allergen-free.

Of 249 selected Drinks products, 176 remain unknown. Explicit source evidence contributes 76 contains and 41 may-contain records; deterministic ingredient rules add 2 records.

## Determinism and compatibility

- Governance checksum: `c4d400d67c3bc04b45d29331cb9495c45672e3d8b613ead992771203469e0e37`
- Phase 4B products enriched: 941
- Phase 4B ingredient links: 9988
- Phase 4B allergen records: 2420
- Phase 4C linkage, coverage, score, and confidence changes: zero
- Non-target categories and deprecated products: unchanged
- Hosted Supabase writes: none

## Manual review still required

- A botanical source declaration is required before Starch can map to corn, potato, or wheat starch.
- A named oil source is required before Vegetable Oil can map to a specific oil.
- The source tokens Stärke Weizen and Stärke Mais should be re-reviewed if a corrected or more specific source declaration becomes available.
- Allergen absence claims require explicit producer evidence; unknown Drinks records cannot be classified as allergen-free.
