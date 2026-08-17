# Phase 5A.2 entry-gate evidence

Status: admitted for guarded direction-selection work

Observed: 2026-08-17

Reference route: `/dev/components` (existing Phase 5A.1 gate; no new capture cases)

This document records the historical entry baseline. Final candidate provenance is
separate and authoritative in
[`docs/phase5a2/checkpoint-1/evidence/manifest.json`](../phase5a2/checkpoint-1/evidence/manifest.json).

## Exact-main provenance

- Source commit: `39b8313575bac4eaab53fbf34f1aefd7cd1d497f`
- Single parent: `040baae678d39105a5c1ef0aa09dec5090981f61`
- Tree: `427828e117bdb8c0b5573e384e9ef573ba8c62bd`
- PR `#1270`: merged
- Exact-main Main Gate, CodeQL, repository hygiene, production deployment, and
  post-deploy smoke: terminal success at preflight
- Open code-scanning alerts: zero
- Open secret-scanning alerts: zero

The Phase 5A.2 branch was created directly from the fetched `origin/main` commit
above. The obsolete local `main` and the prior Phase 5A.1 branch were not used.

## Current-main Nightly classification

One manual Nightly Suite was dispatched against the exact source commit:

- Run: `31975941032`
- Attempt: `1`
- Event: `workflow_dispatch`
- URL: <https://github.com/ericsocrat/tryvit/actions/runs/31975941032>
- Data Integrity Audit: passed
- Full Test Suite: failed at unit coverage before browser execution

The failure is a deterministic workflow-environment defect. The workflow sets
`NEXT_PUBLIC_QA_MODE=1` globally. `useAnalytics` correctly suppresses tracking
in QA mode, while nine analytics tests in `use-analytics.test.tsx` expect the
tracking mock to be called. Focused local reproduction produced:

- `NEXT_PUBLIC_QA_MODE` unset: 10 of 10 tests passed
- `NEXT_PUBLIC_QA_MODE=1`: the same 9 failures and 1 pass as Nightly

Disposition: recorded as separate CI-environment debt. It is not a product,
primitive, accessibility, security, governance, or data-integrity defect and
does not block the guarded creative checkpoint. The unchanged workflow was not
rerun, and the creative branch does not contain a Nightly-scope fix.

## Firefox and WebKit primitive admission

The new suite is behavior-only and uses the existing guarded visual-safety
launcher. It cannot import filesystem/capture modules, take screenshots, write
catalog artifacts, or alter the immutable Chromium baselines.

Final local acceptance run:

- Playwright: `1.62.1`
- Firefox: `153.0`, Playwright build `1538`
- WebKit: `26.5`, Playwright build `2336`
- Auth setup: passed
- Firefox journeys: 5 of 5 passed
- WebKit journeys: 5 of 5 passed
- Total final run: 11 of 11 passed (one auth setup plus ten primitive journeys)
- Runtime console/page errors: zero
- Browser egress violations: zero
- Screenshots/recordings produced by the admission projects: zero

The five shared journeys cover:

1. Dialog: controlled opening, accessible-name references, initial focus,
   Tab/Shift+Tab containment, rejected background focus, nested Menu and
   Combobox ownership, Escape/outside dismissal, and explicit focus restore.
2. Sheet: the same modal contract with heading-first initial focus.
3. Menu: Arrow entry, Home/End, typeahead, disabled inertness, controlled
   checkbox state, Escape/Tab/outside dismissal, and trigger restoration.
4. Combobox: controlled open/value state, navigation, selection persistence,
   valid `aria-controls`/`aria-activedescendant`, portal ownership, and
   Escape/Tab/outside dismissal.
5. Tabs: controlled value state, manual activation, one roving tab stop,
   Home/End, RTL-reversed horizontal arrows, reciprocal tab/panel IDs, and a
   selected state that remains explicit without color.

Every journey verifies reduced-motion final state. Forced-color emulation must
be active in each engine; composite shadows are removed and state remains
available through roles, relationships, attributes, text, and focus rather than
color alone. The frozen Chromium catalog remains the visual and pixel authority.

## Harness correction discovered during admission

