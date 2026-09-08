# Combined public-cohort recovery

`combined-public-recovery.mjs` adds the explicit
`observations-public-cohort-v1` profile. It does not change the default 15-table,
consumer17, or empty-only `observations-v1` contracts.

The producer has **no remote CLI or credential constructor**. A reviewed caller
supplies an authenticated transport with `identity()`, `openSession()` and
`pgDump(args)` returning an opaque Buffer. Identity must exactly match
`{environment, project}`. Bindings additionally require exact source HEAD,
migration-manifest digest, operator-code digest and reviewed public-allowlist
digest. The caller must derive these from verified authority, not labels.

`captureCombinedPublicRecovery({transport, manifest, reviewedSha256, binding})`
owns a repeatable-read, read-only transaction. Before either dump it runs all
consumer17 privacy checks and exact public-row validation/relational closure.
It captures 21 row fingerprints, schema/functions/grants/RLS, structural role
attributes/memberships and the extension bootstrap supplement. Both dumps use
the **same exported snapshot** as those checks. Payloads, schema and metadata
are encrypted with AES-GCM; keys use the established user-bound DPAPI boundary.
Files are exclusive, fsynced and under the private backups root. No plaintext
catalog archive is written. The transaction closes after capture.

Capture alone is not PASS. The existing schema recovery engine then creates a
second contained database and actually restores roles, full schema, all 21 data
tables and post-data constraints/grants/RLS. All original structure/function/
role checks and synthetic authorization checks must pass. No catalog-only PASS
receipt is fabricated to enter this path.

`loadCombinedPublicRecovery(directory, {expectedBinding})` authenticates both
archives, checks the exact binding and full restore receipt, and returns
`receiptSha256`, `migrationManifestSha256`, `sourceMetadata.fingerprints`,
`source`, `roles`, `memberships`, `manifest`, and `catalogArchive`. The caller
must zero the returned archive Buffer when finished. It rejects clone evidence
when asked for production authority. Existing receipts are not relabelled.

`assertCombinedFreshness(session, proof)` performs the initial all-21-row,
public allowlist, schema and role comparison inside the caller's transaction.
Do not compare an original backup indiscriminately after the operator's own
first committed write. Subsequent members need the independently reviewed
per-target/peer/unaffected-state contract and explicit known-write tracking.
This module does not authorize mutations or implement that tracking.

## Actual local proof

`node scripts/recovery/combined-public-rehearsal.mjs` restored the existing
consumer17 baseline, applied C7, imported three retained public records,
captured this combined profile and restored it into a second isolated database.
All schema, functions, grants, RLS, structural role attributes/memberships,
extension bootstrap, row counts/value hashes and synthetic authorization checks
passed. Freshness matched and production relabelling was rejected. The original
three imports were then reversed by the existing history-preserving engine.

Receipt: `audit-reports/recovery/cohort-batch-rehearsal-1788876795677.json`.
Combined receipt SHA256:
`193f784412b6a4358c4f2585649e70c7a981b1e26fa47e892cc8a5133135529d`.
Its environment is `isolated-clone`, source HEAD
`1868b3319cbaaae83c08c895eb15b1de8ac31d71`, migration digest
`f2f164f0e669f310fcf480eae89b4f6d09ead69fa8d0ee2e3acfe27b2bdcf048`.
This is not production recovery certification. No cloud reads or writes were
performed. Private user/history rows, role passwords/platform role settings,
managed Auth, cloud configuration and storage objects remain excluded.

### Empty-first and portable-test follow-up

`node scripts/recovery/combined-public-rehearsal.mjs --empty-first` passed both
the new profile's empty21 and populated21 full-schema restore paths at source
HEAD `a463bb227cf8891141394286de1bef9945cd80f8`. Receipt:
`audit-reports/recovery/cohort-batch-rehearsal-1788877711604.json`.
Empty combined receipt SHA256:
`4aa17ddc13da99e373300208795d704fcb8b7290afb6f4f051b4137c48475564`.
Populated combined receipt SHA256:
`cb5e1fa24dd14eb02f2ab1e1865109f6372effc7a2c52e301b0ce1aec078f50f`.
Both retain `isolated-clone` environment, passed freshness checks and rejected
production relabelling. Previous receipts remain unchanged.

The three cohort/pilot unit suites now use fabricated in-memory files through
optional programmatic input adapters; default production paths and digest pins
are unchanged, and no CLI input override was added. All 24 tests passed in a
fresh copied scripts-only tree with no audit-reports, backups or Git metadata.
They retain the 60/54 partition, exact digest, timestamp/revision, numeric,
rollback, idempotency and public-row privacy/closure contracts. The migration
manifest validator has separate tracked-file unit coverage; synthetic pilot
tests isolate that dependency without claiming to validate a real deployment.
