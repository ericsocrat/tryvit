# Scoped recovery evidence

`catalog-recovery.mjs` performs a **real catalog-data backup and restoration**,
not a migration/seed reconstruction. It is intentionally not database-wide DR.

## Catalog mode

- Fifteen fixed public catalog tables only; no Auth/customer tables or objects.
- Source is the verified TryVit project/session pooler. Credentials remain in
  process environment, never command arguments or output.
- Native `pg_dump` uses the same exported, read-only repeatable-read snapshot as
  privacy checks and row fingerprints. Non-null reviewer identities, unexpected
  image sources, unreviewed source metadata or external references stop export.
- Raw archive and metadata stay under ignored `backups/` with user/SYSTEM/admin
  ACLs. Nothing uploads them. Use a trusted Supabase CA with `verify-full`.
- Restoration creates a fresh, strictly named database in the owned loopback
  test container. Existing databases cannot be overwritten. No `--clean`.
- Compare all selected row hashes/counts, table shapes, and validated internal
  structural constraints. Preserve source projection-definition fingerprints.
- Explicitly excluded: external Auth reference validation, RLS, triggers,
  general indexes, RPC execution, managed services, and storage object bytes.

Prepare without export:

```powershell
node scripts/recovery/catalog-recovery.mjs --source-env-file <existing-project-env>
```

Execute the scoped export/restoration only after its privacy boundary is known:

```powershell
node scripts/recovery/catalog-recovery.mjs --source-env-file <existing-project-env> --source-ca <trusted-public-ca> --execute
```

The existing broad `BACKUP.ps1` is not called by this tool. Its whole-database
scope and lack of a restoration experiment do not establish this proof.

## Tested containment primitives — no full production export yet

`opaque-containment.mjs --probe` launches only a synthetic PostgreSQL probe.
It tests a pinned Supabase PostgreSQL 17 image with network **none**, no ports,
no host mounts or Docker socket, a read-only root filesystem, dropped
capabilities, no-new-privileges, non-root UID, bounded CPU/memory/PIDs, no swap,
no Docker log persistence, tmpfs data/temp directories, disabled cron execution,
and a five-minute watchdog. It verifies blocked egress/root writes and cleanup.

AES-256-GCM primitives and a Windows CurrentUser-DPAPI protected key roundtrip
are tested, including wrong-key/ciphertext tampering. No production data enters
the probe. `dpapi-key.ps1` is a private pipe helper: callers must capture its
stdout in memory, never invoke it in a way that prints an unprotected key.

## Schema plus catalog mode

`schema-catalog-recovery.mjs` implements the bounded schema-only experiment.
It never exports private production rows. A completed catalog-only archive is
required, and its exact row hashes must still match the source snapshot.
The reader accepts the catalog producer's `receipt.json`, with legacy
`verification-v2.json` supported when it is the only receipt. Every present
receipt must independently include complete table-shape, constraint, row-hash,
archive-integrity and scope evidence and agree on the restored database/time.
An incomplete or failed receipt cannot be bypassed by another PASS receipt.

```powershell
node scripts/recovery/schema-catalog-recovery.mjs --source-env-file <existing-project-env> --source-ca <trusted-public-ca> --catalog-directory <private-catalog-backup> --manifest-sha256 <exact-manifest-hash> --execute
```

`--capture-only --execute` captures an encrypted schema archive but explicitly
returns `CAPTURED_NOT_RESTORED`, not PASS. A later offline attempt can reuse that
capture with `--schema-directory <private-encrypted-capture>` and the exact
manifest digest, without another production export. Source role/structural
metadata are encrypted with the archive; no passwords or role settings are
exported. Role memberships are structural metadata. Platform settings and
credential restoration are not claimed.

The hosted GraphQL bootstrap has an extension-attached wrapper and schema ACLs
that ordinary `pg_dump` does not reconstruct in a bare cluster. The tool
captures their **actual source definitions/owners/grants** in an encrypted
supplement and verifies that the surrounding schema has not changed. It first
restores schemas/extensions, applies that exact supplement, then restores all
remaining archive entries. No function is replaced with a no-op. The recovery
image is pinned to `17.6.1.075`, which provides production's `pg_graphql1.5.11`;
image `17.6.1.165` provides only `1.6.1` and is not a compatible substitute.

Structural equality treats index definitions as sets (order is not meaning).
ACL equality uses PostgreSQL `aclexplode`/`acldefault`, retaining grantors,
grantees, individual privileges and grant options; explicit owner-only ACLs
and the identical PostgreSQL default compare equivalently. A changed grant or
index definition still fails. Source function text and RLS definitions remain
exact comparisons. The encrypted supplement hash is included in the receipt.