WebKit follows Safari's convention that pointer-clicking a button does not
necessarily focus it. A pointer-opened catalog Dialog/Sheet therefore could not
infer the trigger from `document.activeElement`. The primitive already exposes
the correct `restoreFocusRef` API. The catalog probe now supplies explicit
Dialog and Sheet trigger refs, without changing its rendered initial state,
capture paths, schema, case count, or PNG count.

The catalog probes also use controlled props for Menu open state, Combobox open
and value state, and Tabs value state. These are artifact-neutral reference
harness changes; no production consumer or route changed.

## WebKit anchored-interaction hardening

Two predecessor Quality Gate runs exposed the same WebKit-only late-scroll race in the
top-level Menu admission. Playwright could resolve `scrollIntoViewIfNeeded()`, open the
Menu, and then deliver the queued document scroll; the primitive correctly dismissed
the now-stale anchored popup. The production Menu scroll contract remains unchanged.

The harness now arms a capture-phase scroll revision probe before programmatic scroll,
requires four quiet animation frames inside a one-second bound, focuses with
`preventScroll`, verifies focus, and cleans the probe before opening. Local zero-retry
acceptance passed 20/20 WebKit Menu repetitions, 20/20 Firefox repetitions, and the
complete 11/11 cross-browser gate. No sleep, retry, forced reopening, screenshot, or
catalog artifact was added.

## Authority limitations

This gate proves the pinned Playwright engines on the guarded desktop profile.
It is not branded Firefox or Safari certification and does not prove native
Windows High Contrast, macOS Safari, browser-chrome traversal, assistive
technology combinations, real touch hardware, or coarse-pointer behavior.
Those claims require later human/native-device evidence. Existing Chromium
visual, forced-color, and coarse-pointer evidence remains unchanged.

## Final Checkpoint 1 capture binding

- Candidate source: `347a7d0a6cd1d060a28487a92315f83f30347bc5`
- Candidate tree: `4c07194ac13111988fbaef0f4c9f18c62d882a8c`
- Phase 5A.1 full regression cohort: 19 of 19 passed; governed counts unchanged
- Phase 5A.2 final guarded direction run: 13 of 13 passed
- Staged package: 35 files, 2,844,649 bytes
- Contents: 3 candidates, 21 stills, 6 WebMs, 7 contact sheets, 1 manifest
- Manifest SHA-256:
  `9c10d0243b5208319fc8c3b1497ca9dae552f7fdfd899823ae2fca39f8993c1e`

This binding supersedes the entry SHA only for candidate evidence. The original SHA,
Nightly classification, and cross-browser admission above remain the historical gate.

## Authoritative-main advancement

After the original entry gate, authoritative `main` advanced to
`24b4555cb3d118dc64b46f75ebfd434a655c3498`. PR `#1287` passed both Guarded Lighthouse
([run `31996203832`](https://github.com/ericsocrat/tryvit/actions/runs/31996203832))
and Quality Gate
([run `31996203862`](https://github.com/ericsocrat/tryvit/actions/runs/31996203862)).
PR `#1288` passed its same-head Quality Gate
([run `31995500956`](https://github.com/ericsocrat/tryvit/actions/runs/31995500956)); its
Lighthouse aggregate ([run `31995500881`](https://github.com/ericsocrat/tryvit/actions/runs/31995500881))
failed only on variable local-authenticated mobile performance medians: `/app` at `0.83`
and `/app/product/2` at `0.82`, against `0.85`. Public and local-desktop audits, safety,
cleanup, and the testing-only dependency change were otherwise green, so that isolated
result remains known lab variance rather than candidate, dependency-runtime, or harness
regression.

The candidate branch was rebased onto that verified descendant and the evidence above
was regenerated from exact source `347a7d0a` and tree `4c07194a`. A predecessor draft
head then exposed three deterministic, non-lab defects: a descriptor-read TOCTOU alert,
an architecture allowlist missing the guarded Phase 5A.2 route, and the WebKit scroll
race documented above. The bound capture source includes focused fixes for all three;
local unit, design-system, cross-browser stress, and direction-review gates are green.
Remote checks for the replacement draft head were pending at package authoring and must
be read from the pull-request check rollup.
