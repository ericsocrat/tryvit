# Evidence-first rebuild: implementation and release ledger

Status: RELEASED WITH EXPLICIT FOLLOW-UPS. This ledger summarizes the milestone;
the linked production receipts remain the evidence authority.

## Current checkpoint — 2026-09-13

Foundation PR #1359, consumer PR #1361, production operator PR #1364 and
pooler-session fix PR #1365 are merged. Production import executed from exact
main `82ff6ab47f60c310d7a7684e548599958d7be836`; later repository refs must be
revalidated. The released consumer tree
`d1943585bc00c0fae81c8518fd8c12cebd52da18` is live on deployment
`dpl_BVtpSwsedvRm5cc5bSgDRwtpVATt`. Earlier checkpoints below retain their
original time-specific results and are not current authority.

Delegated-review policy PR #1360 subsequently merged normally to
`1f66ab761a4d419f65745625dd0caad9c0ce77c5`, tree
`823e4fe766544a0a6ec39ee77ac7824bb9cb669c`; exact parent and tree were verified.
The consumer branch synchronized that main normally. The policy identifies AI
review as AI review; it does not invent Eric's personal visual approval.

Production and staging received the foundation baseline and exact seven-migration
consumer manifest through the source-bound release driver.
Production was applied by the unexpected native Supabase Git path before staging;
that path is now disabled. See the candid
[sequencing incident and remediation](../releases/FOUNDATION_DEPLOYMENT_INCIDENT_20260908.md).
Staging run `34244970981`, production run `34245139133`, exact deployment smoke
and Main Gate passed. The retained 60-file source set was not refetched: 55
reviewed products were applied through a pilot plus eleven bounded batches; five
remain held. The completed state has 55 selected observations and 502 assertions
and passed an actual isolated 21-table restore. See the current
[consumer production record](../releases/EVIDENCE_FIRST_CONSUMER.md) and
[cohort receipt](../releases/evidence-first-cohort-production-20260913.json).
The [original-weight usability reassessment](../releases/evidence-first-usability-reassessment-20260913.md)
records 64/100 as a reviewer heuristic, not a field study.
The production Turnstile first-use/replay proof remains unresolved.

## Approved outcome

Everyday shoppers in PL and DE can find a product, understand recorded facts and
their limitations, compare compatible evidence, and save/retrieve products.
The legacy aggregate is retired from consumer decisions, not replaced by another
unvalidated formula. Keep source observations, historical calculations, product
IDs, saved references, current logo, and invitation-only authorization.

## Authority and ownership

