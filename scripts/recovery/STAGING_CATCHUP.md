# Scoped staging recovery rehearsal

This tooling targets staging `rxtaicdpnaqigowdbmsb` only. It does not use the production database password or change the production recovery receipt.

## Retained evidence

Private capture leaf: `staging_capture_1788838563574_63efee5f`.
The encrypted selected-table schema/data archives contain fifteen approved catalog tables and 98 rows. Auth's two user rows were never exported. The ten operational MV refresh records were separately retained with an explicit nonidentity trigger-value allowlist and unchanged ID-set check. The product change log was empty; no historical actor payload was exported.

The expiring capture role had specific SELECT grants, verified TLS, and a read-only snapshot. BYPASSRLS allowed complete selected-table capture; no blanket read-role membership was granted. Cleanup verified zero leftover capture roles/sessions and semantically unchanged source grants. Temporary passwords stayed in memory; only the existing PAT was read from the explicitly allowed primary env file.

An early unsafe cleanup predicate was corrected after root recovered the role. Cleanup now selects owned backend PID/start-time pairs, rechecks exact OID/PID/start time, then terminates through a separate procedural statement. An actual PostgreSQL regression under a non-superuser cleanup role proves an unrelated persistent connection survives.

Full schema-only pg_dump still needs private-table locks. The archive is therefore selected-table schema only. Full live schema/function/grant/RLS/role/extension metadata and managed Auth/Storage/Realtime DDL were separately captured and encrypted, without table rows.

## Reconstruction and proof

A fresh network-none/tmpfs container has no host mounts, ports, credentials, cron execution or persistent logs. It uses Supabase's image bootstrap and the exact 227 source migrations from `7a67dc9085e07c6c0b4353b42d2c006787a1c6f0`. Historical reconstruction uses local bootstrap authority; source role attributes are restored and postgres is verified NOSUPERUSER before forward work.

Full source schema/function/RLS and semantic ACL/default-ACL/database/role/extension authority must match. Index ordering and equivalent ACL defaults are normalized; constraints, validation flags, grantors and grant options are preserved. Missing managed DDL comes from actual source metadata, never no-op substitutes.

Only synthetic historical rows in this newly created disposable container are cleared before actual catalog restoration. This does not authorize truncating real staging or production. Fifteen restored table hashes must match independent source verification. Operational logs and relevant sequence states are also restored.

The ten catchups run as managed postgres. The inverse journal checks fifteen catalog hashes, two audit/log hashes, six sequence states, schema/functions/RLS and grants. Original product rows are updated in place, never deleted; only journal-identified newly inserted rows are removed. Timestamp/audit trigger modes are restored before verification. Caches are recomputed, not claimed to reproduce old cache timestamps.

After inverse verification, the frozen manifest's ten prerequisites plus five B migrations run under managed postgres, followed by pinned CLI-equivalent whole-user-schema lint. This is an isolated rehearsal, not remote deployment, private-user restoration, Auth-session restoration or storage recovery. Real staging rollback still requires a quiescent writer window and freshly bound recovery plan.

## Reuse the successful capture

Do not repeat remote capture merely to regenerate local evidence.

```powershell
node scripts/recovery/staging-reconstruct.mjs --capture staging_capture_1788838563574_63efee5f --supplement managed-metadata-1788839108933.enc --state recovery-state-1788841277677.enc --manifest-sha256 3389ef688241f5e14a2ac0e1912fc4dd082e33c844b8a7d69fc535b5eb60cd4b --execute
```

Per-attempt sanitized receipts are written to ignored `audit-reports/recovery/staging-rehearsal-*.json`. Raw archives, ciphertext and keys are never PR/workflow artifacts.

```powershell
node --test scripts/recovery/staging-read-capture.test.mjs scripts/recovery/staging-catchup-plan.test.mjs scripts/recovery/staging-drain-local.test.mjs
```
