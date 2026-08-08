# Phase 5A.0e — Performance and Product Accessibility Remediation

> **Status:** Remediation is implemented on draft stacked PR #1260. The last
> published exact head removed three of four blockers; the final app-shell
> correction is locally verified and still requires the authoritative five-run
> exact-head gate. The Phase 5A.0d measurement contract and immutable visual
> baselines remain unchanged.

## Scope

Phase 5A.0e is a narrow remediation phase. It reduces unnecessary client work,
defers disabled telemetry and closed UI, corrects verified accessibility
semantics, and removes inactive locale dictionaries from eager client
JavaScript. The serialized message contract passes the request-matched
dictionary and, for non-English requests, the reviewed English fallback. It
does not authorize a redesign, new copy, layout changes, dependency changes,
new product-data behavior, or weaker gates.

The final stacked base is synchronized Phase 5A.0d head
`a8645fb27aac77ea491cc89290b70a94665a6876`. Its ancestry contains the normal
merge of `main` at `958baec8ffff7dd3f9a8ca639b27da7bfd2c303a`; the later commits
only repair the trusted stacked-PR gate triggers. The synchronization did not
alter product behavior or dependency versions and preserves the reviewed
Phase 5A.0d scripts, thresholds, fixtures, and measurement infrastructure.

## Authoritative synchronized baseline

