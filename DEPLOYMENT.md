# Deployment Guide

> **Last updated:** 2026-09-13

## Vercel Deployment

The frontend is deployed on Vercel from the `frontend/` directory.

The canonical production origin is `https://tryvit.app`. Cloudflare owns the
registration and authoritative DNS; application traffic points directly to
Vercel with DNS-only records. `https://www.tryvit.app` permanently redirects to
the apex domain. The `tryvit.vercel.app` deployment URL remains available as an
operational fallback, but must not be emitted as the canonical public origin.

### Vercel Project Settings

| Setting         | Value      |
| --------------- | ---------- |
| Root Directory  | `frontend` |
| Framework       | Next.js    |
| Build Command   | (auto)     |
| Install Command | `npm ci`   |
| Output Dir      | `.next`    |

### Production Release Control

`frontend/vercel.json` disables Git-triggered deployments for `main`; other
branches retain Vercel's default preview behavior. A production frontend release
must use an exact current-main SHA, build a Production-target artifact, deploy it
with `--skip-domain`, verify that exact deployment, and only then promote it as
documented in [Consumer promotion](docs/releases/CONSUMER_PROMOTION.md).

The checked-in guard expresses repository intent; it does not by itself prove
the provider honored the setting or that no competing deployment is queued.
Verify provider state at release time.

### Required Environment Variables

Set these in **Vercel > Project Settings > Environment Variables**:

| Key                             | Example Value                      |
| ------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...`  |
| `TRYVIT_PRIVATE_BETA_INVITE_ONLY` | `true`                           |
| `TRYVIT_SUPABASE_NATIVE_CAPTCHA_ENABLED` | `false`                     |
| `NEXT_PUBLIC_APP_URL`           | `https://tryvit.app`                |

### Private-beta admission

Private beta uses two independent, fail-closed controls:

1. Keep `TRYVIT_PRIVATE_BETA_INVITE_ONLY=true` in Vercel Production so
   `/auth/signup` renders only the invitation notice, Sign In, and recovery.
   Omission also fails closed to invitation-only.
2. In Supabase **Authentication → Sign In / Providers → User Signups**, turn
   **Allow new users to sign up** off. Keep the email provider enabled so
   existing and administratively provisioned users can sign in and recover
   passwords.

Do not use `supabase config push` to toggle the hosted setting: it pushes the
complete local Auth configuration rather than only the admission boundary.
Use the hosted dashboard or the Management API `PATCH
/v1/projects/{ref}/config/auth` with `{ "disable_signup": true }` through the
project's normal secret-managed operator path.

The source-retained self-service form sends its Turnstile token directly to
Supabase Auth exactly once. It remains dormant during private beta, and
`TRYVIT_SUPABASE_NATIVE_CAPTCHA_ENABLED` must remain `false`. Supabase's hosted
CAPTCHA switch also enforces CAPTCHA on password login and password recovery;
enabling it while only signup supplies a token would lock out existing users.
Before reopening public signup, first add and verify CAPTCHA-token handling on
every hosted Auth endpoint that the project chooses to protect, then enable the
hosted switch, verify the production hostname allowlist and first-use/replay
behavior, set the operator seal, set the invitation flag to `false`, and finally
re-enable hosted signup. Hosted Auth does not expose CAPTCHA configuration
through its public settings endpoint or expose an application action assertion;
`action=signup` remains client-side widget metadata rather than a TryVit server
authorization check.

The login page resolves email, Google, and `disable_signup` directly from
Supabase's public Auth settings. Malformed or unavailable state hides optional
social providers and keeps signup closed without disabling the required
email/password fallback. It never advertises a social provider that hosted Auth
has not enabled.
During private beta:

- keep global signup disabled;
- require invited users to accept and confirm their email before social login;
- enable Google only after a same-verified-email canary preserves the existing
  Supabase user ID and leaves the user count unchanged;
- keep Apple disabled in Supabase and absent from the release UI;
- do not replace this boundary with a Before User Created hook. That hook is
  appropriate only for a later allowlisted self-service model with global signup
  enabled.

