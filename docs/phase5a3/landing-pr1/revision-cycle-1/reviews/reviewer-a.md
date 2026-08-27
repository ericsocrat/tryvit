# Independent final review A

Disposition: **REVISE**. Reviewer advice only; no self-approval.

The reviewer did not read existing review files, reviewer scores, git history,
`performance-trials.json`, or implementation rationale before scoring.

## Findings

### P1 — live privacy copy contradicts live auth behavior

The landing says the public route does not initialize account functionality, hosted
lookup, or authenticated feature flags. In live readiness, `HomePageContent` mounts
`LivePublicAuthProvider`, which dynamically loads Supabase, calls `auth.getUser()`, and
subscribes to auth changes. The statement must become readiness-specific or accurately
describe the live auth probe.

### P1 — demo page metadata regresses readiness-aware truth

Landing metadata is localized but no longer receives readiness. Page metadata therefore
overrides the root with a generic description in demo readiness instead of explicitly
stating that live product data is unavailable. Visible copy and JSON-LD remain gated,
but metadata tests check only title/locales and a truthy description.

### P1 — exact mobile LCP gate fails

Final mobile LCP samples are `2779.0078`, `2410.0545`, `2835.2156`, `2310.6435`, and
`2299.1734 ms`. Median `2410.0545 ms` exceeds `2400 ms`, and two samples exceed
`2500 ms`. `performance.json` correctly records `passed: false`.

### P1 — admission and human gates remain open

The Linux images are deterministic candidates only and the immutable baseline remains
unchanged. Qualified PL/DE, professional legal review, Eric's identity-risk decision,
and representative device/AT review are absent.

### P2 — mobile primary navigation loses content destinations

At 390 CSS pixels, Evidence, Method, Trust, and Contact are hidden from the header
navigation, leaving only Demo mode/sign-in and theme. Hero actions retain Evidence and
Contact, but Method and Trust require a long scroll. Current E2E checks landmark naming,
not mobile destination coverage.

### P3 — native disclosure summary markup carries cross-browser risk

The `<summary>` directly contains a `<div>`. Chromium keyboard/no-JS behavior passes,
but phrasing-content wrappers would reduce Safari and screen-reader risk, particularly
because neither was tested.

## Evidence that passed

- Exact source/tree, all 54 manifest entries, and 8,050,692 bytes verified.
- All 13 final and 13 predecessor PNGs inspected; all three final and predecessor Linux
  landing candidates inspected.
- Both WebMs decoded and reviewed end-to-end: 154 frames/6.16 seconds normal and
  70 frames/2.8 seconds reduced; no black segment or truncation.
- Complete nine-checkpoint journeys, full footer, terminal Demo-mode focus, zero CLS,
  zero long tasks, and zero motion-attributable shifts/tasks.
- Strong/truthful standard EN first view, recognizable identity/package signature,
  reflow, forced colors, text spacing, no-JS, and footer containment.
- Route-JS passes at 182,296 bytes against 184,320; delta −67,749 bytes.
- Three Linux candidates are byte-identical across both passes.
- Focused source tests: 103/103 passed.

## Limitations

No Safari, qualified screen-reader, camera, or physical-device validation; 640 is an
effective-viewport proxy; final browser media is demo-only; live auth was reviewed from
source/tests rather than a live-backend capture; remote CI state was not independently
queried by this reviewer.
