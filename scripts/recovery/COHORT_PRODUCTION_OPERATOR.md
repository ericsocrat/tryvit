# Versioned production cohort operator

Implementation independently reviewed; versioning and production execution remain pending. No cloud operation was
performed while implementing this entrypoint. Historical clone receipts remain
evidence for their exact earlier hashes, not production approval.

`node scripts/recovery/cohort-production-operator.mjs` is local planning only.
The old pilot CLI refuses `--execute`; it retains read-only plan compatibility.
Only this wrapper owns production connectivity. Its injected dependencies exist
for synthetic/local tests, not CLI-configurable alternate recipients.

## Required authority

Before any connection, execution requires:

- a clean versioned checkout, with HEAD equal to cached origin/main and the
  explicitly reviewed `--source-head` / `--main-sha`;
- fresh read-only `git ls-remote` equality against the fixed TryVit repository;
- exact hashes of the operator/recovery code, inputs, recovery receipt and CA;
- explicit project `uskvezwftkkudvksmken` and exact `--confirm-sha256` plan;
- verified TLS to the fixed Supabase session-pooler host/project username;
- `standard_conforming_strings=on`, expected database/user, and read-only mode
  for inspection/capture. No ambient libpq service/host/SSL override is inherited.

Credentials are read only after all local/source gates pass, from existing
operator environment or `--source-env-file`. Passwords never enter argv or
reports. `--source-ca` is a reviewed certificate path, not a TLS-disable switch.
No role, public route, cloud configuration or dependency is provisioned.

### Session initialization and dump boundaries

The fixed production session pooler was observed to ignore startup `PGOPTIONS`
for `default_transaction_read_only`. The operator therefore explicitly executes
`SET SESSION standard_conforming_strings = on`, and for capture/inspection
`SET SESSION default_transaction_read_only = on`, on each newly opened SQL
connection. It then verifies the database, session user, string mode and both
default/current transaction read-only settings on that same connection. A failed
SET or verification closes the connection before snapshots, envelopes or imports.
These are session-only settings; no role defaults or cloud configuration change.
Write operations do not reset read-only settings to off and retain their existing
transaction and recovery boundaries.