Rollback to the safer state is the reverse: disable hosted signup first, then
restore or omit the Vercel flag so the invitation-only page is rendered.

These are public keys (embedded in the client bundle). The anon key only grants access allowed by RLS policies.

---

## Supabase Auth URL Configuration

**Critical:** Supabase must know your production domain for auth callbacks to work.

### Steps

1. Go to **Supabase Dashboard > Authentication > URL Configuration**
2. Set **Site URL** to your production domain:
   ```
   https://tryvit.app
   ```
3. Add **Redirect URLs** (at minimum):
   ```
   https://tryvit.app/auth/callback
   https://tryvit.app/auth/recovery/callback
   ```
4. Click **Save**

### Preview Deployments

For Vercel preview deployments, add a wildcard redirect URL matching your preview domain pattern:

```
https://*-<your-vercel-username>.vercel.app/auth/callback
https://*-<your-vercel-username>.vercel.app/auth/recovery/callback
```

Replace `<your-vercel-username>` with your actual Vercel account name and allowlist both callback paths.

> **Note:** Supabase supports wildcard subdomains in redirect URLs. This allows all Vercel preview deployments to use auth callbacks.

If wildcards aren't supported in your Supabase plan, add each preview domain individually as needed.

### Auth Flow

```
User signs up → Supabase sends confirmation email
  → User clicks link → /auth/callback (exchanges code for session)
  → Redirect to /app/search
  → App layout checks onboarding_complete
  → If false → /onboarding/region → /onboarding/preferences → /app/search

User requests password recovery → Supabase sends recovery email
  → User clicks link → /auth/recovery/callback (exchanges code for session)
  → Redirect to /auth/update-password
```

The normal OAuth/confirmation callback uses `/auth/callback`. Password recovery uses the fixed-purpose `/auth/recovery/callback` route so query input cannot select reset-password routing.

Post-login redirect validation happens in the **login form** (`LoginForm.tsx`): the `redirect` query parameter is validated to prevent open-redirect attacks — only relative paths starting with `/` are accepted, and `//` prefixes are blocked.

---

## Manifest-Bound Database Deployment

`.github/workflows/deploy.yml` is the single cloud schema-migration entrypoint.
It is manually dispatched from `main` and delegates to
`.github/workflows/database-deploy-reusable.yml`.

### Required Inputs

| Input                | Requirement |
| -------------------- | ----------- |
| `environment`        | `staging` or `production` |
| `source_sha`         | Exact current-main SHA selected by the dispatch |
| `migration_manifest` | Committed manifest containing the ordered migration paths and SHA-256 digests |
| `dry_run`            | Explicit `true` or `false` |
| `staging_run_id`     | Successful actual staging run for the same source and manifest; required for an actual production run |
| `recovery_receipt`   | Committed, current backup-restore receipt matching the manifest and recovery profile; required for an actual production run |

### Enforced Checks

The reusable driver fails closed unless the checkout and remote `main` both
equal `source_sha`, the actor has write-or-higher repository permission, staging
and production resolve to distinct expected projects, the native Supabase
production Git binding is disabled, and the remote pending migration list
exactly matches the committed manifest. An actual production run additionally
validates the matching staging run and recovery receipt.

Immediately before mutation, the driver rechecks current `main` and the native
production binding. It applies only the validated migration set, verifies that
no migrations remain, runs linked database lint, and uploads a sanitized
deployment receipt. It does **not** create or upload a database dump and does not
replace separately authorized post-deployment verification.

### How to Trigger a Deployment

1. Use a clean checkout of the exact current-main SHA.
2. Go to **GitHub → Actions → Deploy Database → Run workflow**.
3. Enter the exact inputs above; retain dry-run evidence before actual staging.
4. Apply and verify staging before production.
5. For production, provide the matching successful staging run and committed
   recovery receipt.

The workflow binds jobs to the `Staging` or `Production` GitHub Environment, but
reviewer and wait-timer rules are provider-side configuration. Verify them at
release time; their presence cannot be inferred from the workflow file.