The restore target is always a new, network-none, tmpfs-backed container; the
tool does not accept a target host/database or reuse an existing container.
It compares actual constraints/indexes/triggers/views/functions, object owners,
ACL/default ACL/RLS definitions and all catalog row hashes. Synthetic roles
exercise existing direct-table denial and allowed service reads, with rollback.
All restored SQL is treated as potentially executable code: no egress or host
mounts, no credentials in the container, no cron execution or persisted logs.
The recovery bootstrap superuser is separate from restored source roles,
preserving the actual managed `postgres` role attributes. The isolated locale
matches the read-only verified production `en_US.UTF-8`/UTF8 setting. Synthetic
test behavior is exercised inside rollback, and the entire container is removed
after success or failure. Receipts are retained per attempt; `receipt.json` is
only the latest receipt pointer. A FAIL receipt returns a nonzero command exit.

For additive, closed catalog/schema/RPC changes, prefer:

1. Obtain a **schema-only** production archive through the same verified TLS,
   read-only snapshot mechanism. This includes dependency definitions but no
   Auth/customer rows. Keep all archive bytes opaque to the agent.
2. Stream archive bytes into authenticated encryption; wrap its random key with
   CurrentUser DPAPI. Store only ciphertext/wrapped key in the private backup
   directory. Never upload either, and never write a plaintext archive.
3. Verify the GCM tag before restoration. Decrypt only into the isolated
   tmpfs-backed PostgreSQL container; no production credentials enter it.
4. Restore actual schema definitions, including grants/RLS with explicit service
   role dependencies. Do not replace failing functions/policies with no-ops.
5. Restore the already captured catalog rows only if its table fingerprint
   matches the schema archive. Check all row hashes, structural references,
   function/view/grant/policy fingerprints and relevant synthetic-role tests.
6. Apply the proposed additive catalog migration to that restored isolated
   state and run focused regression/authorization tests. No production apply.
7. Remove the volatile container; retain encrypted archives and sanitized
   receipts. Test cleanup after failure and interruption, not only success.

This can establish **catalog data plus SQL schema/RPC recovery** if all dependency
and behavior checks genuinely pass. It still cannot prove restoration of private
customer rows, managed Auth sessions, cloud-service configuration, or storage
objects. A migration classifier must prove that changed objects stay inside this
boundary; do not relabel this evidence `database` merely to satisfy a gate.

An opaque full-data experiment is a separate escalation, not an automatic
fallback. It requires root review of the tested streaming/encryption/containment,
dependency-restoration, redaction, resource-limit, and cleanup implementation
before any private-row export. No tool here implements or authorizes that export.

## Restored-state migration integration

`migration-integration.mjs` reuses retained archives offline, verifies the base
restoration first, and applies the exact five-file manifest as the original
managed `postgres` role—not the isolated bootstrap superuser. It then runs the
focused ingestion/read/search/collections/share/operator suites (222 assertions
at this revision).
It does not modify the original recovery receipt or any frozen migration/test.

```powershell
node scripts/recovery/migration-integration.mjs --catalog-directory <private-catalog-backup> --schema-directory <private-encrypted-capture> --database-authority <retained-metadata-json> --execute
```

The schema-only archive does not retain database-level ownership/ACL, so this
experiment also requires an explicitly timestamped read-only `pg_database`
metadata record. The tool restores exactly that authority and checks its
equality before migration application; it does not invent `CREATE` privileges.
No new catalog or private-row export is performed by the integration runner.

Before installing test-only pgTAP, the clone runs the release-pinned Supabase
CLI v2.111.0's exact schema-selection and `plpgsql_check_function` rules. This
checks every function selected by the ordinary no-`--schema` lint command;
errors are retained and block integration. It is explicitly an equivalent SQL
execution, not a claim to have executed a Linux CLI binary inside the container.
pgTAP is absent from production and has static-check false positives for its
temporary tables/version branches, so test installation follows lint rather
than hiding those errors or weakening the deployment gate. PostgreSQL statistics
are preloaded to exercise the real diagnostic query paths; cron stays disabled.

Two explicit fixture adaptations are recorded with original/executed hashes:

- Search uses a synthetic 30-requests/60-seconds configuration row matching the
  repository default, because operational configuration rows are outside the
  catalog data restore. This does not certify live production configuration.
- Collections' intentional FK-orphan fixture uses a zero-argument, fixed-value,
  local-only privileged helper. It inserts only the exact synthetic missing
  membership. Its `session_replication_role` override resets on function exit;
  all application assertions and migrations run under the managed role without
  granting that role the ability to disable constraints.

All assertions remain present, and skipped/TODO/missing assertions fail the
runner. Real pgTAP is installed in the isolated clone. Fixture mutations roll
back and the whole disposable container is removed. Sanitized per-attempt
reports live under ignored `audit-reports/recovery/`; earlier failures remain
visible and no schema/catalog backup is represented as private-data recovery.

## Sanitized artifact interface