- Starting main: `e54b29e1bbc0a180c03bc7cb13d424fe50f10d40`.
- Release-safety PR [#1351](https://github.com/ericsocrat/tryvit/pull/1351) merged
  normally to `1a731aeac2406e8904adf09a23515f99125b9ff0`, tree
  `b5c9382fa61dc244cffde50992ff53c332117456`. Parent and tree verified.
- Integration branch: `codex/evidence-first-rebuild`.
- Previous dashboard preview and audit fixes are preserved in their original
  worktree. Only reviewed changes are reimplemented here; no preview route ships.
- Three independent workstreams own ingestion, CI/release, and shared shell.
  The coordinating agent owns API contracts, integration, verification, and release.

## Acceptance ledger

| ID | Requirement | Evidence required | Status |
| --- | --- | --- | --- |
| A1 | Partial ingestion cannot retire or clear unrelated identities | Python and live local SQL regression including 30-of-100 and PL/DE | Complete |
| A2 | One protected database deployment path | Workflow tests, exact manifest/staging/recovery validation, concurrency | Complete |
| A3 | Diagnostics do not disclose secrets | Synthetic-secret scanner regressions | Complete |
| B1 | Stable source mappings and immutable observations | Forward migration, transaction/idempotency/conflict tests | Complete |
| B2 | Precision, basis, qualifiers, missingness retained | Numeric parser and SQL projection tests | Complete |
| B3 | Atomic source-owned ingredient/allergen sets | Replacement, interruption, other-source preservation tests | Complete |
| B4 | Source reconciliation and recovery | Real backup restoration and fixed 60-product cohort, coverage report | Complete for 55 reviewed products; 5 held |
| C1 | Canonical versioned read model | Runtime schemas plus applied-database contract tests | Complete |
| C2 | No unsupported consumer score or winner | Search/detail/comparison/saved/export/share/notification checks | Complete |
| C3 | Correct search and state | NOVA/image/parser/context/cache/history/back-forward regressions | Complete |
| C4 | Fail-closed suitability and mutations | Unknown evidence and rollback tests | Complete |
| D1 | Shared neutral shell and task navigation | Actual 390/1440/2560 renders, locales, themes, keyboard review | Complete with guarded evidence |
| D2 | Simplified core screens and copy | Core journey browser tests and exact candidate review | Complete through delegated AI lane |
| E1 | Risk-based, non-duplicative CI | Classifier/rollup negative tests, completed exact-head checks | Complete; stale Nightly excluded from launch evidence |
| E2 | Intentional visual baseline acceptance | Truthful reviewer identity, candidate hashes, comparator | Complete; no claim of Eric's personal review |
| E3 | Normal merge and exact production release | PR/main tree, deployment, smoke and runtime evidence | Complete |
| E4 | Final evidence and documentation | Updated API/data/scoring docs, original-weight usability review | Complete; heuristic, not user study |

## Executed release sequence

1. Protect ingestion and deployment first; no new production import precedes this.
2. Add source/observation schema and local/staging-tested projection logic.
3. Introduce canonical read contracts, then migrate consumer behavior.
4. Apply shared UX and remove obsolete preview/unsafe interpretation paths.
5. Integrate, review exact visual changes, pass risk-appropriate gates, deploy and
   verify. Schema contraction is not part of this release.

## Evidence rules

Data presence is not verification. Retrieved-at is not source-updated-at. Missing
is not zero. A model change is not a product improvement. Preserve failed and
unavailable evidence as such. No production Turnstile first-use/replay claim is
part of this release. No baseline or gate is changed solely to hide a failure.

Operational receipts are sanitized; raw backups, credentials, and user records
are never committed or uploaded as report evidence.

## Verified progress — 2026-09-05

These entries are additive working evidence, not final-head release certification.

- #1351's required PR checks and CodeQL passed; no bypass was used. Exact-main
  build, unit tests, type-check/lint and browser smoke passed. Production deployment
  and post-deploy smoke passed. **Main Gate remained red on Sonar**: a Python
  negative HTTP-URL test was incorrectly indexed as production code. The local
  fix classifies Python test sources correctly; no security rule or threshold is
  suppressed. Its eventual exact-head/main status must still be verified.
- Browserslist's two advisories resolved through one affected installation's
  compatible transitive patch. The unpatched extract-zip alert remains open with
  its browser-download tooling boundary documented; it is not dismissed.
- The current full Python run: **321 passed, 8 subtests passed** in 152.49 s.
  Local transaction-only SQL runs: ingestion **46**, read model **37**, Find
  **35**, collections **26** assertions passed. No production migration or
  observation import is implied by those local results.
- The frozen 60-source cohort retained all members and successful responses.
  540 nutrient comparisons: 384 literal agreements, 80 differences, 74 stored
  values missing from the fetched source, two qualified values. 477 fields had
  unknown measurement basis. These are reconciliation outcomes, not food-accuracy
  percentages. A separately labelled taxonomy-policy preview changes only the two
  audited skyr classifications to Dairy; original cohort evidence is unchanged.
- A real read-only catalog backup was restored into a new owned local database:
  15 selected tables, 96,523 rows, all selected row hashes/counts and table-shape
  fingerprints matched. Archive SHA-256:
  `be83726f13345a2ca027f56e96320f8238673f3375e2ad63580c556f92527ceb`.
  This **does not** establish private-row, managed Auth, RLS/RPC or storage-object
  recovery. The separately bounded schema restoration is still in progress.
- Guarded production build plus Chromium core flow: **15/15 passed** in 1.2 min,
  covering EN/PL/DE, light/dark, 390/1440 and 2560 px, source disclosure, filter
  focus, comparison clear/back and saved/history bookmarks. Subsequent source
  changes require recertification. Image-bearing review substitutes explicitly
  marked local test image bytes; it does not certify actual package photographs.
- The diagnostic full frontend run passed 6,419 tests but failed 55 (19 skipped).
  Failures include obsolete contracts after deliberate feature retirement,
  renamed navigation copy, in-flight public-share changes, stale inventory and
  Windows line-ending handling. It is **not a green full suite**. Focused fixes
  are being verified before another final-head run.

## Additional release-critical findings and decisions

- A privileged provenance diagnostic had regained authenticated direct execution
  in an earlier migration. The forward fix denies that direct call while an
  actual authenticated test proves the approved owner-executed wrapper works.
- Shared-row table policies allowed reads without possession of the share token.
  The new shared-reader work must close table enumeration for anonymous and
  non-owner authenticated users while preserving token-authorized reads and
  revocation. This is a release blocker, not optional UI cleanup.
- The former ingredient risk-profile feature is retired, not rebranded as
  evidence. Its stored registry and history remain. Old bookmarks explain the
  change and point to product evidence/current education; no unsupported concern
  tier, dietary certificate or score-ranked ingredient list is published.
- Legacy translated product names are preserved in storage but not selected as
  current identity until they can be bound to a source revision. UI localization
  remains EN/PL/DE; the current product name follows the recorded original.
- Educational pages no longer attribute the project's formula or concern tiers
  to WHO/EFSA validation. Historical scoring documents remain explicitly marked
  as historical; the current policy is [EVIDENCE_DATA_POLICY.md](../EVIDENCE_DATA_POLICY.md).
- The mobile detail header is compacted after direct visual inspection so a
  missing photograph does not occupy most of the first screen.

## Historical pre-release boundary

### 2026-09-08 local checkpoint (not deployment certification)

- Staging selected-catalog capture now succeeded, including cleanup and semantic
  permission equality. Full staging schema reconstruction is being matched to
  actual managed Auth/Storage/Realtime DDL without exporting their rows. No
  staging catchup or recovery PASS is implied by capture success.
- The legacy-list nullable-score hole is fixed in B head `3a4206f0`; the old
  endpoint now requires refresh and cannot feed a fabricated 100-point export.
  Fresh B restoration and all 222 explicit pgTAP assertions passed for manifest
  `7c93df9aeb1c8240b87111e507df58c3616b2766714575e190b0e683776c2cbc`.
- QA reassessment found inaccurate historical suite-count metadata as well as
  obsolete score/confidence requirements. Historical “778/778” figures remain
  the old runner's reported results, not a newly audited count of independent
  assertions. C corrects the registry and checks explicit evidence contracts;
  the separately planned/numbered pgTAP assertion counts are unaffected.
- Current C source also has an explicit five-migration consumer manifest. It
  authorizes no deployment by itself and still requires integrated verification,
  staging and a matching fresh recovery receipt.
- Shared nutrition context reduced the inspected Polish mobile detail from
  3,640 to 3,186 pixels without removing values, units, missing-field labels or
  positive allergen warnings. Its 54 focused tests and fresh targeted mobile/
  desktop build/browser checks passed. Final full-candidate evidence remains due.

- Source lineage correction now passes 14 new SQL assertions, 44 existing read
  contracts, 101 focused frontend tests and a fresh 17-test browser run. The full
  frontend suite subsequently passed **6,263 tests with 31 skipped and zero
  failures**. Compact photo-details disclosure was then verified with 55 focused
  tests and a fresh Polish 390/1440 browser/build review; final whole-candidate
  recertification must include that last presentation revision.
- Newly observed main CodeQL alert #36 identified genuine CSV diagnostic leakage.
  The fix is pushed as `ffe8affd` in foundation PR #1359; **34 CSV tests passed**.
  Updated CodeQL/CI closure remains pending, not assumed from the prior green job.
- The corrected temporary-role drain passed an actual isolated PostgreSQL test
  under non-superuser privileges while an unrelated connection remained usable.
  A second staging capture attempt correctly cleaned up but failed specifically
  at schema dump. Live verification again found zero remaining capture roles.
  No encrypted archive, staging recovery PASS or remote migration is claimed.

- PR Gate run `34181602455` on `f78057ac` completed successfully from
  02:53:15Z to 02:57:10Z: **235 seconds wall-clock**. Critical Playwright Smoke
  ran 02:53:20Z–02:57:09Z (**229 seconds execution, five seconds initial queue**).
  Unit shards took 147/196 seconds; their aggregate passed. This is lower than
  the earlier observed roughly 333-second gate, but not a controlled same-input
  performance experiment. Full database and visual/quality lanes are separate.

- Final pre-lineage-correction guarded browser rerun passed **17/17** after a
  successful production build, including all locales/themes, widths and both
  real local mutation journeys. The final three-column history-filter image was
  directly inspected. Subsequent source-contract changes require recertification.
- Foundation `f78057ac` completed **778/778 database QA** on CI. The following
  documentation-only revision `f6bcaf86` separates source-merge and deployment
  gates; its exact-head CI is still running. The inherited visual/risk mismatch
  remains explicitly failed, not silently accepted.
- Staging capture execution failed before an encrypted archive was completed.
  Its cleanup SQL exposed unsafe evaluation order around a side-effecting
  termination call. Explicit guarded procedural cleanup removed the exact owned
  temporary role/session; live verification found zero capture roles/sessions,
  with two staging accounts, four products and 227 migrations unchanged. The
  helper requires correction and a real local session-isolation regression
  before reuse. No staging catchup or production migration occurred.
- Adversarial contract review found that classification/image metadata lacked
  exact observation IDs, despite correctly selecting current classifications.
  A forward C-only correction is in progress; frozen B migrations are unchanged.

- Latest full frontend run: **6,259 passed, 31 skipped, zero failures** across
  416 passing files and one skipped file (105.87 seconds). The final history and
  regenerated inventory checks additionally passed **27/27**. Skipped coverage is
  not certified; deployed behavior still requires separate release verification.

- Follow-up foundation changes are committed and pushed to PR #1359 at
  `f78057ac4ed9fa1c1d5d43fe31c1d673fb1e84dd`. The final restored clone passed 222
  application assertions, 21 QA regressions/mutations and seven targeted QA
  checks. Exact-head full CI remains a separate requirement. No migration was
  applied remotely.
- The additional real local barcode-to-detail-to-history journey and save/retry
  journey passed with authentication setup (**3/3 in 9.9 seconds**). A genuine
  rich-color toast contrast failure was fixed with neutral toast presentation;
  its 11 provider tests passed. Finite entrance animations are awaited before
  accessibility inspection; no accessibility rules were disabled. The later
  three-column history-filter layout correction needs final visual recapture.
- Routine folded decorations were removed from shared panels, lists, comparison,
  monitoring, error and education/utility surfaces. Their 222 focused tests,
  type-check and lint passed. Existing logo and auth/landing identity remain.

- The expanded guarded Chromium suite passed **16/16 in 59.3 seconds** after a
  successful production build. It covers EN/PL/DE, light/dark, 390/1440/2560 px,
  source facts and unknowns, filters, comparison navigation, saved/history reads,
  an application-level failed save followed by a real local retry, Home retrieval,
  and a saved comparison whose share token remains null. Images remain explicitly
  labelled local placeholders; package-photo accuracy is not certified.
- A full frontend diagnostic run passed **6,247 tests**, failed two, and skipped
  31. Failures were an outdated scan-copy assertion and the generated route
  inventory. The copy expectation was corrected; inventory regeneration awaits
  source freeze. This is not a green full-suite result.
- Labelled comparison controls now include the visible label in their accessible
  names. Product-view recording is explicitly tested as suppressed in QA mode.
  Those focused detail/comparison tests passed **26/26** with scoped lint passing.
- Shared routine-panel folded decoration was removed. A subsequent visual check
  exposed a separate list-header fold; its stylesheet was corrected afterward,
  so the earlier 16-test browser result does not certify that final CSS revision.
- Foundation PR #1359 remains unmerged. Its four required PR Gate contexts and
  CodeQL passed on `14efaeb4af871e5c1d96e17ded3bce5258bd46b8`, but applicable database
  QA reported seven failures. Real index gaps and outdated blanket security
  assumptions are being repaired with explicit least-privilege contracts.
- Production has 237 migrations; staging has 227. The ten staging prerequisites
  include catalog changes and audit-log side effects. The production recovery
  receipt does not establish staging recovery. No catchup or production migration
  was applied at this checkpoint.

The preceding checkpoint notes describe work that was pending when recorded.
The evidence-first product release and bounded 55-product source import have now
completed under the current production receipts. They do not constitute public-
beta approval or production Turnstile first-use/replay PASS. Critical Next.js
advisories discovered after release must be resolved before another frontend
promotion or wider beta, and the obsolete authenticated Nightly assertions must
be replaced before that scheduled suite is treated as launch evidence.
