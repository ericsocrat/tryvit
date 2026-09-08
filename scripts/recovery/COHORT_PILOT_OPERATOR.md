# Pilot 178 operator: review status

Current production entrypoint: `cohort-production-operator.mjs`, documented in
`COHORT_PRODUCTION_OPERATOR.md`. The legacy CLI and high-level execution helpers
now refuse `--execute`; only the audited low-level engine is reused. The earlier
commands and extension plan below document historical implementation stages,
not an alternate production path. Current rollback protects the exact target,
preserves unrelated later changes, and verifies all21 unaffected-table scopes.
Historical hash-bound receipts below remain unchanged and are not relabelled.

Implemented and validated in a real restored clone; **not yet approved for production execution**. No remote
apply, rollback, inspection or capture was run while building this operator.
The previous isolated clone import/reversal receipt remains separate evidence:
`audit-reports/recovery/cohort-pilot-1788860542176/receipt.json`.
The durable orchestration has eleven unit tests plus the actual clone receipt
`audit-reports/recovery/operator-envelope-rehearsal-1788867642805.json`.
That receipt supersedes intermediate rehearsal
`operator-envelope-rehearsal-1788862438570.json`, which lacked the final strict
backend-absence assertion and source-hash freeze. The final run used HEAD
`7fb0473e961f2133b9d3c40b21449aae73f3b99c`, operator SHA256
`62e634f3e6eadb4284c2dd35b77a598ecbc929be8ecc60098645ca27b9503441`,
and harness SHA256 `7b86e01177136015af98ef0b30e1eeec088e74117371ca7a4262f120d0086280`.
The earlier strict receipt `operator-envelope-rehearsal-1788862581731.json`
remains evidence only for its old operator hash `cb120ff3...`, before the
timestamp/revision hardening; it was not amended or reinterpreted.

The harness uses the actual restored 17-table production baseline and all seven
consumer migrations, then measures the clone's 21-table empty-source state.
This is explicitly clone-origin proof, not a fabricated production21 receipt.
Persistent psql sessions receive the real operator SQL. Exact owned PostgreSQL
backends are terminated and verified absent immediately before or after COMMIT.
Independent read-only connections reopen actual DPAPI/AES-GCM disk envelopes and
identify respectively `NOT_APPLIED_MATCHING_PREIMAGE` and
`APPLIED_MATCHING_POSTIMAGE`, with one ingestion call per scenario and no retry.
The actual operational reversal then restores the complete canonical legacy
model while retaining the immutable observation; read-only inspection reports
`REVERSED_MATCHING_BASELINE`. Tampered ciphertext and production use of marked
rehearsal envelopes are rejected. Before/postimages are fsynced and reopened
before ingestion/commit. Hardware power-loss guarantees are not claimed.

This exercise exposed and fixed a real defect: passing SQL numeric JSON through
JavaScript Number lost decimal display scale (219.0 became 219). Durable nutrient
snapshots now use SQL numeric-to-text conversion, and numerical validation uses
exact decimal normalization without floating-point rounding.
Adversarial follow-up reproduced two additional defects: malformed timestamps
could bypass comparison through NaN, and string revisions compared
lexicographically. Strict calendar/offset timestamp parsing now preserves
microseconds; revisions use validated positive PostgreSQL-bigint arithmetic and
remain text in durable snapshots. Post-import verification also checks revision
equality. The latest clone receipt above reruns both lost-connection scenarios
and operational reversal against this exact hardened source.

## Exact bounded operation

`node scripts/recovery/cohort-pilot-operator.mjs` only reads local files and
prints a plan. Without a validated 21-table backup pair it reports
`PLAN_RECOVERY_REQUIRED`; it does not create files or connect to a database.

The apply plan accepts `--catalog-directory` and `--schema-directory` under
the existing private `backups/` root. It checks all present catalog receipts,
the exact restored empty-source 21-table profile, catalog archive bytes,
encrypted schema archive bytes, schema verification checks and current reviewed
consumer manifest. It binds the proof to exact target project, source HEAD,
operator source hash, retained pilot SQL plan and a resulting plan SHA256.

