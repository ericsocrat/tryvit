# Evidence-first consumer release and production record

Status: **RELEASED**. Consumer PR #1361, operator PR #1364 and session-initialization
fix PR #1365 were squash-merged normally. Historical preparation evidence below
remains truthful for its recorded checkpoint and is not rewritten as later proof.

## Source and migration contract

The released consumer tree is `d1943585bc00c0fae81c8518fd8c12cebd52da18`
from squash main `bc618f2c73e4d731cd8419170b0bfdcd4729a1b5`. Production operator
execution used exact main `82ff6ab47f60c310d7a7684e548599958d7be836`.
The seven consumer migrations are bound by
[`evidence-first-consumer.migrations.json`](evidence-first-consumer.migrations.json),
SHA-256 `f2f164f0e669f310fcf480eae89b4f6d09ead69fa8d0ee2e3acfe27b2bdcf048`.
They retire unsafe consumer interpretations and legacy responses, supply Home
and scan contracts, and preserve exact image/classification observation lineage.
Historical formulas and records remain; a refresh-required response must not be
treated as a successful payload with a favorable missing score.

The two additional maintenance corrections do not recalibrate the model:
`validate_country_profile` now distinguishes the nine positive penalties (sum
1.00) from the existing negative bonus (-0.08), preserving the diagnostic signed
total 0.92. The current `formula_source_hashes` registry is corrected only if its
old expectation and the actual v3.3 function body match the independently checked
hashes recorded in the migration. Formula bodies, weights, existing scores and
the registry's original registration metadata remain unchanged. This establishes
internal consistency, not scientific validity of the retired model.

## Production release and retained-cohort import

The exact seven-migration manifest passed staging run `34244970981`, then
production run `34245139133`, each with zero remaining migrations and database
lint passing. A clean Production-target build of consumer main produced Vercel
deployment `dpl_BVtpSwsedvRm5cc5bSgDRwtpVATt`. Its protected staged smoke proved
public/auth entry routes, healthy backend and production (not staging) client
binding before that same deployment ID was promoted. Public smoke run
`34247488747` and Main Gate run `34244938629` passed. No Lighthouse cohort ran.

The [production cohort receipt](evidence-first-cohort-production-20260913.json)
binds operator main `82ff6ab47f60c310d7a7684e548599958d7be836`, retained
60-file cohort SHA-256 `80fe4eaef2ca83e7d4e8eb0e441178ff4956bdcbf567be66557fc3710aec215e`
and reviewed remaining-manifest SHA-256
`d38750d840b852c8fedde9c5ed1dd1dca6ee24e2d0550298de0a35018018e40f`.
No new source request was made. Product 178 was applied first from a verified
empty-source 21-table recovery. Eleven later batches imported 54 more products,
with a fresh exact-allowlist capture and actual isolated restore before every
batch. Every member and peer-postimage check passed; no uncertain result or retry
occurred.

Final production verification is exactly 55 ingestion-batch rows, source records
and accepted selected observations, 502 assertions, 55 recorded consumer models
and 55 retired null scores. The final canonical allowlist digest is
`93d0d8c40517e719a56d9640c498cc246805f622df9f1b2215b77aacdf937bd1`;
the final completed-state recovery receipt is
`93682219142784e5946b6f035d48312b9f16e01b1c8d8d2722bf6efd924e7c5b`.
Held products 628, 2882, 2903, 2950 and 6029 have no source rows and retain their
reviewed pre-import projections. Source retrieval and upstream update timestamps
were preserved; the import time was not substituted for source freshness.

This is source-record and recovery evidence, not independent package verification,
universal nutrition truth or validation of a health-outcome model. The operator
does not include Auth or user-owned tables, and no production test user was created.
The genuine Turnstile first-use/replay proof remains unresolved.

## Recovery and applied-database rehearsal

Current release proof: the [12:37 restoration](evidence-first-consumer.recovery-20260908-1237.json)
and [12:39 seven-migration rehearsal](evidence-first-consumer.integration-20260908-123917.json)
bind the current manifest. All 17 tables restored with matching schema/data,
authority and privacy checks; all **300/300 assertions** passed under the
original non-superuser managed role. Whole-schema lint: 161 functions, zero
errors, 15 warnings. No remote operations occurred.

