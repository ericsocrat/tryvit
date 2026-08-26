# Independent final non-taste QA

Result: **FAIL**.

## Factual blockers

1. Raw mobile Lighthouse reports reproduce LCP `2821.2529, 2630.7072, 2672.3067,
   2612.0706, 2617.5804 ms`: median `2630.7072 ms` against `2400 ms`, every sample
   above `2500 ms`, and TBT maximum `262 ms` against `200 ms`.
2. The authoritative Linux 390 image visibly overlaps “Synthetic example” with
   “TryVit / Oat drink.”
3. Query-bearing initial landing requests are not lean landing requests. A
   `GET /?source=client` request receives the application boundary because any search
   string is rejected by `isColdLandingDocumentRequest`; that mounts `Providers` and,
   outside QA, `SpeedInsights`. The exact `/` Route-JS/no-client-debt evidence does not
   cover common query-bearing landing entries.

## Checks that passed

- The exact 67-file manifest has no duplicates; every SHA-256 and byte value matches,
  total size is `8,715,666 B`, and the supplied verifier passes.
- Source `6f675ffe8c4091ed98db2f53298fe4acc19f6895`, tree
  `e82f1ce3b0f9fdfd8d41f02b04fb8d25a5b81da6`, build provenance, Route-JS artifacts,
  and Linux determinism bind consistently.
- The six EN/PL/DE × live/demo states, metadata, JSON-LD, manifest, and both rendered
  social assets validate; a focused fresh run passed 12 files / 98 tests.
- All 13 stills, all three Linux candidates, and both complete videos were inspected;
  the videos decode as 158/71 frames and 6.32/2.84 seconds.
- Exact-width geometry, navigation, containment, and anchors pass at
  320/390/768/1024/1440 except for the cited Linux collision.
- No-JS, reduced motion, forced colors, text spacing, Axe, and the 12-case
  Firefox/WebKit matrix pass.
- Desktop performance and the remaining mobile score/CLS/TTFB/transfer/font/console/
  first-party-4xx budgets pass; all ten reports have zero console errors and zero
  first-party 4xx.
- Route-JS is `182,291 B` gzip against `184,320 B`.
- PR Gate, Quality Gate, Route-JS, CodeQL, dependency, license, hygiene, renderer,
  screenshots, and deterministic-candidate checks pass. The separate Lighthouse CI
  failure is accurately recorded.
- No dependency-value, lockfile, immutable-baseline, database/API/RLS, or additional
  route-family drift was found.

No prior review score informed this audit, and the auditor changed no file or external
state.