The separate `pg_dump` process does not inherit those established SQL sessions.
Its read-only transaction boundary comes from the PostgreSQL 18.1 implementation:
it begins a repeatable-read, explicitly read-only transaction before importing the
exported snapshot. Its startup options are not evidence of an enforced query
timeout: `pg_dump` itself resets server statement timeouts. The wrapper enforces
a 120-second external process timeout, retains scoped snapshot arguments, and
clears failed partial output buffers. See the
[PostgreSQL 18.1 pg_dump source](https://github.com/postgres/postgres/blob/REL_18_1/src/bin/pg_dump/pg_dump.c).
Unit tests are not a production capture certificate; the corrected transport
still requires an actual source-bound capture and isolated restore.

## Bounded sequence (not executed by implementation)

Every command is first run without `--execute`; review its returned SHA before
adding `--execute --confirm-sha256 <sha>` and exact source/main/project flags.
Use a clean checkout of the merged operator version and copy only the existing
hash-pinned retained inputs into its ignored local evidence location.

1. `--action inspect-sources` reads the four source tables in a read-only
   transaction, verifies that all contents are the retained public cohort, and
   returns only a proposed public allowlist of IDs/digests/source attribution.
   Unknown/private contents are rejected rather than printed. This is not approval.
2. Review/save that public manifest, then `--action capture --allowlist-file <file>
   --reviewed-allowlist-sha256 <sha>`. An omitted file proposes an empty manifest,
   which must still match the actual source snapshot before dumping.
3. Capture uses one exported read-only snapshot for privacy/allowlist checks,
   schema/roles and both dumps. Dumps remain in memory until encrypted. It then
   actually restores the combined full-schema/21-table archive into an isolated
   database. No generic or clone-only JSON receipt can replace this producer.
4. First apply: `--action pilot --recovery-directory <combined directory>
   --reviewed-allowlist-sha256 <empty sha>`. All four source tables must be empty
   in the restored production proof and still match in the applying transaction.
   Only the audited retained product178 operation runs.
5. Inspect the new public source state; review its new allowlist and create a
   fresh combined populated21 capture/restore. Then `--action batch --ids <1–5 IDs>
   --reviewed-cohort-sha256 <retained cohort sha> --recovery-directory <directory>
   --reviewed-allowlist-sha256 <captured public sha>`. The five held identities
   and pilot178 are excluded from remaining-batch selection.
6. Repeat a fresh reviewed capture before each later bounded batch. Never reuse
   the original empty21 proof after the first import, or label old snapshots fresh.

The first transaction of a batch rechecks the complete live21/schema/role state
against its proof. Later members recheck schema/roles while validating their own
fresh identity/preimage and every unaffected row inside each transaction. This
allows known previous member writes rather than comparing against a stale whole
catalog. Each transaction excludes only its own member from unaffected hashes;
peer writes fail before COMMIT. Final peer postimages add another check.

## Durable outcomes and rollback

Before/after envelopes reuse the private ACL, DPAPI, AES-GCM, fsync and disk-read
verification boundary. Every member has its own envelope directory. Processing
stops on the first failure; no failed or uncertain member is automatically retried.
An uncertain commit reports unknown write disposition, never `remoteWrites:false`.
Executed HOLD/UNKNOWN or unrecognized dispositions return a nonzero process exit
status while preserving the sanitized receipt and encrypted envelopes. A shell
success cannot substitute for the explicit result, and no automatic retry occurs.

`--action inspect --envelope-directory <directory>` opens an authenticated
production envelope and performs only read-only target inspection. Batch envelopes
also require the reviewed cohort digest. Output is disposition/IDs/hashes, never
tokens, credentials or full snapshots.

`--action rollback --envelope-directory <directory>` binds a new reviewed plan to
the authenticated original postimage and a `--recovery-directory` whose
source/code-bound schema and roles still match. This structural proof does not
require unrelated live data to equal the earlier backup. Both pilot and remaining-member rollback
compare the exact target, preserve unrelated later changes, and require unaffected
fingerprints to remain identical across the rollback itself. Observations and
batches remain immutable; target projection/source selection is reversed. New
encrypted reversal evidence is retained separately from the original envelope.

Missing final receipt after acknowledged COMMIT is reported explicitly and never
misrepresented as rollback. Reconcile the returned envelope directories before
deciding any further action. These controls do not claim hardware power-loss
durability or managed Auth/storage disaster recovery.

## Remaining release boundary

Independent code/proof review, a focused tools PR, ordinary checks and exact-main
versioning precede production use. Actual production empty/populated capture,
source freshness, first pilot and subsequent batches have NOT been certified by
local implementation tests. No production authority is implied by a clone PASS.

## Implementation verification

All 88 recovery unit tests pass, with no skipped tests. The artifact-dependent
cohort/pilot tests now use synthetic injected inputs and also pass in a copied
scripts-only tree without Git, backups or retained production evidence. No real
cohort data was added to Git for tests.

Actual locked-transaction integration:
`audit-reports/recovery/cohort-batch-rehearsal-1788878175013.json`, SHA256
`1b47a1ce8c165c1de1289d0c85b52e589c1b207fee20ec115b0e0b4d1e423841`.
It applies/reverses three retained members, executes nine in-transaction
recovery checks, and actually captures/restores both empty21 and populated21
with full schema/roles/grants/RLS verification. Both receipts are explicitly
isolated-clone and reject production relabelling. This is not a new full54 or
production transport certificate; earlier full54 receipts remain separate.

The default CLI was exercised locally and returned `PLAN_BLOCKED` with all
remote/local write flags false. No `--execute` production command was run.

The final pilot engine also passed the actual restored-clone durable-envelope
and lost-COMMIT rehearsal:
`audit-reports/recovery/operator-envelope-rehearsal-1788878336006.json`.
Engine SHA256:
`6c1ea81f37bcc4ae67f3c0520c1ab726ef5f79f12714826cb2f0bbde9b8b4283`.
It verified owned-backend termination before/after COMMIT, read-only outcome
reconciliation, encrypted-envelope reopening, rejection of clone envelopes as
production evidence, and actual canonical rollback retaining the observation.
It is not a production connection or Turnstile first-use/replay proof.