All callers share a non-cancelling mutex per actual target. Never bypass a failed
manifest/evidence check with a direct cloud `supabase db push`.

### Retired Auto-Sync

`.github/workflows/sync-cloud-db.yml` is retained only as a compatibility notice.
It has no push trigger and its manual job always exits with an error without
mutating a database. Do not restore automatic merge-to-`main` database deployment.

### Recovery from Failed Deployment

If `deploy.yml` fails during an actual run:
1. Preserve the sanitized deployment receipt and workflow logs.
2. Determine whether any migration was applied from the remote ledger and the
   post-run dry-run evidence; do not infer atomic rollback.
3. Use the committed recovery evidence and the applicable restore procedure if
   data or schema recovery is required.
4. Fix the cause, create new reviewed evidence when required, and re-dispatch
   only from the then-current exact `main`.

See also: Issue #121 (Rollback Documentation) for detailed procedures.

---

## Custom Domain

1. Go to **Vercel > Project Settings > Domains**
2. Add your custom domain (e.g., `TryVit.example.com`)
3. Configure DNS per Vercel's instructions (CNAME or A record)
4. **Update Supabase Auth URLs** to match:
   - Site URL: `https://TryVit.example.com`
   - Redirect URLs: `https://TryVit.example.com/auth/callback` and `https://TryVit.example.com/auth/recovery/callback`
5. Keep the Vercel `.vercel.app` domain in Supabase redirect URLs as a fallback

---

## GitHub Actions CI

### Hosted-Data Boundary

Browser-facing PR, main, screenshot, quality, and Lighthouse jobs use the
checked-in loopback contract. Public runs are Supabase-independent; authenticated
runs use a guarded job-owned local emulator. They receive no hosted Supabase URL,
anon key, or service-role key and must fail closed rather than fall back to
staging or production.

Non-browser workflows have separate contracts. In particular, `deploy.yml`
inherits the Supabase project and database credentials required by the
manifest-bound driver, while Nightly's data-integrity job may use configured
hosted audit credentials. A green browser job therefore says nothing about a
hosted database target.

Treat the `${{ secrets.* }}` expressions in the current workflow files as the
name/scope authority. Never copy values into documentation, logs, artifacts, or
`NEXT_PUBLIC_` variables.

### CI Pipeline

The CI workflows use a tiered architecture:

- **PR Gate** (`.github/workflows/pr-gate.yml`): Typecheck + Lint → Unit tests + Build (parallel) → Playwright smoke E2E
- **Main Gate** (`.github/workflows/main-gate.yml`): Full build + tests + coverage → Full Playwright E2E → SonarCloud (blocking) → Sentry sourcemaps
- **Nightly** (`.github/workflows/nightly.yml`): Full Playwright (all projects incl. visual) + Data Integrity Audit

### Preview → Staging Wiring

Vercel preview deployments are wired to the **staging** Supabase project:

