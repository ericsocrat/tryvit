# Evidence-first consumer release — preparation record

Status: **NOT RELEASED**. This record does not authorize skipping CI, visual
review, staging application or production promotion.

## Source and migration contract

The implementation integrates current main
`1f66ab761a4d419f65745625dd0caad9c0ce77c5` on
`codex/evidence-first-consumer`. The seven consumer migrations are bound by
[`evidence-first-consumer.migrations.json`](evidence-first-consumer.migrations.json),
SHA-256 `a7028bca6b57b5f5324194484975b1710d652a39593e4f0cc74f09d701675ab4`.
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

## Recovery and applied-database rehearsal

Current release proof: the [09:18 expanded restoration](evidence-first-consumer.recovery-20260908-091848.json)
covers exactly 17 tables and 96,533 rows, including the two maintenance metadata
tables. The [09:23 seven-migration rehearsal](evidence-first-consumer.integration-20260908-092354.json)
passed **296/296 assertions** under the original non-superuser managed role.
Whole-user-schema lint checked 161 functions: zero errors, 15 warnings. Both
receipts bind the current seven-migration manifest and the `consumer-v1` scope.
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
- Final guarded Chromium suite: **25/25 passed** after a production build,
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
- CI-policy tests currently pass, including fail-closed native production Git
  binding detection. Required remote CI and exact final candidate review remain.

## Release conditions and rollback

Follow [Consumer promotion](CONSUMER_PROMOTION.md). Keep native Supabase
production Git synchronization disabled and verify the Vercel main-deployment
guard. Preview must use staging before authenticated testing. The foundation
[sequencing incident](FOUNDATION_DEPLOYMENT_INCIDENT_20260908.md) is not erased
by subsequent staging success.

The [corrected Preview configuration receipt](preview-isolation-20260908.json)
confirms the two Preview values point to staging, Production is preserved, and
no service-role key was added. It does not certify an existing deployment's
build-time environment. Initial `env run` observations were contaminated by
local dotenv overrides and are not reliable evidence of the prior remote target.

Apply the exact consumer manifest to staging first, validate its receipt, then
apply production with fresh matching recovery evidence. Promote an exact
Production-target artifact only after database verification. An ordinary old
frontend rollback can reintroduce unsafe score interpretation; rollback must use
a compatible evidence-first build or a truthful unavailable/refresh boundary.
No destructive schema contraction or deletion of user-owned history is planned.

Source-cohort reconciliation, safe bounded import, intentional baseline review,
remote CI/Sonar closure and exact deployment certification are still required.
The production Turnstile first-use/replay proof remains unresolved and is not
made passing by this release.
