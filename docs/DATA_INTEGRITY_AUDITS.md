# Production Data Integrity Audit

> **Last updated:** 2026-09-13
> **Status:** Configured in PR #1369; first separate scheduled run unproven
> **Owner issue:** [#184](https://github.com/ericsocrat/tryvit/issues/184)

> A production audit whose GitHub Actions workflow is schedule-only. It detects
> data quality issues, contradictions, and integrity violations across the
> production catalog.

## Overview

The Production Data Integrity Audit runner implements 8 categories of SQL-based
checks against the fixed production Supabase database, classifies findings by
severity, stores full findings in the protected database for historical tracking,
and publishes only a count-only CI summary. Raw production findings and runner
output are removed before artifact upload. PR #1369 configures it separately from the secret-free Nightly browser
workflow; no separate scheduled outcome is claimed here.

## Architecture

```
┌──────────────────────────────────────┐
│  GitHub Actions (schedule only)      │
│  Daily at 03:30 UTC                  │
│  ┌────────────────────────────────┐  │
│  │  run_data_audit.py             │  │
│  │  ├─ Calls run_full_data_audit  │  │
│  │  ├─ Stores in audit_results    │  │
│  │  └─ Generates private report   │  │
│  └────────────────────────────────┘  │
│           │                          │
│           ▼                          │
│  exact count-only redaction          │
│  └── summary.json                    │
│           │                          │
│           ▼                          │
│  Public-safe CI summary artifact     │
│  (90-day retention)                  │
└──────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  Supabase                            │
│  ├─ 8 audit SQL functions            │
│  ├─ run_full_data_audit() master     │
│  └─ audit_results table              │
│     (historical trend log)           │
└──────────────────────────────────────┘
```

## Audit Categories

### 1. Score-Band Contradictions (`audit_score_band_contradictions`)

| Severity | Check                                              |
| -------- | -------------------------------------------------- |
| Critical | A-labelled product with `unhealthiness_score > 50` |
| Critical | E-labelled product with `unhealthiness_score < 30` |

Flags products where the Nutri-Score label (from OFF) wildly contradicts the platform's own unhealthiness score. These independent scoring systems should broadly agree.

### 2. Impossible Nutritional Values (`audit_impossible_values`)

| Severity | Check                                                |
| -------- | ---------------------------------------------------- |
| Critical | Negative calories                                    |
| Critical | Salt > 100g per 100g                                 |
| Warning  | Protein + Fat + Carbs > 105g per 100g (5% tolerance) |
| Critical | `unhealthiness_score` outside 1–100 range            |
| Warning  | Negative protein, fat, carbs, or fibre               |

### 3. Required Field Completeness (`audit_missing_required_fields`)

| Severity | Check                                            |
| -------- | ------------------------------------------------ |
| Warning  | Products with scores but no ingredients linked   |
| Critical | Products without names                           |
| Warning  | Products with missing or invalid EAN (< 8 chars) |

### 4. Foreign Key Integrity (`audit_orphan_records`)

| Severity | Check                                                 |
| -------- | ----------------------------------------------------- |
| Critical | `product_allergen_info` rows with no matching product |
| Warning  | `product_ingredient` rows with no matching product    |

Note: These should be prevented by `ON DELETE CASCADE` constraints, but belt-and-suspenders auditing catches edge cases.

### 5. Materialized View Staleness (`audit_mv_staleness`)

| Severity | Check                                         |
| -------- | --------------------------------------------- |
| Warning  | `mv_ingredient_frequency` not analyzed in 24h |
| Warning  | `mv_product_similarity` not analyzed in 24h   |

### 6. Duplicate EAN Detection (`audit_duplicate_eans`)

| Severity | Check                                  |
| -------- | -------------------------------------- |
| Critical | Same EAN barcode on 2+ active products |

### 7. Band Consistency (`audit_band_consistency`)

| Severity | Check                                                          |
| -------- | -------------------------------------------------------------- |
| Warning  | Nutri-Score label and unhealthiness_score disagree by ≥2 bands |

Maps `unhealthiness_score` to expected bands (≤20→A, ≤40→B, ≤60→C, ≤80→D, >80→E) and compares against `nutri_score_label`. Flags only when the disagreement spans 2+ bands.

### 8. Category Consistency (`audit_category_consistency`)

| Severity | Check                                                  |
| -------- | ------------------------------------------------------ |
| Warning  | Products with NULL or empty category                   |
| Info     | Categories with < 3 products (possible import failure) |

## Severity Levels

| Level        | Meaning                                      | CI Impact             |
| ------------ | -------------------------------------------- | --------------------- |
| **Critical** | User safety or data integrity risk           | Exit code 1, CI fails |
| **Warning**  | Data quality issue, no immediate safety risk | Logged, no CI failure |
| **Info**     | Cosmetic or minor — FYI only                 | Logged, no CI failure |

## Running the Audit

### Manual (local)

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"
python run_data_audit.py
```

Schedule-only describes the GitHub Actions trigger; local runner use requires
separate explicit production authority.

### GitHub Actions schedule

No GitHub Actions manual trigger exists by design. Once present on the default
branch, `.github/workflows/data-audit.yml` is configured to run daily at
**03:30 UTC** from default-branch source. No separate scheduled outcome is
claimed here.

## Local report format

Direct, separately authorized local execution produces the detailed format
below. The hosted workflow never uploads it: it retains full findings in the
protected `audit_results` table, validates an exact four-count summary contract,
deletes the raw report and captured output, and uploads only that summary.

```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-01T03:30:05.123456+00:00",
  "summary": {
    "total_findings": 12,
    "critical": 2,
    "warnings": 7,
    "info": 3
  },
  "findings": [
    {
      "check_name": "duplicate_ean",
      "severity": "critical",
      "product_id": 42,
      "product_name": "Example Product",
      "ean": "5901234123457",
      "details": {
        "count": 2,
        "product_ids": [42, 87],
        "categories": ["dairy", "drinks"]
      }
    }
  ]
}
```

## Historical Tracking

All findings are stored in the `audit_results` table:

```sql
SELECT severity, COUNT(*) AS cnt
FROM audit_results
WHERE run_timestamp > NOW() - INTERVAL '7 days'
GROUP BY severity
ORDER BY severity;
```

To check trend over time:

```sql
SELECT DATE(run_timestamp)   AS audit_date,
       COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
       COUNT(*) FILTER (WHERE severity = 'warning')  AS warnings,
       COUNT(*) FILTER (WHERE severity = 'info')     AS info