GitHub Lighthouse run
[`31261014258`](https://github.com/ericsocrat/tryvit/actions/runs/31261014258)
measured five runs for every route/profile combination on the exact synchronized
head. Artifact `9022959345` has archive digest
`sha256:c294e39039b121d3b9c482868119282fb050279c5618b83a44b40949ea1cb6f1`.
The compact report checksum is
`97be2e5f8d7a229f317c0ca207c83f27ba3a77b553facf4f00462dd8dc2e81d6`.
All four provenance entries identify the exact head, Node `v22.21.1`, and
Chromium `151.0.7922.34`.

| Route/profile | Performance median (range) | Accessibility | LCP | TBT | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: |
| Landing mobile | 0.92 (0.05) | 1.00 | 3,025.3 ms | 144.0 ms | 511.1 KiB |
| Login mobile | 0.92 (0.16) | 1.00 | 3,125.3 ms | 134.0 ms | 503.2 KiB |
| Contact mobile | 0.90 (0.04) | 1.00 | 3,499.5 ms | 132.0 ms | 507.2 KiB |
| App shell mobile | 0.58 (0.04) | 1.00 | 6,833.0 ms | 794.0 ms | 881.1 KiB |
| Product detail mobile | 0.71 (0.10) | 0.92 | 4,082.4 ms | 796.8 ms | 907.8 KiB |
| App shell desktop | 0.98 (0.01) | 1.00 | 1,098.3 ms | 52.4 ms | 921.6 KiB |
| Product detail desktop | 0.98 (0.01) | 0.93 | 1,127.8 ms | 56.5 ms | 937.7 KiB |

Blocking failures are:

- app-shell mobile performance below 0.85;
- product-detail mobile performance below 0.85;
- product-detail mobile accessibility below 0.95;
- product-detail desktop accessibility below 0.95.

Login mobile also has a 0.16 performance range, above the preserved 0.10
stability limit. Directional debt remains visible for public mobile LCP,
authenticated mobile LCP/TBT, and product mobile transfer size.

The exact-head route-JavaScript run
[`31261014255`](https://github.com/ericsocrat/tryvit/actions/runs/31261014255)
passed and retained artifact `9022858376` with archive digest
`sha256:bbcaadd8ac93486e5a3bf9599d322ae015edda56c193f49c0db7e9e42877a083`.
Its head report checksum is
`0f9f96976aa254b96b3c981dee53aad63b5ce6eb764c8e4cff1a910da02c4b56`.

| Route | Initial gzip | Shared gzip | Route-owned gzip |
| --- | ---: | ---: | ---: |
| Landing | 415.3 KiB | 415.0 KiB | 0.3 KiB |
| Login | 419.6 KiB | 411.8 KiB | 7.7 KiB |
| Contact | 417.6 KiB | 415.0 KiB | 2.6 KiB |
| App shell | 761.9 KiB | 748.1 KiB | 13.8 KiB |
| Product detail | 783.4 KiB | 748.1 KiB | 35.3 KiB |

The landing 180 KiB and contact 150 KiB goals remain directional debt. They are
not relabeled as passing.

## Root-cause evidence

Detailed raw Lighthouse reports and traces were captured after dependency
synchronization at `60ce8044d63d628bb34385839598aea5c1b05319`. The production
source and dependency trees are byte-identical between that diagnostic commit
and the authoritative `959c0ac7…` head; intervening changes affect only the
visual workflow, its test, and Phase 5A.0d documentation. The authoritative
Linux cohort above remains the numeric baseline.

### Authenticated app shell

All five mobile diagnostics select the existing `NutritionTip` paragraph as
LCP. The representative trace attributes 93% of its 6.76-second LCP to render
delay. The browser dashboard RPC itself completes in approximately 7–43 ms.
The delay is therefore not database latency: `/app` is a wholly client-side
page that first renders `DashboardSkeleton`, starts `api_get_dashboard_data`
after hydration, and only then replaces the skeleton with the new-user view.
The parent authenticated layout already has a per-request server Supabase
client and Query provider, and the product route already proves the repository's
dehydration pattern.

The existing product route demonstrates that server-prefetching would remove
this waterfall, but Phase 5A.0e deliberately does not apply that pattern to the
dashboard. The production service worker's inherited default runtime cache can
retain same-origin HTML and RSC responses. Dehydrating recent views, favorites,
and user statistics into `/app` would therefore widen a pre-existing private
cache risk on shared browsers. The client-only dashboard boundary remains
unchanged; any future personalization prefetch must follow a separate PWA
private-cache safety correction. This phase first tests whether removing the
much larger disabled-telemetry cost is sufficient to clear the gate.

### Authenticated shared JavaScript

Mobile traces attribute most main-thread work to script evaluation. The
authenticated app and product routes share about 748 KiB gzip before
route-owned code. Signature-based chunk inspection found approximately 440 KiB
gzip of requested Sentry SDK, replay, tracing, and semantic-convention code—
about 58% of the retained authenticated shared-JavaScript baseline—even though
the measurement build has an empty `NEXT_PUBLIC_SENTRY_DSN`.

The source confirms why: client instrumentation initializes Sentry eagerly,
the web-vitals handler uses a static `require`, and browser error boundaries
statically import the SDK. `enabled: false` disables delivery but does not
remove download, parse, or evaluation cost. The correction must use one shared,
memoized, DSN-guarded dynamic client adapter. Configured telemetry must preserve
the existing sampling, PII scrubbing, error context, message metadata, and
router transition contract; disabled telemetry must not evaluate the SDK.
Server-only Sentry paths are outside this change.

### Product-detail accessibility

The accessibility failures are deterministic across all five runs:

- `CategoryPlaceholder` applies `aria-label` to a roleless `div`, producing
  `aria-prohibited-attr` on mobile and desktop. The container represents one
  graphical placeholder and requires `role="img"` with its existing label.
- The mobile Lists navigation link visibly renders a count before “Lists” but
  forces the accessible name to only “Lists”, producing
  `label-content-name-mismatch`. The same risk exists for the compare count on
  More. The accessible name should derive from the visible count and label in
  the same order.

Current authenticated accessibility E2E omits product detail, so the regression
must be added at mobile and desktop viewports using the guarded local fixture.

### Public variability

The obsolete historical desktop login scores are not reproduced. Current
desktop scores are stable and high. The synchronized Linux cohort did reproduce
one mobile login score-range failure while public category medians remained
above their floors. No login-specific optimization is authorized without a
repeatable product cause. The five-run post-change cohort must determine whether
that range is persistent measurement variance or a current runtime defect; the
variance rule will not be weakened.

## Remediation and verification boundary

Implemented remediation is limited to:

1. defer browser Sentry loading behind the existing public DSN, with a single
   memoized adapter and the configured sampling, filtering, context, and router
   contract retained;
2. give the product placeholder valid image semantics, align visible navigation
   badge text with its accessible name, and audit product detail at both guarded
   authenticated viewports;
3. lazy-load returning-dashboard sections, closed authenticated overlays, and
   collapsed product full-analysis code while retaining the original fallback,
   focus, tab, refresh, offline-precache, and error-containment behavior;
4. reuse the preferences already resolved by the authenticated server layout
   instead of issuing the same browser preferences RPC, and remove the
   demonstrably unused FlagProvider startup without deleting its dormant API;
5. serve a request-matched message dictionary synchronously for SSR/hydration,
   load later locale choices as public static chunks, and commit copy,
   `html[lang]`, store state, and toast translation coherently;
6. suppress speculative pre-LCP RSC prefetches for the persistent mobile
   navigation and the two new-user dashboard CTAs. Click navigation is
   unchanged;
7. on exactly `/app`, defer the list badge, avoid-list, and favorites queries
   until the existing dashboard query settles and the primary dashboard
   response has had a two-frame paint opportunity. The release is tied to the
   exact dashboard query instance, re-arms after cache replacement, and is
   cancelled during navigation. Nested authenticated routes retain immediate
   hydration, and the cache-only observer neither creates nor mutates the
   dashboard query;
8. split country and default-language metadata from the broad product-domain
   constants module while preserving reference-identical compatibility exports.
   Persistent shell consumers therefore avoid loading allergen, scoring,
   category, and health-goal constants that they never use.

Dashboard data remains client-only. A server-prefetch/dehydration experiment
was rejected because the existing service-worker runtime cache could retain
private dashboard data. The locale payload contains public copy only. Service-
worker policy itself is unchanged and its broader authenticated-cache boundary
is a separate security follow-up.

## Published remediation evidence

Exact head `51931c8bca1df76320bb463846500e770cb52a10` passed PR Gate,
Quality Gate, the immutable visual verifier, route-JavaScript guard, CodeQL,
repository hygiene, screenshots, exact-head Main Gate, and SonarCloud. The
visual verifier retained semantic checksum
`12a00dc37191191b788964d1c599d103aa0fedb1c15fa8cc36ad80d746953716`
with no diff images. SonarCloud reported Quality Gate OK, Security A,
Reliability A, zero vulnerabilities, zero bugs, and zero hotspots.

That head reduced the authenticated app route from 761.9 to 376.7 KiB gzip and
product detail from 783.4 to 405.8 KiB gzip relative to the synchronized base.
Product mobile performance reached the blocking floor at 0.85, and product
accessibility rose from 0.92/0.93 to 0.96/0.96 on mobile/desktop. App mobile
improved from 0.58 to 0.81 but remained the sole performance-floor blocker.
The exact five-run report checksum is
`332b44ca9a52c6bcfd9719084e68e32910e92341db4151639351c27086d8cd71`.

The next diagnosis found that the English fixture still downloaded a
101,483-byte gzip client chunk containing all three EN/PL/DE dictionaries and
issued nine irrelevant authenticated RSC prefetches before the new-user LCP.
The subsequent correction splits those dictionaries and disables only those
speculative prefetches. A local production build emits separate EN, PL, and DE
chunks of 31,298, 35,247, and 35,315 gzip bytes. None is referenced by any of
the 66 initial client-reference manifests, all three are present in the fresh
`/sw.js` precache, and no combined-locale chunk remains.

Exact head `13978e9e1d86b007e8b097c79a4b71ef428207bc` passed PR Gate,
Quality Gate, visual-baseline verification, Bundle Size Guard, CodeQL,
repository hygiene, exact-head Main Gate, and SonarCloud. Its route-JavaScript
evidence reduced the authenticated app route to 290,174 bytes gzip and product
detail to 319,800 bytes gzip. The authoritative Lighthouse rerun completed all
five samples and cleanup with zero instability failures. Product mobile passed
at 0.88, but app mobile remained the sole blocker at 0.84 against the unchanged
0.85 floor; its median LCP was 4,153.6 ms and TBT was 175 ms. Report checksum:
`d860b7cbfc39123233822287f52547e28a4b8bba2cf73f73b0de7e47e807c0a8`.

The retained trace showed three list-domain RPCs still starting before the
new-user LCP. Exact head `2fb3ccb7bedd26850360bae139449732187145cd`
first delayed those queries until the dashboard cache reported success or
error. Every other exact-head check passed, but the authoritative Lighthouse
run proved that settlement alone was not a paint boundary: the list queries
could still begin in the same render commit as the welcome content. App mobile
remained the sole blocker at 0.83, with a stable 0.02 range, median LCP of
4,159.2 ms, and median TBT of 211 ms. Product mobile passed at 0.89 and no
instability failure remained. The compact report checksum is
`822304fafcd23f3d5d43d21b0f10dac301e3420c670a3faa947cfa0d4bd522cc`.

The final local correction keeps the same cache-only observer but releases the
three list-domain queries only after two animation frames following dashboard
success or error. It keys that release to the exact TanStack dashboard query
instance, so query removal, cache garbage collection, navigation, and later
query recreation cannot inherit stale readiness. It also moves the small
country/default-language contract out of the broad product constants module.
An isolated production-build comparison against `2fb3ccb7…` reduced the
initial `/app` client set by 6,173 raw bytes and 2,595 gzip bytes; the app-layout
entry itself fell by 6,362 raw bytes and 1,569 gzip bytes. It does not skip list
hydration, add another dashboard request, serialize user data, or alter other
authenticated routes. The exact-head five-run gate remains the authority for
whether this final correction clears the unchanged 0.85 floor.

Local verification of the final source includes:

- 6,385 frontend tests passed, with 19 intentional skips;
- TypeScript type-check and ESLint passed;
- the production build and fresh `/sw.js` generation passed;
- focused locale, persistence, toast, race, prefetch, provider-boundary, query
  deferral, and dashboard-refetch tests passed;
- `git diff --check` passed.

These local results do not replace the exact-head Linux five-run gate. PR #1260
remains draft until the final pushed head proves zero blocking or instability
failures and all cleanup assertions complete.

The source Lighthouse hashes, category floors, variance rule, route-JS
regression rule, visual threshold, routes, fixture contract, and seven reviewed
PNG files remain immutable. The visual manifest file SHA-256 remains
`8c17917c60a3b46f087cc5d5cd3a80b34355015ed9e8de0a58e98826f11bdf9c`.
No hosted Supabase write, Vercel configuration change, dependency change,
database/API change, scanner change, or Phase 5 redesign is part of this phase.