| Vercel Environment | Supabase Target | `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| ------------------ | --------------- | -------------------------- | ------------------------------- |
| Preview            | Staging         | Staging URL                | Staging anon key                |
| Production         | Production      | Production URL             | Production anon key             |

Vercel environment records and a deployment's build-time binding are separate
evidence. Verify the Preview URL and anon-key records by direct provider readback,
then verify a fresh deployment's effective public project reference before any
authorized hosted test. `vercel env run` is not accepted as remote-value proof
because local dotenv and process values can overlay the remote environment.

Routine browser CI does not run against Vercel Preview and there is no
`STAGING_ENABLED` switch. Any remote preview smoke is a separate release action
with explicit target and fixture authorization.

### Running CI Locally

```bash
cd frontend
npm ci
npm run type-check    # TypeScript check
npm run lint          # ESLint
npm run build         # Production build
npx playwright test   # E2E tests (auto-starts dev server via webServer config)
```

---

## Supabase Plan & PITR

| Item               | Value                                                               |
| ------------------ | ------------------------------------------------------------------- |
| Plan tier          | **Free** (verified 2026-02-22 via Supabase Dashboard > Billing)     |
| PITR availability  | **Not available** — PITR requires the Pro plan ($25/month)          |
| Daily auto-backups | Yes (Free tier: last 7 days, no PITR, no point-in-time granularity) |
| Backup granularity | Daily snapshot only — no sub-day recovery                           |

> **Implication:** Because there is no PITR, a bad migration could lose all data written since the last daily snapshot. The `BACKUP.ps1` pre-deployment dump is the primary safety net.

---

## Backup Procedures

> These procedures support recovery and the separately guarded `RUN_REMOTE.ps1`
> data-pipeline path. They are not the database migration entrypoint.
> An actual production migration dispatch requires a committed recovery receipt;
> `deploy.yml` does not create a backup on demand.

### Pre-Deployment Backup (automatic)

`RUN_REMOTE.ps1` automatically calls `BACKUP.ps1 -Env remote` before executing any SQL pipelines. If the backup fails, deployment is **aborted**.

To skip the backup in an emergency:

```powershell
.\RUN_REMOTE.ps1 -SkipBackup -Force
```

> **Warning:** Skipping the backup removes your safety net. Only do this if the backup itself is broken and you have another recovery path.

### On-Demand Backup

```powershell
# Remote (production)
.\BACKUP.ps1 -Env remote

# Local (Docker)
.\BACKUP.ps1 -Env local
```

Produces: `backups/cloud_backup_YYYYMMDD_HHmmss.dump` (compressed custom format)

**Prerequisites:**
- `pg_dump` and `psql` on PATH
- Remote: `SUPABASE_DB_PASSWORD` environment variable (or interactive prompt)
- Local: Docker Desktop + Supabase running (`supabase start`)

### User Data Export

```powershell
.\scripts\export_user_data.ps1 -Env remote
```

Exports 8 user tables to `backups/user_data_YYYYMMDD_HHmmss.json`:
- `user_preferences`, `user_health_profiles`, `user_product_lists`, `user_product_list_items`
- `user_comparisons`, `user_saved_searches`, `scan_history`, `product_submissions`

---

## Restore Procedures

### Restore from `.dump` File

```powershell
# Full database restore (drops and recreates objects)
pg_restore --no-owner --no-privileges --clean --if-exists -d postgres backups/cloud_backup_YYYYMMDD_HHmmss.dump
```

For remote restore, set the connection via environment:

```powershell
$env:PGPASSWORD = "your-password"
pg_restore --no-owner --no-privileges --clean --if-exists `
  -h aws-1-eu-west-1.pooler.supabase.com `
  -p 5432 `
  -U "postgres.uskvezwftkkudvksmken" `
  -d postgres `
  backups/cloud_backup_YYYYMMDD_HHmmss.dump
```

### Restore from User Data JSON

```powershell
.\scripts\import_user_data.ps1 -Env local -File backups\user_data_YYYYMMDD_HHmmss.json
.\scripts\import_user_data.ps1 -Env remote -File backups\user_data_YYYYMMDD_HHmmss.json
```

Import uses `ON CONFLICT DO UPDATE` (upsert) — safe to run multiple times.

### Post-Restore Validation

After any restore, run the full validation suite:

1. **Sanity checks** — `.\RUN_SANITY.ps1 -Env production` (17 checks pass)
2. **QA checks** — `.\RUN_QA.ps1` (all suites pass)
3. **Row counts** — verify user table row counts match pre-backup values
4. **Frontend smoke** — load a product detail page and verify data displays correctly

---

## Estimated Backup Metrics (current scale)

| Metric          | Approximate Value |
| --------------- | ----------------- |
| Total products  | ~1,279            |
| Database size   | ~50–100 MB        |
| Dump file size  | ~10–30 MB         |
| Backup duration | ~10–30 seconds    |
| User data JSON  | < 1 MB            |

These will grow as more products and users are added.

---

## Pre-Deployment Checklist

