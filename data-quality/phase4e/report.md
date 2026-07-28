# Phase 4E category enrichment report

Status: **PASS**

Selected: Snacks (DE), Instant & Frozen (DE), Bread (DE), Spreads & Dips (DE)

## Generated enrichment

- Products enriched: 645
- Products evaluated: 743
- Ingredient links generated: 12826
- Candidate ingredient rows: 13005
- Rejected candidate rows: 179
- Explicit contains records: 1166
- Explicit may-contain records: 1292
- Deterministic ingredient-derived records: 23
- Products with explicit evidence only: 108
- Products with derived evidence only: 2
- Products with both evidence types: 481
- Products remaining allergen-unknown: 54

## Overall coverage

- Ingredient coverage: 2679 -> 3324 (31.0% -> 38.4%)
- Known-allergen coverage: 1982 -> 2558 (22.9% -> 29.6%)
- Any-positive-allergen evidence: 2130 -> 2721 (24.6% -> 31.4%)
- Average score change: +0.1
- Average confidence change: +2.6

## Governance and safety

- No new aliases were needed; all linkages use the Phase 4C registry and exact canonical identities.
- Ambiguous tokens withheld: 115
- Unknown tokens withheld: 0
- Artifacts quarantined: 1
- Unsafe child tokens withheld: 63
- Missing allergen evidence remains unknown.
- Non-target linkages and product identities, deprecated products, Phase 4B/4D linkages, and Phase 4C governance are unchanged.
- Hosted Supabase writes: none.

## Determinism

- Report checksum: `dd4cd47f0cf7bec4068f32e2edb34ce348d630d5eaac9dde1a2dd792886f0607`
- Ingredient checksum: `fb70c1467a4344c3522f496c03215446`
- Allergen checksum: `1f4617006d38d669920b84d6a57c7a53`
- First run equals rerun: true
- Protected Phase 4D report checksum: `926778d839da63584e0dcc8025b49147ed5b07fbfadc7485cfc2e480082a4268`

## Category coverage

| Scope | Products | Ingredient coverage | Allergen evidence | Links | Allergen records | Confidence | Score |
|---|---:|---:|---:|---:|---:|---:|---:|
| Bread (DE) | 195 | 46 -> 192 | 45 -> 190 | 1986 | 456 | +26.0 | +0.2 |
| Instant & Frozen (DE) | 198 | 0 -> 173 | 0 -> 168 | 5501 | 984 | +30.3 | +2.2 |
| Snacks (DE) | 152 | 0 -> 151 | 0 -> 147 | 2457 | 614 | +34.0 | +0.9 |
| Spreads & Dips (DE) | 198 | 0 -> 175 | 0 -> 131 | 2882 | 427 | +28.5 | +0.1 |

## Manual review still required

- Generic Starch requires a declared botanical source before it can map.
- Generic Vegetable Oil requires a named oil source before it can map.
- Unknown and ambiguous source tokens in the report queue require domain review before any mapping.
- Missing producer allergen evidence remains unknown and cannot support allergen-free claims.
