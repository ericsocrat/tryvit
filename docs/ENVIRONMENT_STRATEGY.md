# Environment Strategy — Phase 8

> **Last broadly verified:** 2026-02-22
> **Phase 5A.0a browser-safety section updated:** 2026-08-01
> **Deployment controls verified:** 2026-09-13
> **Status:** Active
> **Owner issue:** #13

---

## Decision: Two-Cloud Mode (Staging + Production)

We maintain two Supabase cloud projects:

- **Production:** `uskvezwftkkudvksmken` — live user-facing data.
- **Staging:** A separate project for pre-production validation, E2E mutation
  testing, and preview deployments.

**Implication:** Phase 8 focuses on:

1. Schema parity via migrations (no dashboard drift).
2. A repeatable seed / import pipeline to bring cloud data in line with the
   expected dataset.
3. Sanity checks + guardrails so CI / scripts cannot accidentally mutate or
   wipe the cloud DB.
4. Staging receives the exact manifest first through the manually dispatched
   `deploy.yml`; production requires matching staging and recovery evidence.

### 8.1 — Staging Supabase Project (Active)

| Field   | Value                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------- |
| Status  | **Active** — staging project created and wired into scripts + CI                                   |
| Setup   | Follow [STAGING_SETUP.md](STAGING_SETUP.md) for the step-by-step guide                             |
| Scripts | `RUN_REMOTE.ps1 -Env staging`, `RUN_SEED.ps1 -Env staging`, `RUN_SANITY.ps1 -Env staging` all work |

### 8.1A — Cloud Mode Guardrails (Required)

| #   | Task                                                                                                        | Status |
| --- | ----------------------------------------------------------------------------------------------------------- | ------ |
| 1   | All scripts targeting the cloud require explicit `-Env` parameter and refuse destructive actions by default | ✅      |
| 2   | Seed pipeline is idempotent — uses `ON CONFLICT DO UPDATE`, no accidental overwrite                         | ✅      |
| 3   | CI / E2E uses least-privileged keys and cannot perform destructive operations                               | ✅      |
| 4   | All schema changes remain migrations-only — no dashboard drift allowed                                      | ✅      |
| 5   | `RUN_REMOTE.ps1` requires mandatory `-Env staging` or `-Env production` (no default)                        | ✅      |
| 6   | `deploy.yml` enforces an exact-main, manifest-bound staging run before production                           | ✅      |

**Acceptance criteria:**

- Running seed / sanity is safe and repeatable against both cloud projects.
- No script / CI job can reset / drop / truncate production without an
  explicit override (`-Force` + `YES` confirmation + branch check).
