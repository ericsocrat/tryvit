# TryVit — Viewing & Testing Guide

> **Last broadly verified:** 2026-02-24
> **Phase 5A.0a browser-safety section updated:** 2026-08-01
> **Phase 5A.0d performance/visual-gate evidence updated:** 2026-08-03
> **Status:** Active
> **Owner issue:** Process domain

## Browser and visual-test safety

Run Playwright, screenshots, visual audits, and Lighthouse through the
Phase 5A.0a safety launchers documented in
[PHASE5A0A_LOCAL_VISUAL_TEST_SAFETY.md](PHASE5A0A_LOCAL_VISUAL_TEST_SAFETY.md).
Public runs receive no hosted Supabase configuration. Authenticated runs
require a verified local Supabase emulator and never fall back to staging or
production. The checked-in `supabase/config.toml` is authoritative for local
ports. The launcher requires Node.js with built-in environment-proxy support:
22.21 or newer in the Node 22 line, 24.5 or newer in the Node 24 line, or Node
25 or newer. Node 23 and unsupported patch versions fail closed.

Use only the owned safety entry points for browser work:

```powershell
# From the repository root
.\RUN_PR_SCREENSHOTS.ps1 -Mode Public
.\RUN_SCREENSHOTS.ps1 -Mode Public
.\RUN_SCREENSHOTS.ps1 -Mode LocalAuthenticated # verified emulator required
```

```text
# From frontend/
npm run test:e2e:smoke
npm run quality:smoke
npm run lighthouse:mobile
```

Do not start or reuse a developer server for these commands and do not invoke
Playwright or Lighthouse directly. The launchers own the clean build, server,
browser proxy, provenance checks, final safety assertion, and cleanup.

Quality Gate and Nightly provision a reduced, job-owned local Supabase runtime
for their authenticated stages. Phase 5A.0d keeps local Realtime enabled for
the existing feature-flag subscription; unrelated local services remain
excluded. Checked-in migrations run during local startup; the guarded fixture
launcher then creates only the deterministic browser-test catalog. Runtime
output and credentials are never printed or uploaded, and the runtime is
stopped without a backup in unconditional cleanup. Public results must still
never be described as authenticated coverage.

Quality Gate intentionally contains no Lighthouse execution. The separate
guarded Phase 5A.0d workflow owns the authoritative five-run public and
local-authenticated Mobile and Desktop matrix documented in
[PHASE5A0D_PERFORMANCE_VISUAL_GATES.md](PHASE5A0D_PERFORMANCE_VISUAL_GATES.md).
The historical `/auth/login` scores of `0.66`, `0.69`, and `0.64` are retained
as evidence of the corrected desktop measurement-contract defect, not as a
current pass or current gate result. The exact-head Linux login desktop median
is `0.99`; real authenticated-mobile performance and product-detail
accessibility debt remain blocking. The reviewed `aa84b2bd…` evidence recorded
all five mobile performance distributions as statistically inconclusive under
the preserved `0.10` range limit; instability is intentionally classified per
exact-head rerun rather than treated as a fixed product score. Product-detail
mobile also exceeds the `900 KiB` cold-transfer direction in both reviewed
Linux runs.

## 🔍 How to View Your Data

### Option 1: Supabase Studio (Web UI) — **RECOMMENDED**

The **easiest way** to browse your tables visually:

1. **Open Studio**: http://127.0.0.1:55003
2. **Navigate**: Click **"Table Editor"** in left sidebar
3. **Explore tables**:
   - `products` — 1,025 active products across 20 categories (variable size per category)
   - `nutrition_facts` — nutritional data per 100g
   - `product_allergen_info` — allergen/trace declarations (unified table)
4. **Run custom queries**: Click **"SQL Editor"** → paste any SQL → click **Run**

**Pro tip**: Click on `v_master` view for a denormalized "master report" with all data joined.

---

### Option 2: Command-Line Queries

For quick terminal queries, use:

