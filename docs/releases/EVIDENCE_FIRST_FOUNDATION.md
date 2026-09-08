# Evidence-first foundation: data and API release

This is the backend foundation slice of the approved rebuild. It does not promote
the redesigned frontend, certify all catalog facts, or complete private-beta
readiness. Apply and verify this schema before promoting its v2 consumers.

**Draft release HOLD:** bounded forward repairs for inherited operator/function
errors are included, but exact-head CI reconstruction and a fresh isolated
recovery drill for the final manifest remain required. Do not merge or deploy
this draft while these gates are pending. The September 5 recovery receipt is
historical evidence: it is expired and binds an earlier manifest.
Initial managed-role fixture failures were resolved without skipping assertions;
their fixture-only adaptations are recorded below.

## Exact deployment scope

The ordered five-migration set is recorded in
[`evidence-first-foundation.migrations.json`](evidence-first-foundation.migrations.json).
The manifest has 967 LF bytes and SHA-256
`d8b43b81d5ea348112a0a540d3ee736fb8d23283891f81c748fb287a444d78d0`.
Its `schema-and-catalog` recovery scope does not claim to restore private user
rows, history rows, managed Auth services, or storage objects.

1. **Ingestion:** immutable sanitized observations, stable source/market identity,
   idempotent source-owned projection, conflict quarantine, exact quantities and
   qualifiers. Partial refreshes cannot retire unseen products or clear another
   market's barcode. Missing input is not an empty declaration or a numeric zero.
2. **Product read model:** source-backed and unverified states are distinct;
   aggregate scores are retired in the new contract. Source observations are not
   package verification. Restores the service-only provenance-helper ACL that a
   later legacy migration accidentally broadened.
   Includes bounded repairs for inherited operator SQL and the legacy suggestion
   reader's nonexistent product identifier; existing operator ACLs are preserved.
3. **Search:** evidence-first product results, explicit applied context, images,
   NOVA filtering, country boundaries, and safe multilingual/punctuation handling.
4. **Collections:** owner-authorized lists/watchlists consume the same fact model;
   existing IDs and saved references remain intact.
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
  the foundation now has 221 assertions; this is not a fresh full-suite CI result.
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

The actual sanitized [recovery receipt](evidence-first-foundation.recovery.json)
records a successful isolated restore at **2026-09-05T13:56:38.812Z**. All eleven
producer checks passed; the fifteen catalog tables contained 96,523 rows, and
source/restored catalog and schema/function/grant/RLS fingerprints match. The
receipt binds the earlier manifest, not the final manifest above, and is outside
the release validator's 24-hour operational window as of September 8. It cannot
authorize deployment. A fresh genuine restore and newly generated sanitized
receipt are required; do not rewrite this historical receipt's timestamp or hash.
Private production rows were not exported. Backup,
encrypted archive, key and bootstrap supplement remain outside the repository.

1. Keep the data/API PR in draft until exact-head CI and the fresh recovery drill
   pass. Then review and normally merge; do not promote the new frontend yet.
2. Generate a new genuine schema-and-catalog receipt for the final manifest and
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