- Staging receives the exact reviewed manifest before production; no merge or
  push automatically mutates either cloud database.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Environment Definitions](#2-environment-definitions)
3. [Data Strategy Decision](#3-data-strategy-decision)
4. [Schema Source of Truth](#4-schema-source-of-truth)
5. [Seed / Import Pipeline](#5-seed--import-pipeline)
6. [Vercel ↔ Supabase Mapping](#6-vercel--supabase-mapping)
7. [Secrets & Environment Variables](#7-secrets--environment-variables)
8. [CI / Preview E2E Guidelines](#8-ci--preview-e2e-guidelines)
9. [Deployment Checklists](#9-deployment-checklists)

---

## 1. Overview

This document defines the three-environment strategy for `tryvit`:

| Environment    | Purpose                   | Supabase                                      | Vercel                |
| -------------- | ------------------------- | --------------------------------------------- | --------------------- |
| **Local**      | Development & iteration   | Docker (`supabase start`)                     | Local Next.js runtime |
| **Staging**    | Pre-production validation | Cloud `<staging-ref>` (via env var)           | Preview deployments   |
| **Production** | Live user-facing app      | Cloud `uskvezwftkkudvksmken` (single project) | Production deployment |

> **Current status — two-cloud mode:** Local, Staging, and Production all exist.
> Staging is used for pre-production validation and preview deployments.
> See the [Staging Setup Guide](STAGING_SETUP.md) for initial setup instructions.

**Why environments matter (even in single-cloud mode):**

- Local Docker DB and cloud Supabase can drift (different extensions, IDs, auth config).
- CI validates against an ephemeral PostgreSQL 17 container — fast and safe.
- All cloud-mutating operations require explicit `-Env production` + confirmation.
- A staging layer will catch migration/data issues once real users arrive.

---

## 2. Environment Definitions

### 2.1 Local (Docker)

| Setting          | Value                                 |
| ---------------- | ------------------------------------- |
| Supabase CLI     | `supabase start`                      |
| DB host          | Read from `supabase/config.toml` (currently `127.0.0.1:55002`) |
| API URL          | Read from `supabase/config.toml` (currently `http://127.0.0.1:55001`) |
| Project ID       | `tryvit`                              |
| Docker container | `supabase_db_tryvit`                  |
| Data load        | `supabase db reset` → `RUN_LOCAL.ps1` |
| QA               | `RUN_QA.ps1`                          |

**Data contents:** Full PL dataset (~1,025 products, 20 categories) + DE micro-pilot (51 products). Fresh auto-increment IDs on every `supabase db reset`.

### 2.2 Staging (Cloud) — Active

> **Status:** Active. See [STAGING_SETUP.md](STAGING_SETUP.md) for setup.

| Setting          | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| Supabase project | `tryvit-staging` (ref via `SUPABASE_STAGING_PROJECT_REF`) |
| DB host          | `db.<staging-ref>.supabase.co:5432`                       |
| API URL          | `https://<staging-ref>.supabase.co`                       |
| Schema source    | Exact-main manifest applied through `deploy.yml`          |
| Data load        | `RUN_SEED.ps1 -Env staging`                               |

**Data contents:** Will mirror production — full PL dataset + DE micro-pilot.

### 2.3 Production (Cloud)

> All guardrails in §8.1A apply. Migrations go to staging first, then production.

| Setting          | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Supabase project | `uskvezwftkkudvksmken`                                                 |
| DB host          | `db.uskvezwftkkudvksmken.supabase.co:5432`                             |
| API URL          | `https://uskvezwftkkudvksmken.supabase.co`                             |
| Schema source    | Matching exact-main manifest applied through `deploy.yml`                 |
| Data load        | `RUN_SEED.ps1 -Env production` or `RUN_REMOTE.ps1` (both guarded)      |

**Data contents:** Full PL dataset + DE micro-pilot. Production IDs are persistent. User-generated data (`user_preferences`, `user_health_profiles`) exists only here and is **not reproducible** from the pipeline.

---

## 3. Data Strategy Decision

### Decision: **Option A — Full Dataset in All Environments**

Both Staging and Production contain the complete PL dataset (~1,025 products across 20 categories) plus the DE micro-pilot (51 chips products). This ensures:

1. **Immediate usefulness** — the app works identically in staging and production.
2. **Confidence in deployments** — QA checks, confidence thresholds, and scoring formulas are validated against the same data volume.
3. **Realistic E2E** — Playwright tests exercise real category listings, search results, and scoring.

### What each environment contains

| Data Layer              | Local       | Staging     | Production   |
| ----------------------- | ----------- | ----------- | ------------ |
| Reference tables        | ✅           | ✅           | ✅            |
| Products (PL + DE)      | ✅           | ✅           | ✅            |
| Nutrition facts         | ✅           | ✅           | ✅            |
| Ingredients & allergens | ✅           | ✅           | ✅            |
| Scoring & confidence    | ✅           | ✅           | ✅            |
| User preferences        | 🧪 test only | 🧪 test only | ✅ real users |
| User health profiles    | 🧪 test only | 🧪 test only | ✅ real users |

### Data that is **NOT** portable

- `user_preferences` and `user_health_profiles` — these contain real user data in production and test data in staging. They are **never** seeded from pipelines.
- Auto-increment `product_id` values differ between environments. All cross-environment references must use `(country, brand, product_name)` or `ean` as portable keys.

---

## 4. Schema Source of Truth

### Rule: Migrations are the ONLY schema source of truth

```
supabase/migrations/*.sql  →  THE schema definition
```

**Do NOT:**
- Edit schema via the Supabase Dashboard (Table Editor, SQL Editor, etc.)
- Apply ad-hoc `ALTER TABLE` or `CREATE INDEX` outside a migration file
- Use `supabase db diff` as the primary schema management tool

**Do:**
- Add a new `.sql` file under `supabase/migrations/` with the naming convention `YYYYMMDDHHMMSS_description.sql`
- Apply locally via `supabase db reset`
- Apply to staging/production only through the manifest-bound `deploy.yml`
  workflow, which invokes `supabase db push` after validating the exact pending set

### Verification

After every deployment, run the sanity check pack to verify schema expectations:

```powershell
.\RUN_SANITY.ps1 -Env staging   # Verify staging
.\RUN_SANITY.ps1 -Env production   # Verify production (read-only checks)
```

---

## 5. Seed / Import Pipeline

### Architecture

```
supabase/seed/
  README.md                     ← Usage documentation
  001_reference_data.sql        ← Reference tables (country_ref, category_ref, etc.)

db/pipelines/
  <category>/PIPELINE__*.sql    ← Full product dataset (existing)

scripts/
  RUN_SEED.ps1                  ← Unified seed runner with environment targeting
```

### Seed Execution Order

1. **Schema** — exact manifest applied through the guarded deployment workflow
2. **Reference data** — `supabase/seed/001_reference_data.sql`
3. **Product pipelines** — `db/pipelines/*/PIPELINE__*.sql` (all 21 categories)
4. **Post-pipeline fixup** — `db/ci_post_pipeline.sql`
5. **Materialized view refresh** — `refresh_all_materialized_views()`
6. **Sanity checks** — `RUN_SANITY.ps1 -Env <target>`

### Production Guard Rails (§8.1A)

The following guardrails ensure cloud projects cannot be accidentally
mutated or wiped:

#### Script-level guards (`RUN_SEED.ps1`, `RUN_REMOTE.ps1`)

- **Explicit `-Env staging` or `-Env production`** required — no script defaults to a cloud target
- **Interactive "YES" confirmation** — skipped only with `-Force`
- **Interactive "YES" confirmation** — skipped only with `-Force`
- **Branch check** — warns if not on `main` (production seeds should come from main)
- **Row count display** — shows existing product count before execution
- **Idempotent writes** — all pipelines use `ON CONFLICT DO UPDATE` (upsert), never blind `INSERT`

#### CI-level guards

- Browser-facing workflows and `qa.yml` do not connect to a hosted Supabase project; `qa.yml` uses an ephemeral PG17 container. Non-browser deployment and data-integrity workflows retain their separately governed hosted contracts.
- Browser-facing PR, main, quality, nightly, screenshot, and Lighthouse jobs receive no hosted Supabase configuration. Phase 5A.0c public runs are Supabase-independent and pass no Supabase URL, key, adapter, or adapter allowlist. Quality and Nightly create a reduced job-owned emulator for authenticated coverage, derive its port from checked-in configuration, seed through the guarded local fixture launcher, and remove its volumes without backup.
- Browser-facing and QA jobs never run `supabase db push`, `supabase db reset`,
  or cloud DDL. The manually dispatched, manifest-bound `deploy.yml` workflow is
  the sole cloud schema mutation path; `sync-cloud-db.yml` is a retired notice
  that always fails without mutation.
- Sanity checks (`RUN_SANITY.ps1`) are **read-only** `SELECT` queries

#### Schema drift prevention

- All schema changes go through `supabase/migrations/*.sql` files
- The manifest-bound driver is the only authorized cloud schema path; it invokes
  `supabase db push` only after validating the exact pending set
- Dashboard edits are prohibited — run `supabase db diff` periodically to detect drift

---

## 6. Vercel ↔ Supabase Mapping

> **Two-cloud mode:** Preview deployments point to the staging Supabase
> project. Production deployments point to the production project.

| Vercel Environment | Supabase Target | `NEXT_PUBLIC_SUPABASE_URL`                 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| ------------------ | --------------- | ------------------------------------------ | ------------------------------- |
| Preview            | Staging         | `https://<staging-ref>.supabase.co`        | Staging anon key                |
| Production         | Production      | `https://uskvezwftkkudvksmken.supabase.co` | Production anon key             |

### Vercel Configuration

In the Vercel project settings, set environment variables **per environment**:

1. **Production environment:** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to production values.
2. **Preview environment:** Set the same variables to staging values.
3. **Development environment:** Not applicable (developers use `.env.local` pointing to local Docker).

Provider environment records and an existing deployment's build-time bindings
are separate evidence. Verify records by direct provider readback and verify a
fresh deployment's effective public project reference before hosted testing.
Do not use `vercel env run` as remote-value proof because local dotenv and
process values can overlay the selected remote environment.

### Auth Redirect URLs

In both Staging and Production Supabase projects, configure:

- **Site URL:** The corresponding Vercel domain
- **Redirect URLs:**
  - Production: `https://<production-domain>/auth/callback` and `https://<production-domain>/auth/recovery/callback`
  - Staging: both callback paths on `https://<staging-domain>` plus both Vercel preview wildcards (`https://*-ericsocrat.vercel.app/auth/callback` and `https://*-ericsocrat.vercel.app/auth/recovery/callback`)

---

## 7. Secrets & Environment Variables

### GitHub Repository Secrets

The workflow files are authoritative for secret names and scopes. The database
driver consumes `SUPABASE_ACCESS_TOKEN`, distinct production/staging project
references, `SUPABASE_DB_PASSWORD` for production, and
`SUPABASE_STAGING_DB_PASSWORD` for staging through inherited GitHub secrets.
Browser-facing workflows receive no hosted Supabase URL, anon key, or
service-role key. Other non-browser jobs, including the Nightly data-integrity
audit, retain their separately governed hosted contracts.

### Local `.env` File

```dotenv
# Remote Supabase database password (used by RUN_REMOTE.ps1 and RUN_SEED.ps1)
SUPABASE_DB_PASSWORD=

# Remote Supabase project reference (for supabase link)
SUPABASE_PROJECT_REF=

# Staging Supabase project reference (for supabase link --project-ref)
SUPABASE_STAGING_PROJECT_REF=

# Staging database password
SUPABASE_STAGING_DB_PASSWORD=
```

---

## 8. CI / Preview E2E Guidelines

### Current CI Architecture

| Workflow | Backend | Purpose | Hosted mutation boundary |
| -------- | ------- | ------- | ------------------------ |
| `qa.yml` | Ephemeral PostgreSQL container | Schema, pipeline, QA, and sanity verification | Container only |
| Browser-facing gates | Supabase-independent public contract or guarded local emulator | Build, Playwright, screenshots, and Lighthouse | Hosted browser configuration is rejected |
| `deploy.yml` | Explicit staging or production Supabase project | Manual exact-main, manifest-bound migrations | Sole cloud schema mutation path |
| `sync-cloud-db.yml` | None | Retired compatibility notice | Always fails without mutation |

### E2E Safety Rules

1. **Public browser CI is secret-free** — it receives no hosted URL, anon key, or service-role key.
2. **No browser-facing or QA job targets cloud with DDL** — cloud schema changes remain isolated to the separately governed deployment workflow.
3. **Local authenticated isolation** — fixture users may be created and cleaned up only after the checked-in local emulator origin and readiness response pass the Phase 5A.0a guard.
4. **Read-only sanity checks** — Only `SELECT`-based sanity checks may run against production from CI.
5. **No hosted fallback** — missing local emulator tooling or credentials blocks authenticated browser coverage instead of switching to staging or production.

Quality Gate and Nightly start and tear down the guarded local emulator for their
authenticated browser coverage. Missing local tooling, an invalid loopback
origin, or failed readiness remains a blocker; no hosted fallback is permitted.

See [PHASE5A0A_LOCAL_VISUAL_TEST_SAFETY.md](PHASE5A0A_LOCAL_VISUAL_TEST_SAFETY.md) for the executable browser/fixture contract. Phase 5A.0c makes the public path Supabase-independent; local-authenticated coverage continues to use only the guarded job-owned emulator.

---

## 9. Deployment Checklists

### New Migration Deployment

```
1. ☐ Develop and verify the migration locally with the current QA entrypoints
2. ☐ Commit an ordered manifest with exact migration SHA-256 digests
3. ☐ Merge reviewed source only after required CI passes
4. ☐ Record the exact current-main SHA from a clean checkout
5. ☐ Dispatch deploy.yml dry-run for staging with that SHA and manifest
6. ☐ Dispatch the actual staging run and preserve its successful receipt
7. ☐ Produce a fresh committed recovery receipt for the same manifest/profile
8. ☐ Dispatch production with the matching source, manifest, staging run, and recovery receipt
9. ☐ Verify the resulting production database before staging/promoting the frontend artifact
```

### Data Pipeline Update

```
1. ☐ Regenerate pipeline SQL (python -m pipeline.run --category ...)
2. ☐ Run RUN_LOCAL.ps1 -Category <name>
3. ☐ Run RUN_QA.ps1 — all checks pass
4. ☐ Push to branch → CI green
5. ☐ Merge to main
6. ☐ Seed production: RUN_SEED.ps1 -Env production -Category <name>
   (or RUN_REMOTE.ps1 -Env production -Category <name>)
7. ☐ Run RUN_SANITY.ps1 -Env production
```

### New Environment Setup (from scratch)

```
1. ☐ Create Supabase project in dashboard
2. ☐ Configure the reviewed project binding and required provider secrets
3. ☐ Commit a manifest for the exact expected migration set and use deploy.yml
4. ☐ RUN_SEED.ps1 -Env <target> (loads reference data + full dataset)
5. ☐ RUN_SANITY.ps1 -Env <target> (validates everything)
6. ☐ Configure auth redirect URLs in Supabase dashboard
7. ☐ Set environment variables in Vercel (if applicable)
8. ☐ Run Playwright E2E against the new environment
```

---

## §10 Known Limitations & Future Improvements

### 10.1 PITR (Point-in-Time Recovery)

The plan/PITR snapshot last checked in 2026-02 is not current authority. Verify
the production project's current entitlement in the provider before relying on
managed recovery. Repository-controlled mitigations are:

- An actual production `deploy.yml` run requires a committed, validated
  backup-restore receipt for the same migration manifest and recovery profile.
- The workflow artifact is a sanitized deployment receipt, not a database dump.
- `BACKUP.ps1` provides manual backup capability.

**Recommendation:** Reverify the current hosted backup/PITR entitlement before
relying on it. Retain tested recovery evidence and separately protected database
backups appropriate to the release risk.

### 10.2 Staging Data Freshness

`sync-cloud-db.yml` is retired and performs no synchronization. The manual
manifest-bound schema workflow also does not copy product data between projects.
Verify staging data fitness for the intended test instead of assuming parity
from schema deployment.

**To seed staging with product data:**

```powershell
$env:SUPABASE_DB_PASSWORD = "<staging-db-password>"
supabase link --project-ref rxtaicdpnaqigowdbmsb
.\RUN_REMOTE.ps1 -Env staging
```

**Recommendation:** Consider a periodic (weekly/monthly) staging data refresh workflow — either manual or automated via a scheduled GitHub Action — to keep staging representative of production for E2E and QA testing.

### 10.3 CODEOWNERS for Production Deployments

Currently, any maintainer can trigger `deploy.yml` (manual dispatch). As the team grows, consider adding a `CODEOWNERS` file to require explicit approval from designated reviewers for:

- `supabase/migrations/**` — schema changes
- `.github/workflows/deploy.yml` — deployment workflow modifications
- `supabase/functions/**` — Edge Function changes

This provides an additional review gate beyond the existing CI checks.

### 10.4 Backup Archival & Long-Term Retention

Sanitized deployment receipts are retained by the workflow for 30 days. Database
dumps are not generated by `deploy.yml`. For long-term compliance or disaster
recovery:

- Consider quarterly archival of database dumps to external storage (e.g., S3, GCS, or Azure Blob).
- Document retention requirements in `docs/PRIVACY_CHECKLIST.md` if GDPR mandates specific data retention periods for backups.