```powershell
# View top 10 unhealthiest products
echo "SELECT product_name, brand, unhealthiness_score, nutri_score_label FROM v_master ORDER BY unhealthiness_score::int DESC LIMIT 10;" | docker exec -i supabase_db_tryvit psql -U postgres -d postgres

# View all chips
echo "SELECT * FROM v_master WHERE category='Chips' ORDER BY unhealthiness_score::int DESC;" | docker exec -i supabase_db_tryvit psql -U postgres -d postgres -x

# View all żabka products
echo "SELECT * FROM v_master WHERE category='Żabka' ORDER BY unhealthiness_score::int DESC;" | docker exec -i supabase_db_tryvit psql -U postgres -d postgres -x

# View all cereals
echo "SELECT * FROM v_master WHERE category='Cereals' ORDER BY unhealthiness_score::int DESC;" | docker exec -i supabase_db_tryvit psql -U postgres -d postgres -x

# View all drinks
echo "SELECT * FROM v_master WHERE category='Drinks' ORDER BY unhealthiness_score::int DESC;" | docker exec -i supabase_db_tryvit psql -U postgres -d postgres -x

# View all dairy
echo "SELECT * FROM v_master WHERE category='Dairy' ORDER BY unhealthiness_score::int DESC;" | docker exec -i supabase_db_tryvit psql -U postgres -d postgres -x

# Count by category
echo "SELECT category, COUNT(*) FROM products WHERE is_deprecated IS NOT TRUE GROUP BY category;" | docker exec -i supabase_db_tryvit psql -U postgres -d postgres
```

---

## ✅ How to Know Everything Is Working

### 1. **Data Integrity Tests** (29 checks)
Validates foreign keys, nulls, duplicates, orphaned rows, nutrition sanity, provenance:

```powershell
Get-Content "db\qa\QA__null_checks.sql" | docker exec -i supabase_db_tryvit psql -U postgres -d postgres --tuples-only
```

**Expected output**: Empty (zero violation rows) = ✅ PASS

---

### 2. **Scoring Formula Tests** (27 checks)
Validates v3.2 algorithm correctness, flag logic, NOVA consistency, regression checks:

```powershell
Get-Content "db\qa\QA__scoring_formula_tests.sql" | docker exec -i supabase_db_tryvit psql -U postgres -d postgres --tuples-only
```

**Expected output**: Empty (zero violation rows) = ✅ PASS

---

### 3. **Automated Pipeline Test** (All-in-One)
Run all pipelines + QA suites automatically:

```powershell
.\RUN_LOCAL.ps1 -RunQA
```

**Expected output**:
```
================================================
  Execution Summary
================================================
  Succeeded:  70
  Failed:     0
  Duration:   ~10s

================================================
  Running QA Checks
================================================
  All QA checks passed (784/784 — zero violation rows).

  Database inventory:
  active_products | deprecated | nutrition | categories
-----------------+------------+-----------+------------
            1025 |         38 |      1032 |         20
```

---

### 4. **Standalone QA Runner** (Recommended)
Runs the full current QA suite set with color-coded output:

```powershell
.\RUN_QA.ps1
```

**Expected output**:
```
✓ ALL TESTS PASSED (784/784 checks)
```

---

### 5. **Negative Validation Tests** (destructive-intent validation)
Verifies the database correctly rejects invalid data:

```powershell
.\RUN_NEGATIVE_TESTS.ps1
```

**Expected output**: final success line like `✓ ALL ... checks correctly detected violations` with `0` missed checks.

---

### 6. **Known Regression Tests** (Embedded in scoring formula suite)

- **Top Chips Faliste** (palm oil, 16g sat fat) → Score: **51±2**
- **Naleśniki z jabłkami** (healthiest żabka) → Score: **17±2**
- **Melvit Płatki Owsiane Górskie** (whole oats, NOVA 1) → Score: **11±2**
- **Coca-Cola Zero** (zero sugar, high additives) → Score: **8±2**
- **Piątnica Skyr Naturalny** (healthiest dairy) → Score: **9±2**
- **Mestemacher Pumpernikiel** (traditional rye) → Score: **17±2**
- **Tarczyński Kabanosy Klasyczne** (high-fat cured meat) → Score: **55±2**
- **Knorr Nudle Pomidorowe Pikantne** (instant noodle, palm oil) → Score: **21±2**

