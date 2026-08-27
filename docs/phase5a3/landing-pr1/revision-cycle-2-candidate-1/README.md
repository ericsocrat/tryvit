# Phase 5A.3 PR 1 — bounded revision cycle 2

Status: **FRESH REVIEW PENDING**. PR `#1301` remains draft, open, unmerged, and
unapproved.

The production candidate is frozen at
`14c8b19fc7aa59f58811ef96989291e2b3893bfe`, tree
`251c6622f14ebfbf170882d33dafe326509da2a8`, over exact main
`61c52e73eed0393e24b0597d63c47cb7b5cdbe7e`. Commit `ab0a43ec` changes only
the generic mobile-header smoke contract; production files are byte-identical to the
freeze.

Revision cycle 1 remains immutable at tree
`e986591713654daf73a998b8bdb22318e01f4d5f`. This packet does not relabel,
rewrite, or remove any cycle-1 artifact.

## Corrections completed

- EN/PL/DE privacy copy now distinguishes live readiness from demo readiness. Live
  copy truthfully describes the minimal existing-session check; demo copy states that
  account/session lookup, camera, and product lookup are not initialized.
- Landing title, description, Open Graph, Twitter, locale, and WebSite JSON-LD now
  resolve from one EN/PL/DE × live/demo source. Demo metadata explicitly says live
  product data is paused. Live PL/DE WebApplication structured data is localized.
- One two-level header exposes Evidence, Method, Trust, Contact, service/auth state,
  and theme at 320 and 390 CSS pixels without JavaScript or duplicate hidden links.
- The native package disclosure now keeps only phrasing content inside `summary`.
  Firefox and WebKit cover pointer and keyboard open/close, normal/reduced motion,
  and JavaScript-on/off behavior.
- The header owns the one full TryVit lockup and Poland/Germany descriptor. The
  duplicate hero masthead is removed and responsive spacing is tightened around the
  unchanged Folded Label Register composition.
- First-fold geometry requires complete heading/primary-action containment, at least
  72 visible package pixels at 390, complete package containment at 768 and 1440, and
  both desktop actions fully visible. The captured result exceeds those thresholds.

## Exact performance closeout

The one permitted source-bound cohort retained all five mobile and five desktop
landing samples.

| Profile | Performance | LCP samples ms | Median / max | TBT max | CLS max | TTFB max | Transfer max | Fonts |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile | 0.98 median | 2260.90, 2259.43, 2259.64, 2258.55, 2257.91 | **2259.43 / 2260.90** | 79 ms | 0 | 24.45 ms | 263,536 B | 0 B |
| Desktop | 1.00 median | 554.80, 558.29, 591.06, 566.14, 563.47 | **563.47 / 591.06** | 7 ms | 0 | 13.98 ms | 263,554 B | 0 B |

The strict mobile median and every-sample LCP gates now pass. No sample was removed,
classified as infrastructure, or rerun.

Stable base-owned Route-JS run `32874788727` reports landing gzip
`250,043 → 182,291 B` (`−67,752 B`, `−27.1%`), below the unchanged
`184,320 B` target and inside the unchanged +10 KiB/+5% regression guard.

## Verification completed before sealing

- focused readiness/metadata/privacy/disclosure/provider contracts: 50/50;
- full unit suite: 6,741 passed, 19 intentionally skipped;
- design-system gate: 256/256;
- type-check, full lint, and repeated production builds;
- governed landing review: 25/25;
- Firefox/WebKit disclosure and mobile navigation: 8/8;
- responsive smoke correction: 24/24;
- serious/critical/full WCAG 2.1 AA Axe: zero violations, no exclusions;
- 320–1440 reflow, forced colors, text spacing, no-JavaScript, normal/reduced motion;
- CodeQL, dependency, license, repository-hygiene, Vercel, renderer-attestation, and
  Golden Reference admission checks on the production source.

The immutable visual-baseline mismatch remains intentionally red. It is not treated as
an implementation failure and is not changed by this PR.

## Human gates that remain open

- `TRYVITE` EUTM `018026887` remains a material trademark-similarity finding.
  This packet is not legal clearance.
- Qualified Polish and German review remains pending.
- WebKit is not branded Safari approval. No qualified screen-reader, voice-control,
  camera, or physical-device approval is claimed.
- Baseline acceptance remains a separately authorized later PR.

## Evidence map

- [Evidence contract](EVIDENCE_CONTRACT.md)
- [Validation and impact](VALIDATION_AND_IMPACT.md)
- [Source and artifact inventory](SOURCE_AND_ARTIFACT_INVENTORY.md)
- [Cycle comparison](CYCLE_COMPARISON.md)
- [Decision request](DECISION_REQUEST.md)
- [Performance ledger](evidence/performance.json)
- [Truth and metadata matrix](evidence/truth-and-metadata.json)
- [Geometry measurements](evidence/geometry.json)
- [Cross-browser ledger](evidence/cross-browser.json)
- [Motion ledger](evidence/landing-motion-performance.json)
- [Video validation](evidence/video-validation.json)
- [Route-JS summary](evidence/route-js/summary.json)
