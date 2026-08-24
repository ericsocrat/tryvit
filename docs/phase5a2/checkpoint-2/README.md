# Phase 5A.2 Checkpoint 2 — Golden Reference review handoff

> **Status:** Bounded typography replacement captured; fresh review, exact-head CI, and Eric approval pending
> **Production migration:** Prohibited
> **Capture source:** `14620a61c702838565eca2916b98af5cd4a572c1`
> **Capture tree:** `de3a00e15099b5f1ca0b5ee521017f195a93b04c`
> **Manifest SHA-256:** `164244174aa7a276389084ff3887b8b6de88d03c50dd9da784f540124eb8f2a1`

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

The committed packet contains 85 files and 7,188,422 bytes:

- 36 core stills: six references × 390/768/1440 × light/dark;
- 12 localized stills: Polish mobile and long-German desktop for each reference;
- six meaningful forced-color stills;
- six complete state/recovery contact sheets built from 59 raw state captures;
- 12 complete VP8 recordings: normal and reduced motion per reference;
- seven conceptual identity/typography/glyph boards plus a dark typography composition;
- exact runtime, journey, five-sample performance, font-assay, and manifest JSON.

The raw 59-state matrix, 12 terminal motion stills, and all 149 candidate files remain
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
