# Release safety and CI contracts

The required GitHub contexts remain **Typecheck & Lint**, **Unit Tests**, **Build**,
and **Playwright Smoke**. Two deterministic Vitest shards feed `Unit Tests`; a
failed, cancelled, or skipped shard fails the aggregate. Main's single coverage
run remains separate so partial-shard coverage is never compared with full-suite
thresholds. CodeQL analyzes both TypeScript/JavaScript and Python ingestion.

`Change Risk Gate` is initially **not ruleset-required**. It makes applicability
visible and requires exact-head successful checks from GitHub Actions. Missing,
failed, cancelled, neutral, and unexpected skipped results do not pass. Promote
this context only after an exact-head run and reviewed failure-injection tests.
Workflow/classifier changes select all risk lanes. Existing visual and database
workflows remain until replacement coverage is demonstrated; no cancelled run is
claimed as coverage. Historical policy enablement and intentional acceptance use
distinct names, not the ordinary visual-comparison context.

Applicability and rollup execute from the exact trusted PR base under
`pull_request_target`; candidate code is fetched as Git data only. Candidate
policy tests run separately under the unprivileged ordinary PR Gate. Therefore
the new risk workflow is not available from main during its own introduction:
merge the reviewed safety slice first, validate its behavior on the subsequent
product PR, and only then require the context. Do not fabricate a successful
self-authorized bootstrap result.

The base workflow's publisher job is named **Publish exact-head risk verdict**.
It uses only `checks: write`, `contents: read`, and `pull-requests: read` to create
the actual **Change Risk Gate** check explicitly on the PR head SHA. It validates
the current head before creation and again before a passing completion; a stale
head receives no success. This avoids treating a pull-request-target job attached
to the base commit as head evidence. Interrupted publication remains unproven,
never green.

Python contracts run through pytest so both unittest classes and pytest-style
functions/parametrizations execute. `requirements-test.txt` is a hash-pinned test
overlay derived from unchanged production pins; do not rely on runner-installed
pytest. Pytest 9.1.1 includes native subtest handling, so no redundant
`pytest-subtests` plugin is installed.

Lighthouse no longer starts on PR/push events. A manual experiment must name an
exact commit and an unresolved question before measurement; the fixed weekly
Monday surveillance uses exact scheduled main. Both retain the existing guarded
public/authenticated five-mobile/five-desktop method and thresholds. This trigger
change creates no new measurement and changes no historical sample or baseline.

Run local contracts with `node --test scripts/ci/*.test.mjs` and actionlint on
changed workflows. `security-hygiene.mjs` inspects tracked files and emits only
JSON-encoded filename, line, rule, and `[REDACTED]`, never matched source text.
It is a narrow hygiene check, not a replacement for dedicated secret scanning.

## Database deployment

Only **Deploy Database** can call the reusable deployment implementation.
**Sync Cloud DB** is a non-mutating retired-entrypoint notice. All calls use one
`database-<environment>` concurrency group with cancellation disabled and pinned
Supabase CLI 2.111.0. No automatic staging mutation remains: dispatch identifies
the actual migration set instead of applying every pending historical migration.

Dispatch from exact current main, supplying:

- `source_sha`: exact current-main commit; execution uses the dispatch commit,
  never code selected from an arbitrary input ref.
- `migration_manifest`: committed relative JSON path with `schemaVersion: 1`,
  `scope: "catalog-only" | "database"`, and a nonempty sorted `migrations` array
  of `{ "path": "supabase/migrations/<14digits>_<name>.sql", "sha256": "<64hex>" }`.
  Hash the LF-normalized committed SQL bytes. Manifest digest is SHA-256 of the
  committed manifest bytes, including its final newline.
- `dry_run`: defaults true. Real deployment requires false.
- Production additionally requires `staging_run_id` and `recovery_receipt`.

Only a repository actor with write/maintain/admin permission may dispatch. The
driver verifies exact current main again immediately before mutation. Existing
GitHub Environment protections continue to apply; this implementation does **not**
claim that a human reviewer rule is configured or manufacture reviewer approval.

The CLI dry-run pending list must exactly equal the manifest. No `--include-all`,
seed, or role replay is permitted. After applying, no migration may remain pending
and database lint must pass. CLI output remains in process memory because errors
may contain SQL literals, record values, or credentials. Only stable failure codes
and a sanitized deployment receipt are emitted. Production deployment smoke is
still a separate required operational verification; DB lint is not product proof.

Required access: existing Supabase access token and production project/password;
staging must have its own `SUPABASE_STAGING_PROJECT_REF` and
`SUPABASE_STAGING_DB_PASSWORD`. Missing access fails closed. No secret values are
written into receipts.

### Staging evidence

Production downloads `database-receipt-staging` from a successful **Deploy Database**
workflow-dispatch run for the same source SHA and manifest digest. A dry run,
different workflow, cancelled run, stale source, incomplete migration set, or
failed lint does not qualify.

### Recovery evidence

A committed sanitized JSON receipt must contain:

```json
{
  "schemaVersion": 1,
  "environment": "production",
  "migrationManifestSha256": "<manifest SHA-256>",
  "scope": "database",
  "backupSha256": "<backup SHA-256>",
  "restoredBackupSha256": "<same backup SHA-256>",
  "restoredAt": "<UTC ISO timestamp ending Z>",
  "result": "PASS",
  "method": "backup-restore",
  "checks": {
    "rowCounts": true,
    "identityReferences": true,
    "representativeValues": true
  },
  "storageDisposition": "not-affected"
}
```

Scope must match the migration manifest. `catalog-only` is appropriate only for
catalog data changes; schema, authorization, and RLS changes require `database`
recovery coverage. `storageDisposition` may instead be `separately-verified` when
storage objects are affected. Database backups do not establish object recovery.

Restoration must be real, successful, no more than 24 hours before deployment,
and not dated in the future. This is an **operational release safeguard**, not a
claim about food-data freshness. The historical DR seed/migration rebuild is not
a backup restoration and cannot satisfy this receipt. Preserve the actual backup
in its access-controlled recovery location; do not commit or upload raw database
records as CI evidence. The source checkout and manifest digest bind the receipt
without a self-referential source-SHA field.

The receipt is auditable evidence, not cryptographic proof that the documented
experiment occurred. The authorized maintainer must retain its actual restoration
log and independently inspect it before dispatch; never generate a PASS receipt
solely to satisfy the validator.

## Current limitations

- Existing optional browser programmes are not yet consolidated. Their results
  must not be described as passed when cancelled.
- Baseline acceptance still requires the repository's actual candidate-review
  evidence. General permission to redesign is not an exact visual approval.
- Enabling `Change Risk Gate` in the live ruleset is a separate rollout step,
  not an effect of adding its YAML file.