Before running `RUN_REMOTE.ps1` against production:

1. **On `main` branch** — must be on `main` (script enforces this)
2. **All CI checks pass** — `tsc --noEmit`, lint, build, Vitest, Playwright
3. **QA checks pass locally** — `.\RUN_QA.ps1` with local Supabase
4. **Backup runs successfully** — automatic via `RUN_REMOTE.ps1`, or manual `.\BACKUP.ps1 -Env remote`
5. **Review the execution plan** — `.\RUN_REMOTE.ps1 -DryRun` to see which files will execute
6. **Confirm interactively** — type `YES` when prompted (or use `-Force` for CI)

---

## Rollback Procedures

> **Golden rule:** Always take a backup before attempting any fix. If the database is accessible, run `.\BACKUP.ps1 -Env remote` *first*.

### Scenario 1: Bad Migration Applied (DDL error)

A migration was successfully applied but introduced a schema error — e.g., dropped a column, altered a constraint incorrectly, or created a conflicting index.

**Steps:**

1. **Identify the bad migration:**
   ```sql
   SELECT version, name, statements FROM supabase_migrations.schema_migrations
   ORDER BY version DESC LIMIT 5;
   ```

2. **Take a current backup** (if DB is still accessible):
   ```powershell
   .\BACKUP.ps1 -Env remote
   ```

3. **Write a compensating migration** — a new migration that undoes the damage. Example:
   ```sql
   -- ═══════════════════════════════════════════════════════════════════════════
   -- Migration: Fix accidental column drop from migration YYYYMMDD_HHMMSS
   -- Rollback: This migration itself is forward-only; manual DROP if needed
   -- ═══════════════════════════════════════════════════════════════════════════
   BEGIN;

   -- Re-create the accidentally dropped column
   ALTER TABLE products ADD COLUMN IF NOT EXISTS product_name text;

   -- Restore data from backup if needed (backfill from last known-good dump)
   -- UPDATE products SET product_name = b.product_name
   -- FROM backup_products b WHERE products.id = b.id;

   -- Restore any constraints
   -- ALTER TABLE products ALTER COLUMN product_name SET NOT NULL;

   COMMIT;
   ```

4. **Save the compensating migration** to `supabase/migrations/` with the next timestamp.

5. **Apply:**
   ```powershell
   # Local test first
   supabase db push --local
   .\RUN_QA.ps1

   # Then commit the migration and manifest, merge reviewed source, and use
   # deploy.yml for staging before production with the required evidence.
   ```

6. **Verify:**
   ```powershell
   .\RUN_SANITY.ps1 -Env production   # all current checks pass
   .\RUN_QA.ps1                        # all current checks pass
   ```

7. **Document the incident** — write a post-mortem within 24 hours.

### Scenario 2: Full Database Restore from Backup

The database is corrupted or data integrity is compromised beyond compensating migration repair. Requires full restore from the latest `.dump` file.

**Steps:**

1. **Locate latest backup:**
   ```powershell
   Get-ChildItem backups/*.dump | Sort-Object LastWriteTime -Descending | Select-Object -First 5
   ```
   Also check GitHub Actions artifacts from `deploy.yml` runs (30-day retention).

2. **Verify backup integrity:**
   ```bash
   pg_restore --list backups/cloud_backup_YYYYMMDD_HHmmss.dump | head -20
   ```
   If this prints a table of contents, the file is valid. If it errors, the dump is corrupt — try an older backup.

3. **Take a snapshot of the current (broken) state** (if accessible):
   ```powershell
   .\BACKUP.ps1 -Env remote   # Save as evidence for post-mortem
   ```

