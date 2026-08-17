# Checkpoint 1 validation and impact

> **Last updated:** 2026-08-17
> **Status:** Final capture evidence; conditional hybrid selected

## Final guarded results

- Phase 5A.1 full regression cohort: 19/19 passed; governed contract counts unchanged.
- Phase 5A.2 final direction run: 13/13 passed.
  - Auth setup: 1
  - Behavior admission: 5
  - Bounded still matrix: 1
  - Candidate motion recordings: 3
  - Candidate scanner recordings: 3
- Final evidence verifier: passed.
- Candidate/runtime console and page errors: zero in the guarded run.
- Browser egress violations: zero in the guarded run.

The retained media package contains 21 PNG stills, 6 VP8 WebMs, and 7 contact sheets.
Every file passed bounded size, signature/container, dimensions, duration, frame, hash,
path-containment, and exact-matrix checks before atomic staging. Each recording began
only after route, font, paint, accessibility, and state admission; its first emitted
JPEG and decoded VP8 frame were non-uniform content at the expected dimensions.

## Behavior and accessibility coverage

The five behavior tests cover:

- all 21 studies across 320, 768, 1024, 1280, and 1440 widths;
- a 640 CSS-pixel viewport at 200% zoom;
- horizontal overflow and direct-text clipping checks;
- Polish text spacing and long German content;
- selected forced-color semantics and visible focus;
- serious/critical Axe violations;
- query and OS reduced-motion completion;
- controlled Combobox and Tabs keyboard behavior;
- scanner focus, cancel, matched, no-match, validation, manual entry, and recovery;
- repeated focused motion input and Chromium long-task observation.

No motion-attributable task above 50 ms was observed by the bounded Chromium test.
The entry gate separately passed 11/11 Firefox/WebKit primitive-admission tests; its
native-device and assistive-technology limitations remain documented in
[the entry-gate report](../../phase5/PHASE5A2_ENTRY_GATE_EVIDENCE.md).

## Performance evidence

- Candidate font transfer: 0 bytes. All routes render existing V2 system stacks.
- Evidence package: 2,844,649 bytes; this is review media, not application payload.
- Scanner recordings: 3,560 ms each (A, B, and C).
- Motion recordings: 3,760 ms (A), 4,040 ms (B), and 5,520 ms (C).
- No runtime dependency was added for candidate UI.
- Candidate routes are server-first with three bounded shared client islands for lookup,
  scanner state, and motion state.

Candidate-specific route-JS gzip, CSS gzip, LCP, TBT, CLS, and TTFB were not retained as
authoritative measurements. Therefore this checkpoint does not claim the final Phase 5
budgets are met by a future production migration. Production routes and immutable visual
baselines were not migrated or replaced.

The authoritative-main cohort preceding this capture includes a fully green Guarded
Lighthouse and Quality Gate on PR `#1287` ([Lighthouse run `31996203832`](https://github.com/ericsocrat/tryvit/actions/runs/31996203832),
[Quality Gate run `31996203862`](https://github.com/ericsocrat/tryvit/actions/runs/31996203862)).
PR `#1288` also passed its same-head Quality Gate
([run `31995500956`](https://github.com/ericsocrat/tryvit/actions/runs/31995500956)); its
Lighthouse aggregate ([run `31995500881`](https://github.com/ericsocrat/tryvit/actions/runs/31995500881))
failed only on variable local-authenticated mobile medians of `0.83` for `/app` and
`0.82` for `/app/product/2`. Its testing-only dependency diff, passing public/local
desktop audits, and within-sample threshold crossings classify that result as known lab
variance, not candidate or production-runtime regression.

The predecessor draft head `b62701d5` passed Guarded Lighthouse but exposed three
deterministic source/harness debts: descriptor-unbound evidence reads, a V2 architecture
allowlist that omitted the guarded review route, and late-scroll dismissal in the WebKit
Menu admission. Capture source `347a7d0a` contains focused corrections. Local proof is
green: 6,703 unit tests, the 244-test design-system check, 20/20 WebKit Menu stress,
20/20 Firefox Menu stress, the complete 11/11 cross-browser gate, and the final 13/13
direction run. GitHub checks for the replacement draft head were pending at package
authoring; the pull-request check rollup is the authoritative remote status.

## Runtime provenance

- Playwright `1.62.1`
- Chromium `151.0.7922.34`
- Capture: Windows x64, Node `v24.11.1`, UTC, `en-US`, device scale factor 1
- Staging: Windows x64, Node `v24.11.1`, Sharp `0.35.3`, libvips `8.18.3`

## Authority limits

This evidence is not branded Safari certification, native Windows High Contrast,
assistive-technology approval, real camera/touch proof, field performance data, native
EN/PL/DE review, medical validation, trademark clearance, or production authorization.
