# Phase 4E controlled category enrichment

Phase 4E extends the governed Phase 4B–4D enrichment architecture to four
authorized German scopes: Snacks, Instant & Frozen, Bread, and Spreads & Dips.
It reads only the committed OFF-derived snapshot and never connects to hosted
Supabase.

## Deterministic replay

1. Rebuild the canonical fixture and replay Phase 4B twice.
2. Replay Phase 4D twice and verify its committed report.
3. Run `python -m pipeline.phase4e_report --stage before --check`.
4. Apply only SQL files marked `-- Phase: 4E`.
5. Run `db/ci_post_phase4e.sql` and capture `--stage snapshot`.
6. Apply the same Phase 4E files and post-processing a second time.
7. Run `python -m pipeline.phase4e_report --stage report --check`.

The generated report separates explicit-only, derived-only, combined, and
unknown allergen evidence. Ambiguous tokens, artifacts, unknown tokens, and
unsafe child relationships are reported but never converted into linkages.

Historical Phase 4B and Phase 4D generated SQL, the Phase 4C governance
checksum, and the Phase 4D report checksum are protected by tests and replay
checks. Historical compatibility remains explicit and read-only.
