# Phase 5A.3 PR 1 — bounded revision cycle 2 replacement

Status: **REVISE**. PR `#1301` remains draft, open, unmerged, and unapproved.

Replacement production source:
`6f675ffe8c4091ed98db2f53298fe4acc19f6895`, tree
`e82f1ce3b0f9fdfd8d41f02b04fb8d25a5b81da6`, over exact main
`61c52e73eed0393e24b0597d63c47cb7b5cdbe7e`.

The first cycle-2 candidate and its rejected packet are retained unchanged under
`revision-cycle-2-candidate-1/`. Cycle 1 remains immutable at tree
`e986591713654daf73a998b8bdb22318e01f4d5f`.

## Replacement corrections

- readiness-truthful EN/PL/DE privacy, metadata, Open Graph, Twitter, and WebSite
  structured data;
- one complete two-level mobile navigation and one header-owned identity;
- conforming native disclosure with an accessible synthetic-example context;
- 12 px minimum critical mobile metadata;
- measured sticky-anchor offsets at 768, 1024, and 1440;
- trilingual, readiness-neutral Open Graph and Twitter images with no remote font or
  score/health/scan claims;
- capability-neutral manifest copy with no instant/health-score claim;
- no Speed Insights client on exact cold `/`, eliminating the retained first-party
  404 and console error;
- complete Firefox/WebKit, JavaScript-on/off, normal/reduced, and tablet-anchor
  coverage.

## What now passes

- full unit: 6,746 passed / 19 skipped;
- design system: 256 passed;
- landing review: 29/29;
- pinned Linux Firefox/WebKit: 12/12;
- type-check, full lint, repeated production builds;
- full Axe with no exclusions;
- zero landing console errors, unexpected first-party 4xx, font requests, or image
  transfers;
- Route-JS: `182,291 B` gzip against a `184,320 B` target;
- 13 stills, two full recordings, social images, no-JS, forced colors, text spacing,
  and first-fold containment;
- two-pass Linux byte determinism and fixture/no-backup teardown.

## Blocking result

The one allowed replacement cohort ran in the pinned Linux container and retained all
samples.

| Profile | Performance | LCP samples ms | Median / max | TBT max | CLS max | TTFB max | Transfer max |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Mobile | 0.96 median | 2821.25, 2630.71, 2672.31, 2612.07, 2617.58 | **2630.71 / 2821.25** | **262 ms** | 0 | 44.10 ms | 260,291 B |
| Desktop | 1.00 median | 549.82, 589.62, 582.19, 544.25, 565.36 | 565.36 / 589.62 | 5 ms | 0 | 25.43 ms | 260,290 B |

Every mobile LCP sample exceeds 2500 ms; median exceeds 2400 ms; one TBT sample
exceeds 200 ms. The bounded forensic review found the previously documented
Lighthouse/Lantern cutoff pattern and no new causal source not already rejected.
No third experiment or unchanged cohort rerun is authorized.

The authoritative Linux 390 still also exposes visible overlap between the enlarged
synthetic-example label and the package name. Correcting it would change production
after the final allowed cohort, so it remains an explicit REVISE finding rather than
being hidden or silently recaptured.

## Open gates

- strict mobile LCP/TBT and Linux 390 overlap;
- `TRYVITE` EUTM `018026887` legal/identity decision;
- qualified Polish and German review;
- operational confirmation that deployment configuration/kill switch matches actual
  service readiness;
- branded Safari, qualified AT/voice control, and physical-device review;
- separately authorized baseline acceptance.

## Evidence map

- [Evidence contract](EVIDENCE_CONTRACT.md)
- [Validation and impact](VALIDATION_AND_IMPACT.md)
- [LCP forensics](LCP_FORENSICS.md)
- [Source and artifact inventory](SOURCE_AND_ARTIFACT_INVENTORY.md)
- [Cycle comparison](CYCLE_COMPARISON.md)
- [Decision request](DECISION_REQUEST.md)
- [Performance](evidence/performance.json)
- [Truth and metadata](evidence/truth-and-metadata.json)
- [Social previews](evidence/social-previews.json)
- [Geometry](evidence/geometry.json)
- [Cross-browser](evidence/cross-browser.json)
- [Route-JS](evidence/route-js/summary.json)
- [Linux candidates](evidence/linux-candidate/summary.json)