An eventual reviewed execution uses `--execute --confirm-sha256 <plan>` plus
explicit `--source-head <head> --target uskvezwftkkudvksmken`, the existing
`--source-env-file` and `--source-ca`. Those are operator controls, not permission
to run it now. The database connection uses the established session pooler,
existing password and verified TLS; it never provisions a role or key.

Inside one repeatable-read transaction it locks product 178 and its projection/
source rows, compares all 21 live table fingerprints with the backup, and checks
schema/function/RLS fingerprints for drift. It verifies unique PL/EAN identity,
no competing name identity, no newer recorded revision/retrieval, no independent
field provenance and all four source tables empty. It writes and fsyncs an
AES-GCM encrypted full selected preimage, wraps the random key using the existing
DPAPI helper, and decrypts the disk copy to verify it **before ingestion**.

The existing ingestion function receives the exact hash-pinned retained record.
Afterward the operator checks selected observation/hash/time, all nine nutrient
projections, field provenance/basis, missing source sets, and every unaffected
catalog row hash (including all legacy ingredient/allergen rows). It encrypts,
fsyncs and verifies the postimage before COMMIT. Receipts contain identifiers,
digests and status only. Plaintext snapshots are never persisted or printed.

## Reversal and uncertain commits

`--rollback --envelope-directory <private directory>` produces a local reversal
plan by authenticating/decrypting the before/after envelope pair. Its exact plan
digest, current source HEAD and explicit target are required for execution.
The reversal locks target rows and compares the complete live postimage with
the durable expected one. Any concurrent product, source, assertion or unrelated
catalog change stops it for review; it does not overwrite the change.

Only the selected product's prior source projection, nutrition and provenance
are restored. New source-owned assertions are removed and selection is cleared;
the immutable observation, batch and stable source mapping remain. Verification
requires the original canonical read model and `legacy_unverified` state,
unchanged independent/unaffected rows and the same immutable observation digest.
Product/nutrition technical modification timestamps legitimately advance.
They are not source/package verification dates; prior `last_fetched_at` returns.

A lost COMMIT response is `commit_outcome_uncertain`, never an automatic retry.
The durable postimage already exists. `--inspect --envelope-directory <directory>`
prepares a read-only inspection; adding `--execute` uses a read-only transaction
to distinguish matching applied, unapplied, reversed, or drifted state without
changing anything. Failure writing the final receipt after acknowledged COMMIT
is explicitly classified as applied/reversed with missing receipt, not as a
rollback. Envelope persistence/replay passed the clone validation above.

## Retained-cohort identity review

The earlier plan is preserved unchanged:
`audit-reports/evidence-cohort/production-import-plan-20260908/plan.json`, SHA256
`ac585318ba2abe4aaf62581da44a2118cf3fbff608d9a286502f8b31c90043e0`.
Its production state was checked at 2026-09-08 08:51:26 +02:00, not refreshed
for this review. All 60 retained observations remain immutable.

Names/brands are mutable attributes. Nineteen of the 23 text-change holds have
one matching market/EAN product ID, no competing source-name ID and no other
hold: DE 2041, 2467, 2892, 3160, 3085, 5832, 5823, 6063, 6039, 6038; PL 148,
182, 402, 2874, 703, 3065, 1044, 1031, 1040. They are candidates for reviewed
attribute updates, not permanently quarantined identities. A reviewed bounded
manifest should bind each retained observation hash, market/EAN/product ID,
exact old/new name and brand, and fresh identity/provenance/revision checks.
It must preserve product IDs, barcodes, saved references and observation dates.
This could make 55 cohort members eligible after review and fresh checks;
it does not authorize a 55-product import or alter the first-pilot operator.

Five substantive holds remain: 2950 and 2903 need category decisions; 628 and
2882 need explicit category/policy-version resolutions; 6029's source name maps
to existing product 6013 and needs identity reconciliation. Do not silently
rewrite retained category extraction or merge/deprecate catalog identities.

## Remaining boundary

