# Phase 4D category enrichment report

Status: **PASS**

Selected: Sweets (PL), Frozen & Prepared (DE), Dairy (PL), Meat (DE)

## Generated enrichment

- Products enriched: 805
- Ingredient links generated: 11051
- Explicit contains records: 1128
- Explicit may-contain records: 1081
- Deterministic ingredient-derived records: 18
- Products remaining allergen-unknown: 128

## Overall coverage

- Ingredient coverage: 1874 -> 2679 (21.7% -> 31.0%)
- Known-allergen coverage: 1389 -> 1982 (16.1% -> 22.9%)
- Average score change: +0.1
- Average confidence change: +3.0

## Governance and safety

- No new aliases were needed; all linkages use the Phase 4C registry and exact canonical identities.
- Ambiguous tokens withheld: 70
- Unknown tokens withheld: 2
- Artifacts quarantined: 1
- Unsafe child tokens withheld: 39
- Missing allergen evidence remains unknown.
- Non-target linkages and product identities, deprecated products, Phase 4B linkages, and Phase 4C governance are unchanged.
- Hosted Supabase writes: none.

## Determinism

- Report checksum: `926778d839da63584e0dcc8025b49147ed5b07fbfadc7485cfc2e480082a4268`
- Ingredient checksum: `d364b44eb61b91d9acdf05d02285f590`
- Allergen checksum: `ab563f248d7d21d77659a5aae1c6a8b0`
- First run equals rerun: true

## Manual review still required

- Generic Starch requires a declared botanical source before it can map.
- Generic Vegetable Oil requires a named oil source before it can map.
- Unknown and ambiguous source tokens in the report queue require domain review before any mapping.
- Missing producer allergen evidence remains unknown and cannot support allergen-free claims.
