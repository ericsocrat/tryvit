# Evidence-first foundation: data and API release

This is the backend foundation slice of the approved rebuild. It does not promote
the redesigned frontend, certify all catalog facts, or complete private-beta
readiness. Apply and verify this schema before promoting its v2 consumers.

**Source and database deployment are separate gates.** The shared manifest now
includes ten staging-only historical prerequisites. The production-baseline
same-digest recovery rebind passed; the exact 15-migration staging rehearsal
remains a separate prerequisite. Earlier five-only receipts are retained, not
relabeled. Source merge requires exact-head required CI, database QA and recovery
verification. Staging dispatch then uses the resulting exact current main;
production deployment additionally requires successful staging evidence. Requiring
that current-main staging dispatch before source merge would be circular.

The foundation adds no frontend source, dependency or asset changes against main
`7a67dc9085e07c6c0b4353b42d2c006787a1c6f0` (frontend tree
`3a637f6e8b2e4e2a4b8a68921814868e6ac79a5a`). Its immutable-render comparisons
repeat the pre-existing public/authenticated mismatches from merged PR #1356:
69,993 and 70,079 pixels respectively. Visual and Change Risk checks remain FAIL,
not waived PASS. Their inherited mismatch is deferred to the separately reviewed
intentional-redesign acceptance before the rebuilt frontend is promoted. This
disposition does not disable a check, change a baseline or authorize deployment.
The September 5 recovery receipt remains historical evidence, not release authority.
Initial managed-role fixture failures were resolved without skipping assertions;
their fixture-only adaptations are recorded below.

## Exact deployment scope

The ordered five-migration production set and ten staging prerequisites are recorded in
[`evidence-first-foundation.migrations.json`](evidence-first-foundation.migrations.json).
The manifest has 2849 LF bytes and SHA-256
`3389ef688241f5e14a2ac0e1912fc4dd082e33c844b8a7d69fc535b5eb60cd4b`.
Its `schema-and-catalog` recovery scope does not claim to restore private user
rows, history rows, managed Auth services, or storage objects.

`stagingPrerequisites` pins the ten missing historical migrations from the
verified 227-version staging baseline to the 237-version production baseline.
They are a sorted, disjoint older prefix, followed by the same five foundation
migrations: staging must show exactly 15 pending files; production exactly 5.
Every entry's bytes are verified in either environment. Partial catch-up,
unexpected pending files, overlapping versions or altered hashes remain HOLD;
there is no `--include-all` or selective omission. A manifest without this optional
field retains the original same-set behavior. Both deployment receipts bind this
one shared manifest digest. Staging catch-up recovery/authority checks are a
separate rehearsal; the production schema/catalog receipt does not claim them.

The workflow pins Supabase CLI 2.111.0. Staging may use an access token without
a database password through the CLI's normal temporary-login-role path. That
credential provisioning is mutating even when `db push --dry-run` applies no
migrations, so it belongs to an authorized staging dispatch, not read-only
inspection. Production still requires both its database password and access token.
Exact project bindings, current-main requirements and production's matching
successful staging/recovery requirements are unchanged.
The workflow selects the secret name before reading its value: an unset production
password stays empty and is rejected, never replaced by the staging password.

1. **Ingestion:** immutable sanitized observations, stable source/market identity,
   idempotent source-owned projection, conflict quarantine, exact quantities and
   qualifiers. Partial refreshes cannot retire unseen products or clear another
   market's barcode. Missing input is not an empty declaration or a numeric zero.
   Four supporting indexes cover new ingestion foreign-key lookups, with a
   unique record-ID subset avoiding a redundant selected-observation index.
2. **Product read model:** source-backed and unverified states are distinct;
   aggregate scores are retired in the new contract. Source observations are not
   package verification. Restores the service-only provenance-helper ACL that a
   later legacy migration accidentally broadened.
   Includes bounded repairs for inherited operator SQL and the legacy suggestion
   reader's nonexistent product identifier; existing operator ACLs are preserved.
   The suggestion reader's original auth-only contract is explicitly restored
   after hosted grant drift; PUBLIC/anon execution is revoked, authenticated
   execution remains available.
