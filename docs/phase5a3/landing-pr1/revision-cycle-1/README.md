# Phase 5A.3 PR 1 — bounded revision cycle 1

Status: **REVISE**. PR `#1301` remains draft, open, unmerged, and unapproved.

This replacement packet is bound to production/evidence source
`64f015ee8be3a929c2239b7aa94abcac7e36aaa1`, tree
`4b3d17f8918392b7e375c6fbd1e2518a7ecdb66c`, over exact main
`61c52e73eed0393e24b0597d63c47cb7b5cdbe7e`. The prior `1f7ad2c0` packet and
its reviews remain unchanged as historical evidence.

## Corrections completed

- The prerequisite was merged normally; no landing commit was dropped.
- The global design-system skip control is the only initial skip link. It is first in
  keyboard order, targets/focuses landing `main`, and retains exact EN/PL/DE names.
- Primary and footer navigation have dedicated localized landmark names.
- EN/PL/DE landing titles are absolute and do not duplicate the root brand template.
- Live readiness mounts one shared auth probe. Signed-in users see Dashboard; signed-out
  users see signup/sign-in. Demo readiness mounts no auth provider and produces zero
  intended Supabase Auth, REST, or Realtime traffic.
- Live auth imports are deferred until the live-only effect runs. The cold landing uses
  a lean provider boundary only for an exact document request; RSC, prefetch, query, and
  forged requests retain the application boundary.
- The package disclosure is native server-rendered HTML and works without JavaScript.
  The theme control is hydration-stable and keeps a disabled no-JavaScript fallback.
- Both motion recordings now traverse first view, theme, package, Evidence, Method,
  Trust, final action, full footer, and terminal keyboard focus. Performance observers
  cover the complete journey in normal and reduced motion.

## Verified results

- Route JavaScript: `250,045` → `182,296` gzip bytes (`-67,749`, `-27.09%`),
  below the `180 KiB` landing target and inside unchanged regression thresholds.
- Mobile Lighthouse performance median: `0.97`; desktop: `1.00`.
- Mobile TBT maximum: `140 ms`; CLS maximum: `0`; TTFB maximum: `33.46 ms`;
  transfer maximum: `263,658 B`; font bytes: `0`.
- Desktop LCP median: `627.48 ms`; maximum: `807.22 ms`.
- Normal/reduced journeys: `0` CLS, `0` long tasks, `0` motion-attributable shifts,
  complete footer, dark terminal state, expanded package state, and focused Demo mode.
- Full unit suite: `6,731` passed, `19` skipped; design-system gate: `256` passed.
- PR Gate, Quality Gate, Lighthouse CI, Route-JS, CodeQL, dependency audit, license,
  hygiene, renderer attestation, and Golden Reference admission are green at the exact
  source. Immutable visual verification fails as the expected separate baseline gate.

## Blocking result

The final five mobile LCP samples are `2779.01`, `2410.05`, `2835.22`, `2310.64`, and
`2299.17 ms`. Median is `2410.05 ms` against the `2400 ms` limit, and two samples exceed
the `2500 ms` per-sample limit. No sample was removed or rerun. This remains a merge
blocker despite the substantial improvement from the retained `2558.5 ms` predecessor
median and `2708.2 ms` fresh corrected baseline.

Fresh Reviewer A returned **REVISE** and Reviewer B **REJECTED the exact candidate**.
Their additional findings cover live privacy-copy truth, readiness-aware demo metadata,
mobile navigation coverage, native-summary conformance, cross-renderer system-font
layout, and desktop identity repetition. Formal trademark assessment, qualified PL/DE
copy review, and representative physical device/assistive-technology review are also
unresolved. See [Decision request](DECISION_REQUEST.md) and [review synthesis](reviews/synthesis.md).

## Evidence map

- [Evidence contract](EVIDENCE_CONTRACT.md)
- [Validation and impact](VALIDATION_AND_IMPACT.md)
- [LCP diagnosis](LCP_DIAGNOSIS.md)
- [Source and artifact inventory](SOURCE_AND_ARTIFACT_INVENTORY.md)
- [Decision request](DECISION_REQUEST.md)
- [Fresh-review synthesis](reviews/synthesis.md)
- [Media/performance manifest](evidence/manifest.json)
- [Final performance and per-sample diagnostics](evidence/performance.json)
- [All one-variable cohorts](evidence/performance-trials.json)
- [Route-JS summary](evidence/route-js/summary.json)
- [Linux candidate summary](evidence/linux-candidate/summary.json)