FROM audit_results
GROUP BY DATE(run_timestamp)
ORDER BY audit_date DESC
LIMIT 30;
```

## Environment Variables

| Variable               | Required | Used By | Description                         |
| ---------------------- | -------- | ------- | ----------------------------------- |
| `SUPABASE_URL`         | Yes      | Runner  | Supabase project URL                |
| `SUPABASE_SERVICE_KEY` | Yes      | Runner  | Service role key (bypasses RLS)     |
| `ALERT_WEBHOOK_URL`    | No       | CI      | Webhook for critical finding alerts |

## Security Considerations

- **Service key required**: Audit uses `SUPABASE_SERVICE_KEY` to bypass RLS. The workflow exposes it only to the fixed-target audit step; it must never appear in logs or reports.
- **SECURITY DEFINER**: All audit functions use `SECURITY DEFINER` with `SET search_path = public` to prevent path injection.
- **No user data in findings**: Detailed records may contain product IDs and EANs but must never join with user tables.
- **Public repository boundary**: Raw findings are not CI artifacts. Only validated aggregate counts are uploaded; authorized investigation uses the protected `audit_results` table.
- **Service role only**: All audit functions have `REVOKE EXECUTE ... FROM PUBLIC` — only `service_role` can call them.

## Remediation Workflow

1. **Check the Production Data Integrity Audit** in GitHub Actions → look at Step Summary
2. **Review the count-only artifact**, then use authorized database access for details
3. **Critical findings**: Create a remediation issue without copying sensitive or unnecessarily identifying details into the public repository
4. **Mark resolved**: Update `audit_results` with `resolved_at` and `resolved_by`

```sql
UPDATE audit_results
SET resolved_at = NOW(), resolved_by = 'your-username'
WHERE run_id = 'run-id-here'
  AND check_name = 'duplicate_ean';
```

## Rollback Plan

1. **SQL functions**: `DROP FUNCTION` for each of the 9 functions
2. **audit_results table**: `DROP TABLE audit_results CASCADE`
3. **CI workflow**: Delete `.github/workflows/data-audit.yml`
4. **Python script**: Remove `run_data_audit.py`
5. **Total rollback time**: < 10 minutes

## Files Changed

| File                                                           | Type     | Description                                             |
| -------------------------------------------------------------- | -------- | ------------------------------------------------------- |
| `supabase/migrations/20260222030000_data_integrity_audits.sql` | New      | 8 audit functions + master runner + audit_results table |
| `run_data_audit.py`                                            | New      | Python audit runner script                              |
| `.github/workflows/data-audit.yml`                             | New      | Schedule-only Production Data Integrity Audit workflow  |
| `.gitignore`                                                   | Modified | Added `audit-reports/`                                  |
| `docs/DATA_INTEGRITY_AUDITS.md`                                | New      | This documentation                                      |
