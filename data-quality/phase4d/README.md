# Phase 4D controlled category enrichment

Phase 4D extends the Phase 4A/4B deterministic enrichment engine to four
category-country scopes selected from a ranking calculated after the merged
Phase 4C baseline. The Phase 4C registry remains the only authority for exact
identities, aliases, ambiguity, artifacts, parent-child safety, and allergen
derivation.

## Reproduce locally

Use a fresh local PostgreSQL replay matching `.github/workflows/qa.yml`. After
Phase 4B has been applied and verified:

1. Run `python -m pipeline.phase4d_report --stage before --check`.
2. Apply only pipeline files carrying the exact marker `-- Phase: 4D`.
3. Run the category-scoped `db/ci_post_phase4d.sql`.
4. Run `python -m pipeline.phase4d_report --stage snapshot`.
5. Apply the Phase 4D files and the scoped post-processing script a second time.
6. Run `python -m pipeline.phase4d_report --stage report --check`.

The committed ranking, selection, before snapshot, generated SQL, and final
report are deterministic CI inputs. Hosted Supabase projects are never used.

## Safety boundary

- No fuzzy or semantic linkage writes.
- Missing allergen evidence remains unknown.
- Ambiguous tokens and source artifacts cannot create links.
- Children of an unsafe parent remain withheld.
- Non-target and deprecated products must retain their checksums.
- Historical Phase 4B artifacts and the Phase 4C governance checksum must not drift.
