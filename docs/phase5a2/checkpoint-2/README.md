# Phase 5A.2 Checkpoint 2 — Golden Reference review handoff

> **Status:** Initial selected-hybrid packet ready for independent review
> **Production migration:** Prohibited
> **Capture source:** `abe34fc2e359393859237bb321b43ca69761ea1f`
> **Capture tree:** `7c70deb3939aae092cf322fa6787bb7e05551439`
> **Manifest SHA-256:** `9d3f20d30595b3704c00010148065577a411a47c0adc4dc5b5d728980c9451e4`

This packet implements exactly six complete non-production Golden References:

1. landing;
2. authentication;
3. authenticated home;
4. search and filters;
5. product and evidence;
6. scanner.

The selected system is **Folded Label Register**: Source Fold owns the master identity,
warm editorial expression, folded-package metaphor, vector imagery, and brand motion;
Evidence Register owns decision-first product architecture, evidence ordering, compact
density, confidence, missingness, comparison, and recovery.

## Guarded review routes

The routes require local authentication and exact server flag
`PHASE5A2_DIRECTION_SELECTION=1` in every environment:

```text
/dev/phase5a2/golden/landing
/dev/phase5a2/golden/authentication
/dev/phase5a2/golden/home
/dev/phase5a2/golden/search
/dev/phase5a2/golden/product
/dev/phase5a2/golden/scanner
/dev/phase5a2/golden-assets/[board]
```

Query input is fail-closed and limited to `locale`, `theme`, `motion`, `state`, and
`capture=1`. Checkpoint 1 candidate routes and evidence are unchanged.

## Evidence packet

The committed packet contains 82 files and 6,376,336 bytes:

- 36 core stills: six references × 390/768/1440 × light/dark;
- 12 localized stills: Polish mobile and long-German desktop for each reference;
- six meaningful forced-color stills;
- six complete state/recovery contact sheets built from 59 raw state captures;
- 12 complete VP8 recordings: normal and reduced motion per reference;
- seven identity/typography/glyph boards;
- exact runtime, journey, and manifest JSON.

The raw 59-state matrix, 12 terminal motion stills, and all source captures remain
artifact material rather than committed binary files. The repository verifier checks
every retained byte, hash, dimension, WebM container, path, provenance value, count,
and the 15 MiB ceiling.

## Review boundary

Two fresh-context reviewers must independently inspect every retained still, recording,
contact sheet, and board before seeing one another's scores. The implementation agent
does not qualify. Scores do not approve the work and cannot average away a veto.

Native Polish/German review, trademark/legal clearance, real assistive-technology and
device testing, branded Safari, real camera/password-manager behavior, and production
performance remain unresolved. The system stack remains the rendered typography
control; no candidate font is adopted.

Keep the PR draft and unmerged. Stop for Eric after independent review and no more than
two bounded visual revision cycles.
