# Checkpoint 1 validation and impact

> **Last updated:** 2026-08-17  
> **Status:** Final capture evidence; selection pending

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
path-containment, and exact-matrix checks before atomic staging.

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
- Evidence package: 3,112,982 bytes; this is review media, not application payload.
- Scanner recordings: 4,080–4,120 ms.
- Motion recordings: 4,560 ms (A), 4,920 ms (B), and 6,440 ms (C).
- No runtime dependency was added for candidate UI.
- Candidate routes are server-first with three bounded shared client islands for lookup,
  scanner state, and motion state.

Candidate-specific route-JS gzip, CSS gzip, LCP, TBT, CLS, and TTFB were not retained as
authoritative measurements. Therefore this checkpoint does not claim the final Phase 5
budgets are met by a future production migration. Production routes and immutable visual
baselines were not migrated or replaced.

The descendant-main Lighthouse cohort completed all 50 audits and safety assertions.
Its aggregate remained red because the local-authenticated mobile product score ranged
from `0.84` to `0.95` (`0.11`, above the `0.10` stability threshold) and retained five
known mobile LCP directional debts. This is recorded as lab instability/directional debt,
not as candidate performance certification or a candidate regression.

## Runtime provenance

- Playwright `1.62.1`
- Chromium `151.0.7922.34`
- Capture: Windows x64, Node `v24.11.1`, UTC, `en-US`, device scale factor 1
- Staging: Windows x64, Node `v24.11.1`, Sharp `0.35.3`, libvips `8.18.3`

## Authority limits

This evidence is not branded Safari certification, native Windows High Contrast,
assistive-technology approval, real camera/touch proof, field performance data, native
EN/PL/DE review, medical validation, trademark clearance, or production authorization.