The four additional assertions cover deterministic ingredient-case selection,
retained legacy assertions, recorded-source priority and alternate query plans.
The expanded cohort rehearsal found case-only ingredient-name changes with
unchanged stored rows. Reversing the tied SQL input reproduced Salt/salt selection;
the new regression failed before the fix. C5 now resolves equal-priority ties
with the raw name under C collation. It changes no stored ingredient or source row.

The [12:20 restoration](evidence-first-consumer.recovery-20260908-1220.json) and
[12:21 rehearsal](evidence-first-consumer.integration-20260908-122114.json)
remain historical 296-assertion proof for manifest
`4b6a2808465617361c127e65fc824ad8aed51bf3a40e690a74843a3c11c80405`.
Relative to its predecessor `a7028bca6b57b5f5324194484975b1710d652a39593e4f0cc74f09d701675ab4`,
its only SQL-file change was two leading documentation comments per unmerged
migration, adding required Migration/Rollback descriptions. Exact suffix-byte
comparison verified no SQL statement changes. The new proof uses a separate
copy of the encrypted restoration inputs; prior receipts and archives remain.

Earlier proof: the [09:18 expanded restoration](evidence-first-consumer.recovery-20260908-091848.json)
covers exactly 17 tables and 96,533 rows, including the two maintenance metadata
tables. The [09:23 seven-migration rehearsal](evidence-first-consumer.integration-20260908-092354.json)
passed **296/296 assertions** under the original non-superuser managed role.
Whole-user-schema lint checked 161 functions: zero errors, 15 warnings. Both
receipts bind the preceding seven-migration manifest and the `consumer-v1` scope.
The release driver rejects a smaller 15-table receipt for this profile.

Earlier five-migration evidence follows and remains historical, not authorization
for the expanded release:

The [06:18 restoration receipt](evidence-first-consumer.recovery-20260908.json)
restores actual current production schema and 15 explicitly scoped catalog
tables, 96,523 rows. Grants, RLS, functions, role attributes/memberships,
extension bootstrap and catalog fingerprints match. No private user/history
rows or storage object bytes were exported. This is not whole-platform recovery.
The new observation foreign key was confirmed entirely NULL in the capture
snapshot; populated observation data requires expanding the recovery scope.

The [first applied rehearsal](evidence-first-consumer.integration-20260908-062624.json)
applied all five migrations and linted successfully but failed tests whose setup
assumed activity seed rows, superuser fixture rights and populated materialized
views. It is retained as FAIL.

The [06:29 corrected rehearsal](evidence-first-consumer.integration-20260908-062951.json)
passed **252/252 assertions** against another isolated restoration of the same
capture. Activity definitions are explicit transaction-only fixtures. A narrowly
scoped, fixed-value local helper creates otherwise-impossible orphan references;
it does not grant superuser rights to the code or assertions being tested.
Derived caches are recomputed, not claimed restored byte-for-byte. The original
managed `postgres` role remains `NOSUPERUSER`; whole-user-schema lint checked
161 functions with zero errors and 14 recorded warnings. The container was
removed after each attempt. Neither rehearsal applied production migrations.

## Consumer verification checkpoint

- Type-check and lint passed.
- Latest full frontend suite: **6,261 passed, 31 opt-in tests skipped**. The 31
  RPC integration tests separately passed against the explicit local runtime.
  Auth refusals in that suite are boundary proof, not authenticated user payload
  proof; guarded browser and role tests cover those separately.
- Released consumer-source guarded Chromium suite: **25/25 passed** after a
  production build,
  covering EN/PL/DE, light/dark, 390/1440/2560 px, facts and missing evidence,
  source links, comparison navigation, saved/history reads, failed save/retry,
  manual barcode entry, private comparisons and archived profile deletion.
- Independent AI review found three bounded issues subsequently corrected:
  early positive-allergen visibility, a mobile comparison scroll cue with sticky
  nutrient labels, and the untranslated search submit key. The 25-test rerun
  includes actual first-viewport positioning and keyboard scroll checks. A final
  compact allergen-label layout receives targeted mobile/desktop verification.
- One earlier browser run failed due to an ambiguous title locator and left two
  tests unrun. The locator now requires the exact level-one page title.
- Product photographs in these fixtures are labelled local placeholders. These
  screenshots do not certify package-photo accuracy or production data accuracy.
- A subsequent attribution-label correction replaces the displayed internal
  `off_api` key with “Open Food Facts,” without changing stored keys or links.
  Its 47 component tests, type-check/lint and three guarded browser checks
  (setup, PL mobile, DE desktop) passed after rebuilding; the latest full run
  includes the subsequent fixes. Exact-head CI remains required.
