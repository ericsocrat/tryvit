# Phase 5A.2 Checkpoint 2 — Golden Reference review handoff

> **Status:** Bounded typography replacement captured; fresh review, exact-head CI, and Eric approval pending
> **Production migration:** Prohibited
> **Capture source:** `9fe14f14e00185cc1f1319d132e6853fa90e1723`
> **Capture tree:** `5d8911cb326b0356e3a89a1a304dcea8c86b79bb`
> **Manifest SHA-256:** `10662acdc566f445b6c30615c6c7ed87954c1ea689d48d3a5bab6fbe61d0cfd5`

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

The committed packet contains 91 files and 7,280,743 bytes:

- 36 core stills: six references × 390/768/1440 × light/dark;
- 12 localized stills: Polish mobile and long-German desktop for each reference;
- six meaningful forced-color stills;
- six complete state/recovery contact sheets built from 59 raw state captures;
- 12 complete VP8 recordings: normal and reduced motion per reference;
- seven conceptual identity/typography/glyph boards plus a dark typography composition;
- exact runtime, journey, five-sample performance, font-assay, resilience, and
  manifest JSON plus the three assayed WOFF2 and two OFL files.

The raw 59-state matrix, 12 terminal motion stills, and all 150 candidate files remain
artifact material rather than committed binary files. The repository verifier checks
every retained byte, hash, dimension, WebM container, path, provenance value, count,
and the 15 MiB ceiling.

## Review boundary

The earlier initial and replacement reviews remain historical. Their 91/89 scores do
not approve this correction packet. Two new fresh-context reviewers must independently
inspect every retained original, including both 1440×900 typography boards and all
changed recordings, before seeing one another's scores. A third non-taste lane verifies
every original PNG and the hash comparison. The implementation agent does not qualify.

Native Polish/German review, trademark/legal clearance, real assistive-technology and
device testing, branded Safari, real camera/password-manager behavior, and production
performance remain unresolved. The system stack remains the rendered control. The
75,004-byte Manrope plus renamed restrained-serif comparison is review-only and awaits
an explicit later Eric choice; no font is adopted in production.

Keep the PR draft and unmerged. Stop for Eric after independent review and no more than
two bounded visual revision cycles.
