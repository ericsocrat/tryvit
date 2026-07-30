# Phase 4E category enrichment report

Status: **PASS**

Selected: Spreads & Dips (DE), Bread (DE), Snacks (DE), Instant & Frozen (DE)

## Generated enrichment

- Products enriched: 635
- Products evaluated: 743
- Ingredient links generated: 8197
- Candidate ingredient rows: 12714
- Rejected candidate rows: 4517
- Untrusted raw-reference rows withheld: 3043
- Explicit contains records: 1158
- Explicit may-contain records: 1286
- Deterministic ingredient-derived records: 8
- Products with explicit evidence only: 125
- Products with derived evidence only: 1
- Products with both evidence types: 460
- Products remaining allergen-unknown: 49

## Overall coverage

- Ingredient coverage: 2679 -> 3314 (31.0% -> 38.3%)
- Known-allergen coverage: 1982 -> 2553 (22.9% -> 29.5%)
- Any-positive-allergen evidence: 2130 -> 2716 (24.6% -> 31.4%)
- Average score change: +0.0
- Average confidence change: +2.5

## Governance and safety

- No new aliases were needed; automatic exact matches are limited to taxonomy-backed identities with independent semantic metadata.
- Ambiguous tokens withheld: 112
- Unknown tokens withheld: 0
- Untrusted raw-reference tokens withheld: 3043
- Artifacts quarantined: 1
- Unsafe child tokens withheld: 1361
- Missing allergen evidence remains unknown.
- Non-target linkages and product identities, deprecated products, Phase 4B/4D linkages, and Phase 4C governance are unchanged.
- Hosted Supabase writes: none.

## Determinism

- Report checksum: `45da776c98ce7833dd18b6fd44b8bba38cf8ce97941af3f395a08f6feb4c3d4d`
- Ingredient checksum: `7f8493a1b67c0642cc5e6aebaeb1bac0`
- Allergen checksum: `a40319f730cb5c6df9757dc658eb5dff`
- First run equals rerun: true
- Protected Phase 4D report checksum: `926778d839da63584e0dcc8025b49147ed5b07fbfadc7485cfc2e480082a4268`

## Category coverage

| Scope | Products | Ingredient coverage | Allergen evidence | Links | Allergen records | Confidence | Score |
|---|---:|---:|---:|---:|---:|---:|---:|
| Bread (DE) | 195 | 46 -> 191 | 45 -> 190 | 1492 | 456 | +25.9 | +0.2 |
| Instant & Frozen (DE) | 198 | 0 -> 168 | 0 -> 166 | 3109 | 967 | +29.5 | +1.1 |
| Snacks (DE) | 152 | 0 -> 150 | 0 -> 145 | 1430 | 605 | +33.7 | +0.6 |
| Spreads & Dips (DE) | 198 | 0 -> 172 | 0 -> 130 | 2166 | 424 | +28.1 | +0.0 |

## Manual review still required

- Generic Starch requires a declared botanical source before it can map.
- Generic Vegetable Oil requires a named oil source before it can map.
- Raw snapshot tokens without independent taxonomy metadata remain untrusted and require review.
- Unknown and ambiguous source tokens in the report queue require domain review before any mapping.
- Missing producer allergen evidence remains unknown and cannot support allergen-free claims.