4. **Restore the backup:**
   ```powershell
   $env:PGPASSWORD = "your-password"
   pg_restore --no-owner --no-privileges --clean --if-exists `
     -h aws-1-eu-west-1.pooler.supabase.com `
     -p 5432 `
     -U "postgres.uskvezwftkkudvksmken" `
     -d postgres `
     backups/cloud_backup_YYYYMMDD_HHmmss.dump
   ```

   **Flags explained:**
   - `--clean --if-exists` — drops objects before recreating (safe even if objects don't exist)
   - `--no-owner --no-privileges` — avoids permission errors on Supabase managed roles

5. **Re-apply migrations newer than the backup** (if any):
   ```bash
   # Check which migrations are recorded in the restored DB
   psql -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;"
   # Manually apply any missing migrations after the backup timestamp
   ```

6. **Verify:**
   ```powershell
   .\RUN_SANITY.ps1 -Env production   # 17 checks pass
   .\RUN_QA.ps1                        # 724 checks pass
   ```

7. **Verify product count:**
   ```sql
   SELECT COUNT(*) FROM products WHERE is_deprecated IS NOT TRUE;
   -- Expected: ≥ 1,279
   ```

8. **Spot-check the frontend** — load a product detail page and verify data displays correctly.

### Scenario 3: User Data Restore Only

User-facing data (preferences, lists, scan history) was lost or corrupted, but the schema and product data are intact.

**Steps:**

1. **Locate the user data export:**
   ```powershell
   Get-ChildItem backups/user_data_*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 5
   ```
   If no export exists, create one from the backup dump manually.

2. **Import user data:**
   ```powershell
   .\scripts\import_user_data.ps1 -Env remote -File backups\user_data_YYYYMMDD_HHmmss.json
   ```
   Uses `ON CONFLICT DO UPDATE` (upsert) — safe to run multiple times. FK dependency order is handled automatically.

3. **Verify user table row counts:**
   ```sql
   SELECT 'user_preferences' AS tbl, COUNT(*) FROM user_preferences
   UNION ALL SELECT 'user_health_profiles', COUNT(*) FROM user_health_profiles
   UNION ALL SELECT 'user_product_lists', COUNT(*) FROM user_product_lists
   UNION ALL SELECT 'user_product_list_items', COUNT(*) FROM user_product_list_items
   UNION ALL SELECT 'user_comparisons', COUNT(*) FROM user_comparisons
   UNION ALL SELECT 'user_saved_searches', COUNT(*) FROM user_saved_searches
   UNION ALL SELECT 'scan_history', COUNT(*) FROM scan_history
   UNION ALL SELECT 'product_submissions', COUNT(*) FROM product_submissions;
   ```

4. **Verify auth still works** — log in with a test account, view preferences, check saved lists.

### Scenario 4: Vercel Frontend Rollback

A bad frontend deployment was pushed — the site is broken, shows errors, or has a critical UX regression.

**Steps:**

1. Go to **Vercel Dashboard → Project → Deployments**
2. Find the last known-good deployment (green checkmark before the bad one)
3. Click **"..."** → **"Promote to Production"**
4. Wait ~30 seconds for the rollback to propagate
5. **Verify:**
   - Home page loads (`/`)
   - Search works (`/app/search`)
   - Product detail page renders data (`/app/product/[id]`)
   - Normal auth callback works (`/auth/callback`)
   - Password-recovery callback fails closed or reaches the reset flow (`/auth/recovery/callback`)
   - Health endpoint returns 200 (`/api/health`)
6. If the rollback needs to stay in place, revert the bad commit on `main` to
   restore source history. A push to `main` does not itself deploy; stage, verify,
   and promote the intended production artifact through the controlled path.

### Scenario 5: Partial Failure (Migration Succeeded, Data Corrupt)

A migration applied successfully but introduced data corruption — e.g., an UPDATE with incorrect WHERE clause, a bad DEFAULT value, or a trigger that modified existing rows.

**Steps:**

1. **Assess the damage:**
   ```powershell
   .\RUN_QA.ps1   # Check which suites fail — this identifies affected data
   ```

2. **If damage is limited** (a few rows affected):
   - Write a compensating SQL script to fix the data
   - Apply and verify with QA

3. **If damage is widespread** (many tables/rows affected):
   - Follow **Scenario 2** (full restore from backup)

4. **If data was deleted irreversibly:**
   - Restore from backup (Scenario 2)
   - Accept data loss between backup time and incident time
   - Document the gap in the post-mortem

---

## Emergency Checklist

> Copy-paste this into your incident channel (Slack/Discord/Teams) when a production incident occurs.
> For the full incident response process (severity classification, escalation ladder, runbooks, post-mortem template), see [docs/INCIDENT_RESPONSE.md](docs/INCIDENT_RESPONSE.md).

```markdown
## 🚨 Production Incident — [DATE] [TIME UTC]

