# Product Positioning — TryVit

> **Last updated:** 2026-05-31
> **Status:** Active
> **Owner issue:** —

This document defines who TryVit is for, the problem it solves, what is explicitly
in and out of scope for the current MVP, and which assumptions remain unvalidated.
It is the canonical reference for product framing. For live project status see
[`../CURRENT_STATE.md`](../CURRENT_STATE.md).

---

## 1. One-line positioning

TryVit is a research-grade, multi-axis food health scoring platform for Poland and
Germany that makes every score **auditable** — exposing the factors, weights, and
data confidence behind each number instead of a single opaque grade.

---

## 2. Who it's for

| Audience                              | What they get                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Health-conscious shoppers (PL/DE)** | A clear, explainable health score per product, with the reasons behind it and how complete the data is. |
| **Nutrition researchers**             | Transparent, source-traceable scoring on 9 weighted factors plus Nutri-Score, NOVA, and confidence.     |
| **Data engineers / contributors**     | A reproducible, fully-tested PostgreSQL-first platform with idempotent pipelines and CI gates.          |

---

## 3. The problem

Mainstream food apps reduce nutrition to a single letter or a calorie count. That
hides *why* a product is rated the way it is, ignores processing level and additive
concerns, and gives no signal about how trustworthy the underlying data is.

TryVit's thesis: a health score is only useful if it is **explainable and
auditable**. Every factor, its weight, its ceiling, and the data confidence should
be visible.

---

## 4. What makes it different

- **Multi-axis, not single-grade** — unhealthiness (1–100), Nutri-Score, NOVA, and a data-confidence score are computed and shown independently.
- **9 weighted factors** — saturated fat, sugars, salt, calories, trans fat, additives, prep method, controversies, and EFSA ingredient-concern tiers, minus a nutrient-density bonus.
- **Confidence transparency** — every product carries a 0–100 completeness/confidence score.
- **Full explainability** — score breakdowns expose each factor's raw value, weight, and contribution.

---

## 5. MVP scope (in scope now)

- Poland (primary) and Germany (full parity) product catalogs.
- Scan / search / compare / score flows with per-factor explanations.
- Confidence scoring and data-provenance surfacing.
- Authenticated user features: preferences, health profiles, lists, comparisons, saved searches, scan history, submissions.

---

## 6. Explicit non-goals

TryVit is **not**, and the MVP does not attempt to be:

- A medical, clinical, or dietary-advice tool. It makes **no** treatment or diagnosis claims.
- A weight-loss program or calorie/macro tracker.
- A global product database — markets are limited to **PL and DE** today.
- A replacement for reading the legal product label. `product_name` and label text are treated as authoritative and never modified.
- A real-time price or availability tracker.

---

## 7. Unvalidated assumptions

These are documented as open questions, **not** established facts:

| Assumption                                             | Status      |
| ------------------------------------------------------ | ----------- |
| Monetization model (subscription, B2B data, affiliate) | Unvalidated |
| Target market size / willingness to pay                | Unvalidated |
| Demand for DE beyond PL                                | Unvalidated |
| Retention impact of confidence/explainability features | Unvalidated |

Update this table as assumptions are tested. Do not present any row as validated
without evidence.