- Removed four unreachable legacy score-hero/gauge implementation and test files.
  Historical mathematical helpers and SQL remain. A camera test teardown race
  was corrected by unmounting before restoring media prototypes; the failed run
  is not counted as passing.
- At the consumer-release checkpoint, CI-policy tests passed, including fail-closed
  native production Git binding detection. Required remote CI and exact final
  candidate review remained.

## Release conditions and rollback

### Accepted baseline and release-source CI

Baseline-only PR #1362 merged normally as
`cc27aeca69968063e8704c5781c2c48653b1f32e`, tree
`5f0d4dae031dd79540d1e8bfb25c060c5e9c8de3`, after the base-owned observation
correction #1363 (`f949387cddde390d488cc07f0f7e8713224ceb88`). Its seven images
come from exact consumer source `1868b3319cbaaae83c08c895eb15b1de8ac31d71`,
successful two-pass Linux run `34230564190`. The independent AI review and
separate delegated authorization are GitHub comments `5586155129` and
`5586161777`; neither asserts personal human visual review. Earlier candidate,
review and failed acceptance records remain preserved.

All required checks and the fresh base-owned acceptance/renderer checks passed
before that normal merge. At that historical checkpoint, the advisory risk
rollup still rejected superseded label-missing suites; the failure was disclosed,
not bypassed or rewritten. The consumer integration subsequently corrected
selection using verified workflow identity, newest execution and per-job attempts,
preserving partial reruns and rejecting newer failures, unexpected skips, invalid
IDs and spoofed contexts. Hosted validation passed on operator head `7054b03a`;
the exact GitHub Actions `Change Risk Gate` context is now required alongside the
four existing contexts, with no bypass actors added.

The consumer branch normally merged the accepted baseline main without modifying
the accepted PNGs. The production import tools were later versioned through
#1364/#1365 and executed only after their separate checks and recovery proofs.

### PR 1361 integration corrections

The first published head `7fb0473e961f2133b9d3c40b21449aae73f3b99c`
passed Typecheck & Lint, both unit shards, Build, CodeQL (TypeScript and Python),
dependency audits, renderer attestation and Golden Reference admission. It did
not pass the complete release gate: RPC validation, Python lint, hygiene,
browser assertions, database QA, Route-JS and the old visual comparator failed.
Those failures remain historical evidence, not waived passes.

The follow-up changes move the 31 RPC assertions from the hosted-secret fallback
workflow into Quality Gate's existing guarded local Supabase runtime, retaining
an always-evaluated `RPC Contract Validation` context. The database CI service
preloads real query statistics. QA reports separate blocking assertions,
historical score diagnostics and two explicitly unassessed security inventories;
execution errors, incomplete execution and the executable security/consumer
contracts still block. Browser contracts now verify the evidence-first content
and keyboard-accessible sources instead of requiring retired score controls.

Home's first Route-JS capture was 322,108 B gzip versus 294,158 B on the base.
The follow-up uses the installed Zod Mini entry point and an explicitly empty
Home schema; nonempty responses await the full product schema before returning
data. Differential and loading tests preserve acceptance and failure behavior.
The original +10 KiB OR +5% regression rule is unchanged. Local measurements are
diagnostic only; the final exact-head Linux comparison remains authoritative.

The full local frontend run after these changes reported 6,286 passing tests,
two failed expectations for the newly localized Home search label, and 31
opt-in skips. Correcting the stale expectations passed all five affected tests;
this is not represented as a new full-suite pass. Whole-repository Ruff and all
six repository hygiene checks passed. Final exact-head CI was still required at
that checkpoint and subsequently passed before release.

The subsequent complete frontend rerun passed **6,288 tests in 418 files**, with
31 opt-in RPC tests skipped (138.44 seconds). The unchanged CI-seeded product
also passed the guarded mobile and desktop audits plus authentication setup
(3/3); three generic sub-44px target warnings remain unassessed, not silently
promoted to accessibility proof. The 53 CI-policy tests and actionlint for the
changed workflows passed. These are local candidate checks, not deployment.