If these products' scores drift outside expected ranges, the tests will flag it.

---

## 📊 Pre-Built Reports

### Master View Query
Get everything in one denormalized view:

```sql
SELECT * FROM v_master
ORDER BY unhealthiness_score::int DESC;
```

**Columns available** (47 columns):
- **Identity**: `product_id`, `country`, `brand`, `product_name`, `category`, `product_type`, `ean`
- **Qualitative**: `prep_method`, `store_availability`, `controversies`
- **Scores**: `unhealthiness_score`, `confidence`, `data_completeness_pct`, `score_breakdown` (JSONB)
- **Labels**: `nutri_score_label`, `nova_classification`, `processing_risk` (derived from NOVA)
- **Flags**: `high_salt_flag`, `high_sugar_flag`, `high_sat_fat_flag`, `high_additive_load`
- **Nutrition (per 100g)**: `calories`, `total_fat_g`, `saturated_fat_g`, `trans_fat_g`, `carbs_g`, `sugars_g`, `fibre_g`, `protein_g`, `salt_g`
- **Ingredients**: `additives_count`, `ingredients_raw`, `ingredient_count`, `additive_names`, `ingredient_concern_score`, `has_palm_oil`
- **Dietary**: `vegan_status`, `vegetarian_status`
- **Allergens**: `allergen_count`, `allergen_tags`, `trace_count`, `trace_tags`
- **Source**: `source_type`, `source_url`, `source_ean`
- **Data quality**: `ingredient_data_quality`, `nutrition_data_quality`

---

## 🚀 Quick Start Workflow

1. **Start Supabase** (if not already running):
   ```powershell
   supabase start
   ```

2. **Open Studio UI**: http://127.0.0.1:55003

3. **Run pipelines** (if data changed):
   ```powershell
   .\RUN_LOCAL.ps1 -RunQA
   ```

4. **Explore data visually** in Studio → Table Editor

5. **Run custom analysis** in Studio → SQL Editor

---

## 🔍 Cross-Product Analytics

### Ingredient Frequency
```sql
-- Most common ingredients across all products
SELECT name_en, product_count, usage_pct, concern_tier
FROM mv_ingredient_frequency ORDER BY product_count DESC LIMIT 20;

-- High-concern ingredients and where they appear
SELECT name_en, product_count, concern_tier, categories
FROM mv_ingredient_frequency WHERE concern_tier >= 2
ORDER BY product_count DESC;
```

### Product Similarity
```sql
-- Find 5 products most similar to product #42 by ingredient overlap
SELECT * FROM find_similar_products(42);

-- Find 10 similar products
SELECT * FROM find_similar_products(42, 10);
```

### Better Alternatives
```sql
-- Find healthier alternatives in the same category
SELECT * FROM find_better_alternatives(42);

-- Find healthier alternatives across ALL categories
SELECT * FROM find_better_alternatives(42, false);

-- Find top 10 healthier alternatives
SELECT * FROM find_better_alternatives(42, true, 10);
```

### Score Breakdown
```sql
-- See how a product's score was computed
SELECT product_name, unhealthiness_score,
       score_breakdown->'factors' AS factors
FROM v_master WHERE product_id = 42;
```

---

## 🔗 Useful URLs (Local Dev)

| Service                           | URL                                                       |
| --------------------------------- | --------------------------------------------------------- |
| **Supabase Studio** (Database UI) | http://127.0.0.1:55003                                    |
| **REST API**                      | http://127.0.0.1:55001/rest/v1                            |
| **GraphQL API**                   | http://127.0.0.1:55001/graphql/v1                         |
| **Direct Postgres**               | `postgresql://postgres:postgres@127.0.0.1:55002/postgres` |

---

## 📝 Notes

- **All data is local** — nothing is uploaded to remote Supabase unless you explicitly push it
- **Pipelines are idempotent** — safe to run repeatedly
- **QA tests run in seconds** — should be zero violations
- **Test after every schema change** — ensures scoring formula integrity
