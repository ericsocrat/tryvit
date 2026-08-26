# Independent final review — Reviewer A

Disposition: **REVISE — 84/100**.

| Criterion | Score |
| --- | ---: |
| Selected-system fidelity | 16/20 |
| Comprehension/content | 14/15 |
| Responsive/localization | 11/15 |
| Motion/no-JS | 15/15 |
| Accessibility | 13/15 |
| Architecture/scope | 8/10 |
| Evidence/performance/legal candor | 7/10 |

## Engineering findings

- **P0:** None.
- **P1 — Strict mobile performance gates fail.** The five raw mobile reports give LCP
  `2821.25, 2630.71, 2672.31, 2612.07, 2617.58 ms`: median `2630.71 ms` against
  `2400 ms`, every sample above `2500 ms`, and TBT maximum `262 ms` against `200 ms`.
  Console errors and unexpected first-party 4xx are zero, but those passes do not
  offset the authoritative budget failures.
- **P1 — The authoritative Linux 390 specimen has a severe readable-text collision.**
  “TryVit / Oat drink” and “SYNTHETIC EXAMPLE” overlap into an unreadable block. The
  ledger correctly marks visual acceptance false. Both labels are absolutely
  positioned inside the fixed specimen in `frontend/src/app/_landing-v2/landing.module.css`.
- **P2 — Query-bearing landing URLs bypass the lean landing boundary.**
  `frontend/src/proxy.ts` rejects every `/` request containing a query string from the
  cold-landing classification. `frontend/src/app/layout.tsx` consequently mounts the
  application providers and Speed Insights outside QA. Common `/?utm_*` entry URLs
  therefore do not receive the architecture or performance boundary proved for exact
  `/`.
- **P3:** None.

## Human and operational gates

- `TRYVITE` EUTM `018026887` legal/identity decision;
- qualified Polish and German copy review;
- deployment-readiness and kill-switch confirmation;
- branded Safari, qualified screen-reader/voice-control, and physical-device review;
- separately authorized baseline acceptance.

## Inspection record

The reviewer inspected all 13 stills at original resolution, all three Linux landing
candidates, both social cards, both complete WebMs and checkpoint timelines, all ten
raw Lighthouse reports, performance forensics, geometry, truth/metadata,
cross-browser, Route-JS, the source boundary, the manifest/verifier, and production
source. Both videos decoded completely (`158` and `71` frames), Linux determinism was
byte-identical, and the verifier passed `67` files / `8,715,666` bytes bound to source
`6f675ffe8c4091ed98db2f53298fe4acc19f6895`.

No prior candidate score informed this review, and the reviewer changed no file or
external state.