**Reported by:** @name
**Severity:** P1 / P2 / P3
**Impact:** [Describe what users are experiencing]

### Immediate Actions
- [ ] Stop any in-progress deployments (cancel GitHub Actions run on deploy.yml)
- [ ] Check managed-provider/native deployment activity and keep the Supabase production Git binding disabled; the retired `sync-cloud-db.yml` must not be restored
- [ ] Take a current backup if DB is accessible: `.\BACKUP.ps1 -Env remote`
- [ ] Export user data if schema is intact: `.\scripts\export_user_data.ps1 -Env remote`

### Investigation
- [ ] Identify root cause (check: migration logs, Supabase dashboard logs, Vercel deployment logs)
- [ ] Identify scope — which tables/data/features are affected
- [ ] Check `supabase_migrations.schema_migrations` for recently applied migrations

### Recovery
- [ ] Choose restore scenario (1–5 from DEPLOYMENT.md Rollback Procedures)
- [ ] Execute restore with a second person verifying each step
- [ ] Run `.\RUN_SANITY.ps1 -Env production` — all 17 checks pass
- [ ] Run `.\RUN_QA.ps1` against production data — all 724 checks pass
- [ ] Verify frontend loads correctly (home, search, product detail, auth)
- [ ] Verify `/api/health` returns 200

### Communication
- [ ] Notify stakeholders of impact and ETA
- [ ] Update status page (if applicable)
- [ ] Write post-mortem within 24 hours

### Post-mortem Template
- **Timeline:** When was the incident detected? When was it resolved?
- **Root cause:** What exactly went wrong?
- **Impact:** How many users were affected? For how long?
- **Recovery:** What steps were taken? How long did recovery take?
- **Prevention:** What changes will prevent recurrence?
```

---

## Break-Glass: Emergency Database Access

If normal tooling fails (Supabase CLI, scripts), use direct `psql` access:

```powershell
# Set credentials
$env:PGPASSWORD = "your-db-password"

# Direct connection (bypasses CLI, bypasses pooler)
psql -h db.uskvezwftkkudvksmken.supabase.co `
     -p 5432 `
     -U postgres `
     -d postgres
```

**When to use break-glass:**
- Supabase CLI is down or unresponsive
- GitHub Actions is not available
- `RUN_REMOTE.ps1` or `BACKUP.ps1` are failing for script-level reasons
- You need to run a manual SQL fix immediately

**Security note:** Direct database access bypasses all application-level security. Use only during incidents. Log all manual SQL commands for the post-mortem.

---

## Disaster Recovery Drill

> **Frequency:** Run this drill at least once per quarter, and after every time the backup or restore scripts change.
> **Last drill:** 2026-02-23 | **Next scheduled:** 2026-05-23
> **Full report:** [`docs/DISASTER_DRILL_REPORT.md`](docs/DISASTER_DRILL_REPORT.md)

### Automated Drill (recommended)

The DR drill is fully automated via `RUN_DR_DRILL.ps1`, which runs 6 scenarios:

| Scenario | Description                  | TTR Target | Recovery Method                     |
| -------- | ---------------------------- | ---------- | ----------------------------------- |
| A        | Bad Migration (column drop)  | < 5 min    | SAVEPOINT/ROLLBACK                  |
| B        | Table Truncation (data loss) | < 5 min    | SAVEPOINT/ROLLBACK                  |
| C        | Full Backup Restore          | < 30 min   | pg_restore / supabase db reset      |
| D        | User Data Restore            | < 5 min    | SAVEPOINT/ROLLBACK or import script |
| E        | Frontend Deployment Rollback | < 5 min    | Vercel "Promote to Production"      |
| F        | API Endpoint Failure         | < 10 min   | Compensating migration              |