The current implementation only applies product 178 from an empty observation
baseline. It cannot import renamed candidates or a second product after the
first import. Populated observation backup requires a separately reviewed exact
public-source manifest; it is not bypassed by a generic JSONB export. Existing
15/17/21 recovery tools and CI were not modified for this operator.

## Safe extension plan beyond the first product (not implemented)

Keep the single-178 executable unchanged in scope. The next implementation
should consume one exact reviewed manifest rather than accept arbitrary IDs,
source payload files, SQL or unconstrained command flags.

1. Begin with the other 35 members of the existing unchanged-record candidate
   set. They are eligibility candidates, not evidence of a production import.
   Add the 19 rename-only candidates only after their old/new attribute manifest
   is reviewed. Leave the five category/policy/collision holds excluded until
   explicit resolution. Do not modify the retained 60-member receipt or payloads.
2. Bind each selected record to country, barcode/external ID, existing product
   ID, observation-file SHA256, canonical payload hash, extractor/category-policy
   versions, exact approved before/after attributes, source URL/license, source
   revision and original retrieval/update times. Name and brand changes are
   reviewed attributes; market + source identity remains the stable key.
3. Reconcile against a fresh database snapshot. Require unique market/EAN
   mapping, no competing identity, stable current source mapping, numeric
   revision/time ordering, and preservation of independent assertions. Missing
   inputs remain missing. A source conflict stops that candidate without
   overwriting its product. Never clear another market's barcode or deactivate
   members absent from this partial batch.
4. Rehearse a small deterministic batch in the real restored clone first.
   Include repeated batch/idempotency, interruption, stale observations,
   independent-source conflicts, explicit empty versus missing sets, and
   out-of-order reversal. Choose subsequent batch size from measured lock and
   transaction behavior. The first implementation can use one transaction and
   encrypted before/postimage envelope per product, with the reviewed batch
   receipt listing their exact results. This avoids converting a partial
   failure into whole-category cleanup.
5. After each completed batch, reconcile exact selected observations, nutrition
   precision/basis/qualifiers, source dates, independent legacy/source assertions,
   canonical read models, IDs and saved-reference invariants. Preserve
   per-product outcome uncertainty explicitly; inspect before retrying.

### Populated observation recovery allowlist

Do not weaken `observations-v1`'s current empty-only guard. Add a separately
versioned populated profile after its capture/restore tests pass. Its approved
manifest should enumerate the exact current immutable observations by source
record UUID, product ID, market/external ID, observation UUID, batch UUID,
payload hash, extractor version, source URL/license, timestamps, revision and
status. Include the intended selected observation IDs and all required older
observations. Approval concerns these exact public OFF food records, not a
general permission to export arbitrary JSONB or user data.

Inside the same repeatable-read snapshot used by pg_dump:

- Require exact set equality for the allowed observation, source-record, batch
  and source-assertion rows; reject extra/missing IDs, unexpected sources or
  versions, mismatched metadata, and invalid relational closure. Verify payload
  hashes/canonical extraction against the retained approved bytes. Match source
  assertion JSON to its approved observation, rather than trusting a generic
  key whitelist. Shared batches must include every referenced approved member.
- Preserve the complete four-table relationship: batches, source records,
  immutable observations and selected/assertion references. Include the existing
  17 catalog/registry tables and real observation foreign keys. Unknown or
  quarantined rows outside the reviewed manifest stop capture; never delete
  them or bypass the guard to obtain a successful receipt.
- Keep populated raw payloads, beforeimages, metadata and schema archives
  encrypted using the established AES-GCM/DPAPI boundary. Public receipts expose
  counts, IDs, digests and verification status only. Restore and compare exact
  rows, constraints and canonical reads in an isolated clone before treating
  this as populated-source recovery evidence.

Operational reversal remains selection/projection restoration, not destructive
table restoration. Restore only the reversed source's previous assertion set
and pointers; preserve every independent source and every immutable observation.
Keep withdrawn observations and batches as historical accepted ingestion, with
reversal recorded separately. A duplicate retry must not silently reactivate a
withdrawn selection; re-selection needs an explicit reviewed operation.

This is a plan for an additive operator/profile extension. No populated capture,
multi-product execution or approval of the held cohort members is claimed.
