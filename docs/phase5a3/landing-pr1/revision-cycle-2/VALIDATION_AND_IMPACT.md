# Validation and impact

## Truth, metadata, and social assets

Six EN/PL/DE × live/demo cases cover exact title, description, Open Graph, Twitter,
locale, WebSite description, privacy, account/session behavior, social image URLs and
alt, trilingual rendered copy, and readiness-neutral manifest text.

Both generated social cards are inspected at original resolution. They use Folded
Label Register colors and geometry, contain English/Polish/German evidence language,
make no capability/readiness claim, and perform no remote font request.

## Accessibility and responsive behavior

- mobile descriptor, navigation, and synthetic metadata compute to at least 12 px;
- the native summary exposes the synthetic-example state to assistive technology;
- 320/390 expose all required destinations with no horizontal overflow;
- sticky anchors remain below the header at 768/1024/1440 in Chromium, Firefox, and
  WebKit;
- heading/actions/package remain first-fold contained at governed widths;
- full Axe, forced colors, text spacing, no-JS, and normal/reduced motion pass.

The authoritative Linux 390 image has one remaining overlap: the 12 px synthetic label
collides with the package name. This is a merge-blocking visual finding.

## Performance and runtime

The pinned Linux replacement cohort passes performance score, CLS, TTFB, transfer,
font, console, first-party 4xx, desktop LCP/TBT, and Route-JS. It fails:

- mobile LCP median `2630.71 > 2400 ms`;
- every mobile LCP sample `>2500 ms`;
- mobile TBT maximum `262 > 200 ms`.

Observed H1 paint is `154–288 ms`; the simulated element-render delay is
`2156–2364 ms`. See [LCP forensics](LCP_FORENSICS.md).

## Verification totals

- full unit: 415 files passed, 1 skipped; 6,746 tests passed, 19 skipped;
- design system: 30 files / 256 tests passed;
- landing review: 29 passed;
- pinned Linux Firefox/WebKit: 12 passed;
- type-check, full lint, production build, PR Gate, CodeQL, dependency/license, and
  hygiene pass on the replacement source;
- exact Linux two-pass candidates, fixture teardown, and no-backup runtime cleanup pass.

## Rollback

Revert replacement source `6f675ffe` plus the earlier Cycle 2 correction commits.
Evidence/review commits are separately removable. No database or hosted configuration
rollback is required.
