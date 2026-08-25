# Validation and impact

## Truth and metadata

Six EN/PL/DE × live/demo cases assert exact title, description, Open Graph title and
description, Twitter title and description, locale, WebSite description, privacy
statement, readiness behavior, and prohibited-claim absence.

Visible hero copy, route description, and WebSite JSON-LD share the same readiness
source. Demo copy explicitly states that live product data is paused. Live privacy
copy acknowledges only the existing-session check needed to choose the account action.
Demo privacy copy states that account/session lookup, camera, and product lookup are
not initialized and no hosted product fallback is used.

## Navigation, disclosure, and fold

- 320 and 390 expose Evidence, Method, Trust, Contact, Demo mode/live auth, and theme.
- No hidden mobile duplicates or horizontal document overflow were found.
- `summary` contains phrasing content only; native `details` remains server-rendered.
- Firefox and WebKit pass pointer and keyboard open/close in normal/reduced motion with
  JavaScript enabled and disabled.
- 390×844: heading, primary action, secondary action, and the full 166.38 px package
  signature are inside the viewport.
- 768×1024: both actions and the full 224.05 px package signature are contained.
- 1440×900: both actions and the full 224.05 px package signature are contained.
- Exactly one full lockup and one Poland/Germany descriptor own identity at every
  measured width.

## Performance

| Profile | Perf median | LCP median/max | TBT median/max | CLS max | TTFB median/max | Transfer median/max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobile | 0.98 | 2259.43 / 2260.90 ms | 71 / 79 ms | 0 | 15.67 / 24.45 ms | 263,535 / 263,536 B |
| Desktop | 1.00 | 563.47 / 591.06 ms | 0 / 7 ms | 0 | 11.47 / 13.98 ms | 263,536 / 263,554 B |

All strict Phase 5A.3 budgets pass. The mobile median improves by 150.63 ms from cycle
1, and the maximum improves by 574.31 ms. All five samples are now within the
2,500 ms ceiling.

Route-JS is `182,291 B` gzip, 2,029 B below the landing target and 5 B below cycle 1.
The stable base-owned comparator and unchanged regression policy pass.

## Automated verification

- focused source/unit contracts: 50 passed;
- complete frontend unit suite: 6,741 passed, 19 skipped;
- design-system gate: 256 passed;
- governed landing suite: 25 passed;
- Firefox/WebKit matrix: 8 passed;
- responsive smoke: 24 passed;
- TypeScript, full ESLint, and production build: pass;
- full-page WCAG 2.1 AA Axe: zero violations, no exclusions;
- complete normal/reduced journeys: zero CLS and zero motion-attributable long task or
  layout shift.

The original remote PR smoke run retained one deterministic failure because its generic
header test capped mobile headers at 80 px. The test was corrected to enforce the
authorized 88–120 px two-level header and all four mobile destinations; 24/24 then
passed. Production source and performance evidence did not change.

## Scope and rollback

Impact is limited to `/`, its route-local shell, and the narrow server metadata
contract already used by the root layout. Rollback is commit-local: revert
`14c8b19f` and the test-only `ab0a43ec`. Evidence commits remain independently
removable.

