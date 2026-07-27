# Data-quality report and CI gate

> **Last updated:** 2026-07-28
> **Status:** Active
> **Owner issue:** Phase 3 repository audit

`data_quality_report.py` is the canonical evidence-producing data gate for the
deterministic PostgreSQL fixture used by `.github/workflows/qa.yml`. It is
separate from `run_data_audit.py`, whose existing purpose is a credentialed,
nightly Supabase integrity audit.

## Grain and semantics

The report uses one active product as its base grain. Global, country, and
category results are all aggregated from the same ordered product facts, so
their product counts reconcile. It reuses `v_product_confidence` and
`mv_scoring_distribution`; it checks `v_data_coverage_summary` against source
rows and fails if that view is missing or stale.

Core nutrition means the seven non-null fields required by the product-detail
API contract: calories, total fat, saturated fat, carbohydrate, sugars,
protein, and salt. Fibre and trans fat are nullable in that contract.
Impossible nutrition values follow the existing QA rules: negatives, core
macronutrients over 100 g, salt over 40 g, calories over 900 kcal, saturated
fat above total fat, sugars above carbohydrates, or total fat + carbohydrate +
protein over 105 g per 100 g.

The allergen schema stores positive `contains` and `traces` declarations only.
It has no assessment-complete flag and no explicit “no known allergens” state.
The report therefore labels those two metrics unavailable and treats a product
with no declaration as unknown. It never converts absence into a safety claim.

Critical identity fields are `product_name`, `brand`, `category`, and
`country`: the product-detail API requires strings for all four. EAN is
reported separately because the same contract explicitly permits a null EAN.

## Thresholds and baseline

`data-quality/thresholds.json` is version controlled. Percentage rules express
regression tolerance in percentage points; count rules express absolute row
changes. Hard structural failures—zero active products, query errors, malformed
configuration/baselines, missing database objects, stale coverage/confidence
views, scoring-view mismatch, and unavailable configured metrics—cannot be
configured away.

The committed baseline comes only from the deterministic CI fixture. The first
fixture contained 8,552 active products, with 11.2% ingredient links, 8.1%
known-allergen declarations, 100.0% usable core nutrition, 99.9% valid EANs,
0.1% low-confidence products, and average confidence 61.6. Coverage floors are
one percentage point below those observed values; the 5% low-confidence ceiling
preserves the previous QA workflow policy. These are regression guardrails, not
claims that the enrichment level is sufficient for the product.

CI reads
it and never updates it. An intentional baseline update is explicit:

```powershell
python data_quality_report.py `
  --config data-quality/thresholds.json `
  --dataset-id deterministic-ci-qa-v1 `
  --environment ci `
  --generated-at 2026-07-28T00:00:00+00:00 `
  --update-baseline data-quality/baselines/ci-v1.json `
  --baseline-id deterministic-ci-v1 `
  --json-out data-quality-report.json `
  --markdown-out data-quality-report.md
```

Review the baseline diff like any other source change. Do not update it merely
to make CI pass. The initial hard targets are set from the deterministic
fixture and its existing QA constraints; no hosted Supabase or staging data is
used.

## Exit behavior

- Exit `0`: pass, including explicit warning-only findings.
- Exit `1`: hard threshold, baseline regression, structural/query, or
  configuration failure.

JSON is the versioned machine contract, with its top-level schema in
`data-quality/report.schema.json`. Markdown is rendered from the same report
object and is intended for artifacts and the GitHub Actions summary.
