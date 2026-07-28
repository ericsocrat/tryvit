# Phase 4B category enrichment report

**Status: PASS**

Four controlled categories evaluated 1085 active products. 941 evidence-backed products were selected and 941 gained ingredient coverage.

## Generated data

- Ingredient links created: **9988**
- Explicit source allergen records emitted: **2388**
- Total allergen records created after explicit evidence and the existing deterministic ingredient-to-allergen pass: **2420**
- Ambiguous tokens withheld: **27**
- Unmatched tokens withheld: **0**
- Known source artifacts quarantined: **2**
- Child tokens withheld because their parent was unsafe: **11**
- Mapping methods: 9986 exact, 13 normalized/reviewed alias, 0 explicitly reviewed

Missing evidence remains unknown; no allergen-free claim is produced.

## Coverage by selected category

| Category | Products | Ingredients before | Ingredients after | Allergen evidence before | Allergen evidence after | Confidence delta | Score delta |
|---|---:|---:|---:|---:|---:|---:|---:|
| Breakfast & Grain-Based (DE) | 199 | 0 (0.0%) | 195 (98.0%) | 0 (0.0%) | 193 (97.0%) | +34.0 | +0.7 |
| Dairy (DE) | 287 | 28 (9.8%) | 281 (97.9%) | 26 (9.1%) | 264 (92.0%) | +30.4 | +0.1 |
| Drinks (DE) | 300 | 45 (15.0%) | 294 (98.0%) | 14 (4.7%) | 87 (29.0%) | +23.1 | +0.4 |
| Sweets (DE) | 299 | 48 (16.1%) | 292 (97.7%) | 48 (16.1%) | 283 (94.6%) | +27.5 | +0.6 |

## Overall coverage

| Metric | Before | After |
|---|---:|---:|
| Ingredient-covered products | 933 (10.8%) | 1874 (21.7%) |
| Known contains evidence | 679 (7.8%) | 1389 (16.1%) |
| Average confidence | 61.5 | 65.0 |
| Average score | 21.3 | 21.3 |

## Determinism and isolation

- PASS — idempotent rerun
- PASS — non target categories unchanged
- PASS — duplicate keys absent
- PASS — deprecated products unchanged
- PASS — all selected products enriched
- PASS — generated ingredient links reconcile
- PASS — withheld classifications not linked

The first-run and rerun semantic linkage checksums are recorded in the JSON report.
