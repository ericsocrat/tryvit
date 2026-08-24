# Phase 5A.2 Checkpoint 2 — Golden Reference review handoff

> **Status:** Current main integrated; final corrected packet and independent review passed; exact-head CI and Eric approval pending
> **Production migration:** Prohibited
> **Capture source:** `7e44b4b4dad5cb940f9b4f3cb7f7579aa4f1cf59`
> **Capture tree:** `174cd4986085bb71946a1ed094b8093d996bd432`
> **Manifest SHA-256:** `ef97f4fb04a0a283d90392639d7d90ca13e7e189da2e68aab0cbb336cb24d5d7`

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

The committed packet contains 91 files and 7,461,860 bytes:

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

The initial 91/89, corrected-packet 93/95, and initial integrated conditional/HOLD
reviews remain historical. None approves this final packet. The initial integrated
review required localization, semantic dwell, evidence hierarchy, and identity
containment corrections; those corrections and zero-scroll capture binding are now
included in a new complete exact-source packet. The same three independent lanes
completed a bounded final recheck without seeing one another's result: PASS 94/100,
PASS 93.5/100, and non-taste PASS / PASS with no defect. The implementation agent does
not qualify; Eric's explicit approval remains required. The final scorecards and
comparisons are under `reviews/integration-cycle-1/`.

Native Polish/German review, trademark/legal clearance, real assistive-technology and
device testing, branded Safari, real camera/password-manager behavior, and production
performance remain unresolved. The system stack remains the rendered control. The
75,004-byte Manrope plus renamed restrained-serif comparison is review-only and awaits
an explicit later Eric choice; no font is adopted in production.

Keep the PR draft and unmerged. Stop for Eric after independent review and no more than
two bounded visual revision cycles.