Use a committed sanitized receipt or a workflow artifact such as
`recovery-evidence-v1` containing **only** that receipt. Bind it to the
migration-manifest digest, encrypted/plain
archive hashes as appropriate, restoration timestamps, exact scope, successful
checks, and explicit exclusions. Record the actual producer run/actor separately.
Raw backups and key material never belong in a PR, workflow artifact, or chat.
Avoid committing a receipt that must name its own future commit SHA.

The receipt is evidence of an actual operator-run experiment, not cryptographic
proof that arbitrary reported booleans are true. The raw archive must remain
recoverable by the authorized owner; the restore environment is disposable.

Run tool contracts with `node --test scripts/recovery/*.test.mjs`.
# Versioned catalog recovery scopes

Both `catalog-recovery.mjs` and `schema-catalog-recovery.mjs` accept
`--scope-profile consumer-v1` (programmatic option `scopeProfile`). Omission
retains `catalog-v1`: the original 15 tables and schemaVersion 1 receipts,
including existing foundation captures and replay. Scope is never inferred
from a larger archive.

`consumer-v1` adds exactly `formula_source_hashes` and `scoring_model_versions`
for 17 tables. It emits schemaVersion 2 receipts with `scopeProfile`, validates
the exact coverage and fingerprint table sets, and carries the profile through
dump selection, source metadata, encrypted schema/archive pairing, drift checks,
restoration fingerprints and combined receipts. Pass the same profile when
capturing and replaying. A legacy 15-table receipt cannot satisfy this profile.

Before dumping, the same read-only snapshot checks identity-bearing columns
using counts only. `scoring_model_versions.created_by` permits only NULL or the
exact system literals `postgres`, `system`, and `migration-608`; the latter is
the checked-in v3.3 migration creator. Any other value stops capture without
printing it. All other identity columns retain their NULL-only requirement.
Unknown values are never rewritten to a permitted creator.

The 21-table `observations-v1` permits capture and replay only with all four
source tables proven empty in the same exported repeatable-read snapshot.
Any populated table or malformed count response stops before row dumping.
Metadata/receipts carry `empty-in-export-snapshot`; replay also requires zero
counts and the exact empty-row digest for every source table. The additions are
`ingestion_batches`, `product_source_records`, `product_source_observations`,
and `product_source_assertions`. The actual schema permits JSONB/free text;
the ingestion extractor's key whitelist alone does not authorize exporting all
stored rows. A subsequent implementation may bind populated rows to an explicit approved public OFF
manifest (payload hashes, sources, URLs and batch identities). This restriction
does not require speculative proof about arbitrary public food text.

Observation rollback must restore prior projections, source selection and
source-owned assertions while retaining immutable observations. A successful
clone restoration is not permission to delete production observation history.

Local verification: `node --test scripts/recovery/catalog-recovery.test.mjs scripts/recovery/schema-catalog-recovery.test.mjs`.
These tests do not certify a production capture or Docker restoration.

## Retained product 178 pilot rehearsal

`node scripts/recovery/cohort-pilot.mjs` returns a deterministic plan and SQL
digests with no writes. `--execute --confirm-sha256 <planSha256>` additionally
requires `--catalog-directory`, `--schema-directory`, and
`--database-authority`. It only invokes retained-backup restoration into the
network-none disposable clone; it has no production execution path. The exact
retained observation and original pilot SQL are hash-pinned. The original
historical file remains untouched; generated `mutation.sql` explicitly says it
imports and commits. Artifacts and receipt go under `audit-reports/recovery/`.

The clone restores the real 17-table baseline, applies the checked current
seven-migration consumer manifest, proves the four source tables empty, and
imports only product 178. Assertions check exact selected source identity,
payload and source times, extracted provenance/basis, missing fibre/trans-fat,
all independent legacy ingredient/allergen rows, and full-row hashes for every
unaffected catalog record. This pilot has missing ingredient/allergen sets;
it does not demonstrate replacement of a populated source-owned set.

Operational reversal locks the selected product, nutrition, provenance, source
mapping and source assertions and refuses changed post-import images. It restores
the prior projections, removes only the new observation's projected fields and
assertions, clears the selected observation, and retains the immutable observation,
batch and stable mapping. Product/nutrition `updated_at` reflect reversal writes;
all other target projection fields must equal their prior values. This is not
target-row byte identity. Original `last_fetched_at` is restored; technical
modification time is never presented as package/source verification time.
The canonical `evidence_private.product_one` result must again equal its entire
baseline, with `legacy_unverified`, no selected source facts, and no new assertions.

Before any production import, a separate reviewed production execution workflow
must preserve durable before-images and obtain fresh 21-table empty-source recovery
evidence. The clone's `recovery_pilot` tables are rehearsal fixtures, not a durable
production rollback store. Populated observation backups and multi-product imports
remain outside this first-pilot implementation.
