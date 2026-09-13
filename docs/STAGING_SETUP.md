# Staging Setup Guide

> **Status: ACTIVE — deployment controls verified 2026-09-13.** The staging
> project already exists. `sync-cloud-db.yml` is retired and always fails without
> mutation; current migrations use the manually dispatched, exact-main,
> manifest-bound `deploy.yml` workflow.
>
> Follow the steps below to create the Supabase staging project and configure
> secrets. See [ENVIRONMENT_STRATEGY.md](ENVIRONMENT_STRATEGY.md) §8.1 for context.

---

> Step-by-step instructions to create and configure the Staging Supabase project.

---

## Prerequisites

- Supabase account with ability to create projects
- Supabase CLI installed (`npx supabase --version`)
- `psql` available on PATH
- GitHub repository admin access (for secrets)
- Vercel project admin access (for environment variables)

---

## Step 1: Create the Staging Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **New project**
3. Settings:
   - **Name:** `tryvit-staging`
   - **Database Password:** Generate a strong password — save it securely
   - **Region:** Same as production (to minimize latency differences)
   - **Plan:** Free tier is sufficient for staging
4. Note the **Project Reference** (e.g., `abcdef123456`)

---

## Step 2: Apply Migrations

For the current staging project, do not relink a development checkout and push
directly. From a clean exact-main checkout:

1. Commit a manifest containing the exact expected migration paths and SHA-256
   digests.
2. Dispatch **Deploy Database** with `environment=staging`, that exact
   `source_sha`, the manifest path, and `dry_run=true`.
3. Review the dry-run receipt, then dispatch the same source and manifest with
   `dry_run=false`.
4. Preserve the successful staging receipt for any later production run.

For a replacement staging project, prepare and review a manifest covering its
exact expected baseline rather than using an unbounded `--include-all` push.

---

## Step 3: Seed Data

```powershell
# Set staging credentials in .env
# SUPABASE_STAGING_PROJECT_REF=<staging-ref>
# SUPABASE_STAGING_DB_PASSWORD=<password>

# Run the unified seed script
.\RUN_SEED.ps1 -Env staging
```

This will:
1. Apply reference data (country_ref, category_ref, etc.)
2. Run all 21 category pipelines (~1,025+ products)
3. Apply CI post-pipeline fixup
4. Refresh materialized views

---

## Step 4: Validate with Sanity Checks

```powershell
.\RUN_SANITY.ps1 -Env staging
```

All current checks should pass. Fix any failure before proceeding.

---

## Step 5: Configure Auth

In the Staging Supabase Dashboard → **Authentication → URL Configuration**:

1. **Site URL:** `https://<your-staging-domain>.vercel.app` (or a Vercel preview URL)
2. **Redirect URLs:**
   - `https://<your-staging-domain>.vercel.app/auth/callback`
   - `https://<your-staging-domain>.vercel.app/auth/recovery/callback`
   - `https://*-ericsocrat.vercel.app/auth/callback` (wildcard for PR previews)
   - `https://*-ericsocrat.vercel.app/auth/recovery/callback` (wildcard for PR previews)
   - `http://localhost:3000/auth/callback` (for local development pointing at staging)
   - `http://localhost:3000/auth/recovery/callback` (for local development pointing at staging)

---

## Step 6: Store Secrets

### GitHub Repository Secrets

The workflow files are authoritative for names and scope. The staging database
driver requires the following through inherited GitHub secrets:

| Secret                         | Purpose |
| ------------------------------ | ------- |
| `SUPABASE_ACCESS_TOKEN`        | Supabase CLI and native-binding verification |
| `SUPABASE_PROJECT_REF`         | Production reference used to enforce distinct target bindings |
| `SUPABASE_STAGING_PROJECT_REF` | Staging project reference |
| `SUPABASE_STAGING_DB_PASSWORD` | Staging database access for the manifest-bound driver |

There is no `STAGING_ENABLED` switch. Browser-facing CI must not receive any
hosted Supabase URL, anon key, or service-role key.

### Vercel Preview Environment

Go to **Vercel → Project Settings → Environment Variables**:

1. Set `NEXT_PUBLIC_SUPABASE_URL` for **Preview** environment to the staging URL
2. Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` for **Preview** environment to the staging anon key

> **Important:** Do NOT override the Production environment variables.

Verify the separate Preview records by direct provider readback, then verify a
fresh deployment's effective public project reference. Do not use
`vercel env run` as proof of the remote values because local dotenv and process
values can overlay them.

### Local `.env`

Add to your `.env` file (git-ignored):

```dotenv
SUPABASE_STAGING_PROJECT_REF=<staging-ref>
SUPABASE_STAGING_DB_PASSWORD=<password>
```

---

## Step 7: Verify E2E

Routine browser verification uses the checked-in loopback safety contract:
public runs are Supabase-independent and authenticated runs use the guarded
job-owned local emulator. Do not inject hosted staging credentials into the
standard Playwright entrypoint.

A hosted Preview smoke is a separate release action. Run it only after direct
environment-record readback, fresh-deployment binding verification, deployment
protection, and explicit fixture/mutation authorization.

---

## Step 8: Verify CI Isolation

Confirm the browser-facing workflows pass no hosted Supabase URL, anon key, or
service-role key and that authenticated projects start and stop the local
emulator. Missing local tooling or failed readiness must block authenticated
coverage instead of selecting a hosted fallback.

---

## Maintenance

### Applying New Migrations to Staging

After merging reviewed migration source, dispatch `deploy.yml` from the exact
current-main SHA with the committed manifest. Retain dry-run evidence, perform
the actual staging dispatch, preserve its receipt, and run the separately
authorized staging verification. Never fall back to a direct cloud
`supabase db push` after a driver refusal.

### Re-seeding Staging

If staging data drifts (e.g., after testing):

```powershell
.\RUN_SEED.ps1 -Env staging
.\RUN_SANITY.ps1 -Env staging
```

### Comparing Staging vs Production Schema

```powershell
# Link to staging and capture schema
npx supabase link --project-ref <staging-ref>
npx supabase db diff --schema public > staging_diff.sql

# Link to production and capture schema
npx supabase link --project-ref uskvezwftkkudvksmken
npx supabase db diff --schema public > prod_diff.sql

# Compare (should be identical if both are up-to-date)
```