At published follow-up `904bd2c501584a4eca3e3b871e7b381d694c3d45`, PR Gate
and Quality Gate both passed. The Linux Home comparison still exceeded +10 KiB;
product detail decreased by 18.7 KiB. Database CI then exposed duplicate scoring
dispatch: a hardcoded category pass followed by a whole-catalog DO statement,
whose cumulative work hit the unchanged 30-second statement limit. The next
revision dispatches distinct active market/category calls once through psql
`\gexec`; formula, transaction and per-statement timeout remain unchanged. An
actual temporary-table/procedure test verified four separate calls, both markets,
quoted literals, deprecated exclusion and a retained one-second test limit.

The next revision also combines mobile/desktop into one guarded browser launch
per backend mode, preserving all eight project selections, isolation, assertions
and cleanup. Seventy-one portable CI/operator tests pass with no skips, and QA
accounting's 26 cases pass; both are wired into PR Gate. Stale documentation
counts now refer to actual run reports rather than a blanket current PASS.

All evidence integer fields retain Zod validation and safe-integer/range
semantics through a shared minimal schema; 129 focused tests, type-check and
lint passed. A final Windows capture recorded Home 304,110 B and product
315,793 B, but its launcher failed during Node shutdown (`UV_HANDLE_CLOSING`).
Browser cases finished; the overall run is retained as FAIL, not release proof.
The next exact-head Linux comparison remains required.

CodeQL annotation 37 flags a local token read reaching an Authorization header.
Independent inspection identified intended PAT authentication to the fixed
Supabase Management API recipient, not demonstrated exfiltration. The helper
now explicitly rejects redirects; 13 tests cover recipient/header binding and
sanitized failure. No real redirect or credential leak was observed, and this
assessment does not imply the annotation has already been closed by GitHub.

The completed release followed [Consumer promotion](CONSUMER_PROMOTION.md).
Future releases must keep native Supabase production Git synchronization disabled,
verify the Vercel main-deployment guard, and keep Preview bound to staging before
authenticated testing. The foundation
[sequencing incident](FOUNDATION_DEPLOYMENT_INCIDENT_20260908.md) is not erased
by subsequent staging success.

The [corrected Preview configuration receipt](preview-isolation-20260908.json)
confirms the two Preview values point to staging, Production is preserved, and
no service-role key was added. It does not certify an existing deployment's
build-time environment. Initial `env run` observations were contaminated by
local dotenv overrides and are not reliable evidence of the prior remote target.

The consumer manifest was applied to staging first, then production with matching
recovery evidence. The exact Production-target artifact was promoted only after
database verification. An ordinary old
frontend rollback can reintroduce unsafe score interpretation; rollback must use
a compatible evidence-first build or a truthful unavailable/refresh boundary.
No destructive schema contraction or deletion of user-owned history is planned.

For the released consumer source recorded above, source-cohort reconciliation,
bounded import, intentional baseline review, remote CI/Sonar closure and exact
deployment certification are complete. Later Nightly, AppShell/AppPage
containment, and settings accessibility changes in PR #1369 are outside that
certification. The production Turnstile first-use/replay proof remains unresolved
and is not made passing by this release.

## 2026-09-13 post-release dependency and runtime follow-up

Security PR #1370 merged as `2782bce59a21e3401c8497fa59a6910e93c7a507`,
pinning Next.js and `eslint-config-next` to 16.3.5 above the patched floors for
`GHSA-p293-qw3h-jr36` and `GHSA-2xp9-vwfh-vxw4`. Dependabot PR #1352 then
merged Sentry 10.74.0 as `ef14fe841ea36d733b7b92bf8e952e2a0d83b9e5`;
Route-JS governance PR #1371 merged as
`e5000bd2dbcf2c254b4bdf8cd7ad685e3bc04d61`, tree
`6cb59b0beba0113a272c6465f796512869e0fae2`.

Exact Production-target deployment `dpl_Aae8Uj73dW4Xhc97c9HEmf7Gm2s9` was
protected-smoked, verified to contain the production rather than staging client
binding, promoted unchanged, and public-smoked under run `34738671744`. Main
Gate run `34738365769` passed. The production dependency audit reports zero
HIGH/CRITICAL vulnerabilities. Two unpatched high-severity `extract-zip`
advisories remain open through development-only Lighthouse/Puppeteer tooling;
their bounded reachability disposition is not a claim that they are fixed.
This deployment certifies source
`e5000bd2dbcf2c254b4bdf8cd7ad685e3bc04d61` only; it does not certify PR
#1369's later Nightly/UI source or a scheduled Nightly outcome. This follow-up
neither approves wider beta nor resolves the Turnstile proof.