3. **Search:** evidence-first product results, explicit applied context, images,
   NOVA filtering, country boundaries, and safe multilingual/punctuation handling.
4. **Collections:** owner-authorized lists/watchlists consume the same fact model;
   existing IDs and saved references remain intact.
   The legacy `api_get_list_items` reader returns `refresh_required` with no
   `items` success envelope. Older list/export clients must not convert nullable
   historical scores into an apparent maximum grade; v2 saved-list reads retain
   ownership checks, pagination and recorded membership.
5. **Public shares:** token-gated v2 readers replace direct shared-table
   enumeration. PUBLIC shared-row policies are removed for anonymous and
   authenticated nonowners; owner/service access is preserved. Public payloads
   omit owner/list/comparison IDs, descriptions, private notes and activity times.
   New comparison saves are private by default. Explicit list sharing uses the
   installed random-byte function; revocation clears the old token permanently.

The read model, search and collection APIs are additive. Existing public URLs
remain, but the legacy public-share RPCs deliberately return
`share_client_refresh_required`. During the schema-first cutover the old public
page may report temporary unavailability; it must not publish a legacy score or
private content. This limited availability is intentional until the v2 frontend
is deployed, not a claim that all old share content remains visible.

No production import, user/account creation, or production data mutation is
performed by this source change. Existing scoring calculations/history are not
rewritten. Complete consumer score retirement and the new Home/Scan/recipe flows
belong to the subsequent frontend release.

## Source reconciliation and limitations

`data-quality/cohorts/evidence-first-v1.json` freezes 60 product identities before
collection: five products per PL/DE × Dairy/Bread/Cereals/Drinks/Sauces/Snacks,
including the audited PL skyr products. Membership cannot be selectively replaced
after a failed fetch. The collector is GET-only and produces dry-run import SQL;
it does not execute a production import.

Source agreement validates extraction/reconciliation, not universal nutritional
truth. Legacy records remain unverified where observation lineage cannot be
established. OFF attribution and ODbL/DbCL obligations remain applicable; no
source-specific license is replaced by a project-wide notice.

## Verification performed before the draft PR

- Hash-pinned pytest environment: **349 tests and 8 subtests passed** across the
  pipeline and data-quality report tests.
- Earlier local rolled-back pgTAP contracts: **193 assertions passed** — ingestion51,
  read model44, search37, collections26, public shares35.
- September 8 local rolled-back checks: **44 public-share assertions and 19
  operator-repair assertions passed**. The corrected legacy suggestion function
  was created and invoked inside a rolled-back transaction and returned an object.
  Together with the previously passed ingestion/read/search/collections suites,
  the foundation now has 222 assertions, including a new suggestion-reader
  regression pending fresh B reconstruction; this is not a fresh full-suite CI result.
- September 8 shared-manifest production-schema/catalog reconstruction: **222/222
  assertions passed**, with all five migrations applied as the original managed
  non-superuser role at 04:21:11.306Z. Whole-user-schema lint checked 160 functions: zero errors,
  15 warnings. This is an isolated integration result, not production deployment.
  The count is one lower because the legacy list reader is now a SQL refresh
  response instead of a PL/pgSQL compatibility function; lint selection is unchanged.
- Earlier September 8 scoped QA on the same restored baseline: **21/21 rollback
  regression/mutation assertions and seven previously failing QA checks passed**.
  These verify exact invoker/token grants, service-only default-deny tables, and
  usable FK indexes, including negative cases. This is not the full 778-check
  seeded CI run; that remains an exact-head CI obligation. Existing legacy-index
  checks remain in force and their other partial/nonleading cases are unassessed.
