# Validation and impact

## Performance

Final exact-source five-run Lighthouse results:

| Profile | Perf median | LCP samples ms | LCP median / max | TBT median / max | CLS max | TTFB median / max | Transfer median / max |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Mobile | 0.97 | 2779.01, 2410.05, 2835.22, 2310.64, 2299.17 | 2410.05 / 2835.22 | 90 / 140 ms | 0 | 20.01 / 33.46 ms | 263,657 / 263,658 B |
| Desktop | 1.00 | 620.90, 627.48, 639.93, 594.47, 807.22 | 627.48 / 807.22 | 11 / 133 ms | 0 | 15.66 / 30.98 ms | 263,659 / 263,675 B |

Mobile performance, desktop performance, TBT, CLS, TTFB, transfer, and zero-font
budgets pass. Mobile LCP fails median by `10.05 ms` and fails the per-sample maximum in
two retained runs. See `evidence/performance.json` and `evidence/performance-trials.json`.

The exact H1 remains LCP at 354×186 mobile and 594×318 desktop. Raw observed LCP equals
FCP near the beginning of the trace; the high simulated samples are Lantern cutoff
races that include a follow-up Next/React layout task in the pessimistic graph. They
remain valid under the governing judge.

## Route JavaScript

| Revision | Total gzip | Shared gzip | Route-owned gzip |
| --- | ---: | ---: | ---: |
| Main `61c52e73` | 250,045 B | 248,799 B | 1,246 B |
| Source `64f015ee` | 182,296 B | 179,066 B | 3,230 B |
| Delta | **−67,749 B** | −69,733 B | +1,984 B |

The stable base-owned comparator passes and the landing is below its 184,320-byte
target. Authenticated shell and product-detail deltas also remain inside unchanged
regression limits.

## Accessibility, resilience, and journey

- Serious/critical/full WCAG 2.1 AA Axe: zero violations, no exclusions.
- One initial skip link; first keyboard stop; exact EN/PL/DE naming; `main` focus and
  subsequent Evidence progression.
- Dedicated localized primary/footer navigation names.
- 320 reflow, forced colors, PL text spacing, EN/PL/DE, no-JS light/dark, and 640
  effective-viewport proxy pass without horizontal overflow.
- Native package disclosure works with JavaScript disabled.
- Demo readiness produces zero intended Auth/REST/Realtime/flags traffic and zero font
  or image transfers.
- Normal/reduced recordings include the complete footer and terminal visible focus;
  both record zero CLS, long tasks, attributable shifts, and attributable long tasks.

## Local and CI verification

- Full Vitest: 413 files passed, 1 skipped; 6,731 tests passed, 19 skipped.
- Design-system gate: 30 files and 256 tests passed; token artifacts current.
- TypeScript, full ESLint, production builds, guarded landing review (19/19), and visual
  safety assertions passed.
- Exact-source PR Gate, Quality Gate, Lighthouse CI, Route-JS, CodeQL, dependency audit,
  license, hygiene, renderer attestation, and Golden Reference admission passed.
- Open code-scanning alerts: 0. Open secret-scanning alerts: 0. Inherited Dependabot
  alerts: #92–#94; no package or lockfile changed.
- Current exact main `61c52e73` is certified by Main Gate/Sonar run `32835024932`.
  Exact feature-head Main Gate is unavailable before merge and is not claimed.
- Immutable visual verification fails as the required separate baseline boundary;
  manual candidate/determinism run `32858309119` passed byte-for-byte.

## Impact and rollback

The production change remains limited to `/`, its route-local shell, a lean cold-document
provider boundary, and shared live-auth loading behavior. No database, API, scanner,
authenticated route migration, PWA icon, service worker, package, hosted configuration,
or immutable baseline changed. Native links force a full document when leaving the lean
landing; incoming RSC navigation retains the full application provider boundary.

Rollback is commit-local: revert the landing production commits and inventory update.
Evidence and review commits are separately removable.

## Fresh-review result

Reviewer A returned `REVISE`; Reviewer B rejected the exact candidate. Beyond the hard
LCP failure, the synthesis retains live privacy-copy/readiness-metadata truth issues,
390px navigation coverage, native-summary conformance risk, Linux/system-font first-fold
divergence, and desktop identity repetition. These are source findings, not evidence
clerical issues; no post-review production change was made.
