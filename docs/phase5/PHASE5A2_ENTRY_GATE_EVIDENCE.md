# Phase 5A.2 entry-gate evidence

Status: admitted for guarded direction-selection work

Observed: 2026-08-17

Reference route: `/dev/components` (existing Phase 5A.1 gate; no new capture cases)

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

## Authority limitations

This gate proves the pinned Playwright engines on the guarded desktop profile.
It is not branded Firefox or Safari certification and does not prove native
Windows High Contrast, macOS Safari, browser-chrome traversal, assistive
technology combinations, real touch hardware, or coarse-pointer behavior.
Those claims require later human/native-device evidence. Existing Chromium
visual, forced-color, and coarse-pointer evidence remains unchanged.