- CI/recovery/Sonar-scope contracts: **31 tests passed**.
- September 8 release-validator/Sonar-scope rerun: **7 tests passed**.
- Redacted tracked-source hygiene scan: **0 findings**.
- Ruff pipeline checks, migration header/naming checks and strict documented
  filesystem counts passed. Incidental migration-count prose was replaced with
  the authoritative CLI enumeration command; no count threshold was waived.
- Manifest hashes match the exact LF SQL bytes; committed-blob equality is
  checked during staging. No historical evidence hash is changed.

The shared local database was realigned to declared migration order before share
testing: the earlier read-model migration revokes anonymous schema usage; the
later token-reader migration grants only the required schema usage and function
access. Reapplying an earlier migration after a later one is not a valid final
state. No production permission was changed by these tests.

Additional managed-role checks (`postgres`, non-superuser, RLS bypass) passed all
193 assertions. The Find suite supplies a synthetic repository-default rate-limit
configuration; the collections suite uses a fixed-value local corruption helper
instead of superuser-only fixture setup. No assertions were skipped. These are
explicit fixture adaptations, not a production configuration restoration claim.
The independent recovery receipt proves restoration of the existing baseline,
not that every inherited database function already passes the full lint gate.

Fresh CI reconstruction, exact-head source gates, and deployment checks are
recorded in the PR rather than assumed from local tests. No Lighthouse run or
visual-baseline acceptance is part of this backend PR. Existing immutable visual
mismatches are inherited and remain explicit; this slice changes no rendering.

## Deployment and recovery sequence

The historical [recovery receipt](evidence-first-foundation.recovery.json)
records a successful isolated restore at **2026-09-05T13:56:38.812Z**. All eleven
producer checks passed; the fifteen catalog tables contained 96,523 rows, and
source/restored catalog and schema/function/grant/RLS fingerprints match. The
receipt binds the earlier manifest, not the final manifest above, and is outside
the release validator's 24-hour operational window as of September 8. It cannot
authorize deployment. A fresh genuine restore and newly generated sanitized
receipt are required; do not rewrite this historical receipt's timestamp or hash.
The [September 8 list-refresh receipt](evidence-first-foundation.recovery-20260908-034016.json)
records actual capture at 01:51:12.652Z and restoration at 03:40:16.408Z for the
previous five-only manifest. All eleven checks passed for 15 tables and 96,523
matching rows. Adding staging prerequisites changes the shared manifest digest;
this receipt does not authorize the revised manifest. It remains unchanged;
a genuine restore/rebind was required for the new shared digest.
That rebind is now recorded separately in the
[shared-manifest receipt](evidence-first-foundation.recovery-20260908-042117.json):
actual restoration at 04:21:17.447Z from the original 01:51:12.652Z schema capture,
with all eleven checks passing and exact manifest binding. The production-baseline
five-migration integration passed all 222 assertions. These results do not certify
the staging-only prerequisite application or replace its separate rehearsal.
Private production rows were not exported. Backup,
encrypted archive, key and bootstrap supplement remain outside the repository.

1. Keep the data/API PR in draft until exact-head CI and the fresh recovery drill
   pass. Then review and normally merge; do not promote the new frontend yet.
2. Use the September 8 schema-and-catalog receipt for the final manifest and
   revalidate its freshness at deployment; repeat the restore if it expires or
   relevant inputs change.
3. Retain only the sanitized receipt in Git, never backup data, keys, identities or
   private filesystem paths. It binds the manifest digest, not its own future SHA.
4. Dispatch the resulting exact current-main source to staging with the manifest.
   Require the matching successful staging receipt and post-migration checks.
5. Dispatch production only with the same manifest, current source, successful
   staging evidence and verified recovery receipt. No bypass or direct untracked
   SQL fix is part of this procedure.
6. Verify private-table isolation, token revocation, v2 APIs and production smoke;
   only then promote the separately verified frontend.

Recovery safeguards are specified in [`scripts/ci/README.md`](../../scripts/ci/README.md).
Rollback must preserve the new privacy boundary; an isolated restore of an older
schema is recovery evidence, not permission to re-enable enumerable public data
or unsupported score interpretation in production.