```powershell
# Run all scenarios against local Supabase
.\RUN_DR_DRILL.ps1 -Env local

# Run a specific scenario
.\RUN_DR_DRILL.ps1 -Env local -Scenario A

# Skip full restore (quick validation)
.\RUN_DR_DRILL.ps1 -Env local -SkipRestore

# JSON output for CI integration
.\RUN_DR_DRILL.ps1 -Env local -Json -OutFile dr-results.json

# Run against staging
.\RUN_DR_DRILL.ps1 -Env staging
```

**Prerequisites:**
- Docker Desktop running + `supabase start` (local mode)
- `psql`, `pg_dump`, `pg_restore` on PATH
- At least one backup file in `backups/`
- For staging: `SUPABASE_STAGING_DB_PASSWORD` environment variable

**Drill scripts:** `supabase/dr-drill/` directory contains per-scenario SQL files and post-drill verification queries.

### Manual Drill: Local Full Restore

For a manual walkthrough (useful for training or when automation cannot run):

```powershell
# 1. Create backup of healthy local DB
.\BACKUP.ps1 -Env local

# 2. Verify backup exists
Get-ChildItem backups/local_backup*.dump | Sort-Object LastWriteTime -Descending | Select-Object -First 1

# 3. Apply destructive migration to simulate disaster
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "ALTER TABLE products DROP COLUMN product_name;"

# 4. Confirm QA detects the breakage
.\RUN_QA.ps1
# Expected: multiple suite failures (product_name referenced in views, queries, API contract)

# 5. Restore from backup
pg_restore --clean --if-exists --no-owner --no-privileges `
  -h 127.0.0.1 -p 54322 -U postgres -d postgres `
  backups/local_backup_YYYYMMDD_HHmmss.dump

# Alternative: full reset (reapplies all migrations from scratch)
supabase db reset

# 6. Verify recovery
.\RUN_SANITY.ps1          # 17 checks pass
.\RUN_QA.ps1              # 724 checks pass
```

### Expected TTR by Recovery Method

| Recovery Method             | TTR       | Data Loss         | When to Use                              |
| --------------------------- | --------- | ----------------- | ---------------------------------------- |
| **SAVEPOINT/ROLLBACK**      | < 100 ms  | Zero              | Failure caught within active transaction |
| **Compensating migration**  | 5–30 min  | Varies            | Schema error committed, data intact      |
| **User data import (JSON)** | < 2 min   | Since last export | User data loss, schema intact            |
| **Full backup restore**     | 10–30 min | Since last backup | Widespread corruption                    |
| **supabase db reset**       | < 30 sec  | All user data     | Local dev only                           |
| **Vercel Promote**          | ~30 sec   | Zero              | Frontend deployment broken               |

### Record Your Results

```markdown
### Drill #N — [Date]
- **Operator:** @name
- **Environment:** local / staging
- **Scenario(s) run:** A, B, C, D, E, F
- **All scenarios passed:** yes / no
- **Total TTR (worst scenario):** ___
- **All QA checks passed after restore:** yes / no
- **Issues encountered:** ___
- **Lessons learned:** ___
```

### Key Lessons from Drill Design

- `pg_restore --clean` on a running DB with active connections requires `--if-exists` to avoid errors on missing objects
- Always verify backup integrity (`pg_restore --list`) before relying on it for restore
- `TRUNCATE CASCADE` cascades to 3+ dependent tables — verify ALL dependent tables after recovery
- QA suite catches column drops immediately — sanity + QA provides comprehensive post-restore validation
- The compensating migration approach (Scenario 1) is preferred over full restore when the issue is isolated to schema changes
- SAVEPOINT/ROLLBACK provides near-instant recovery (< 100 ms) but requires the failure to be caught within a transaction

