# Health-Goal Personalization — Design Spec

> **Last updated:** 2026-03-16
> **Status:** Draft — planning deliverable, not yet implemented
> **Owner issue:** [#892](https://github.com/ericsocrat/tryvit/issues/892)
> **Depends on:** #887 (onboarding cleanup — completed)
> **Scope:** Design-only — no schema, API, frontend, or threshold changes

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Goal Taxonomy](#2-goal-taxonomy)
3. [Personalization Model Comparison](#3-personalization-model-comparison)
4. [Recommended Model](#4-recommended-model)
5. [API & Surface Impact](#5-api--surface-impact)
6. [Copy & Safety Guidelines](#6-copy--safety-guidelines)
7. [Privacy & Data Minimization](#7-privacy--data-minimization)
8. [MVP Scope Definition](#8-mvp-scope-definition)
9. [Phased Implementation Plan](#9-phased-implementation-plan)
10. [Follow-Up Issues](#10-follow-up-issues)

---

## 1. Current State Assessment

### 1.1 What Exists

| Component | Status | Detail |
|---|---|---|
| `user_health_profiles` table | ✅ Exists | 7 conditions, 4 numeric thresholds, single-active trigger, full RLS |
| Auto-profile from onboarding | ✅ Works | `api_complete_onboarding()` maps goals → conditions + preset thresholds |
| Frontend health goals (post-#887) | ✅ 3 goals | `diabetes`, `low_sodium`, `heart_health` in `HEALTH_GOALS` constant |
| `api_better_alternatives_v2()` | ⚠️ Partial | Accepts `p_health_profile_id`, loads thresholds — **but does not filter by them** |
| `api_score_explanation()` | ❌ Static | No user/profile parameter; warnings are per-product only |
| `api_product_detail()` | ❌ Static | No health-profile awareness |
| `api_category_listing()` | ❌ Static | No health-profile filtering |
| Product flags | ❌ Static | `high_sugar_flag`, `high_salt_flag`, `high_sat_fat_flag` are per-product constants, not user-relative |
| GDPR Art. 9 consent | ❌ Missing | No `consent_given_at` column; no explicit consent capture flow |
| Design docs | ❌ No section | Neither `DESIGN_REFRESH_SPEC.md` nor `UX_UI_DESIGN.md` cover health personalization |

### 1.2 What Was Removed (PR #898, Issue #887)

| Goal | Why Removed | Status |
|---|---|---|
| `weight_management` | No downstream mapping to any condition or threshold; no API consumed it; misleading medical-adjacent language | ❌ Correctly removed |
| `general_wellness` | No mapping — selected it did nothing; generic label with no concrete scoring or filtering behaviour | ❌ Correctly removed |

Both goals were dead ends: they appeared in the onboarding UI but produced no profile, no threshold, no personalized experience downstream. Their removal was correct and should not be reversed without a concrete model.

### 1.3 What Is Wired End-to-End

Only the onboarding → profile-creation path is fully wired:

```
User selects goals in onboarding (HealthGoalsStep.tsx)
  → api_complete_onboarding() maps goals to conditions + thresholds
    → INSERT INTO user_health_profiles (profile_name='Onboarding Profile', is_active=true)
```

**After that point, there is no downstream consumer.** The profile sits in the database, unused by any read-path API function. This is the core gap that #892 addresses at the design level.

### 1.4 Health Profile Schema Reference

| Column | Type | Purpose |
|---|---|---|
| `profile_id` | uuid PK | Unique identifier |
| `user_id` | uuid FK | Owner (RLS-enforced) |
| `profile_name` | text NOT NULL | User-visible label |
| `is_active` | boolean | Single-active constraint (trigger-enforced) |
| `health_conditions` | text[] | Allowed: `diabetes`, `hypertension`, `heart_disease`, `celiac_disease`, `gout`, `kidney_disease`, `ibs` |
| `max_sugar_g` | numeric(6,2) | Per-100g sugar threshold (NULL = no limit) |
| `max_salt_g` | numeric(6,3) | Per-100g salt threshold (NULL = no limit) |
| `max_saturated_fat_g` | numeric(6,2) | Per-100g sat-fat threshold (NULL = no limit) |
| `max_calories_kcal` | numeric(7,1) | Per-100g calorie threshold (NULL = no limit) |
| `notes` | text | Optional user notes |

### 1.5 Auto-Profile Mappings

| Onboarding Goal | → Health Condition | → Threshold | Rationale |
|---|---|---|---|
| `diabetes` | `diabetes` | `max_sugar_g = 25` | WHO: <10% energy ≈ 50g/day; 25g/100g is half daily budget |
| `low_sodium` | `hypertension` | `max_salt_g = 1.5` | EU "high salt" label threshold; WHO: <5g salt/day |
| `heart_health` | `heart_disease` | `max_saturated_fat_g = 16` | EFSA DRV: <10% energy ≈ 20g/day; 16g/100g is generous |

### 1.6 Flag System (Static)

| Flag | Product-Level Threshold | Set By |
|---|---|---|
| `high_sugar_flag = 'YES'` | sugars ≥ 5.0 g/100g | `score_category()` |
| `high_salt_flag = 'YES'` | salt ≥ 1.5 g/100g | `score_category()` |
| `high_sat_fat_flag = 'YES'` | saturated_fat ≥ threshold | `score_category()` |

These flags are **product properties**, not user-relative. They exist regardless of whether any user has a health profile.

---

## 2. Goal Taxonomy

### 2.1 Three-Tier Classification

This spec draws a hard line between three fundamentally different types of health-related user input. Every goal that TryVit supports or might support must be classified into exactly one tier.

#### Tier 1 — Condition-Driven Safety Profiles

**Definition:** The user has (or wants to monitor for) a diagnosed medical condition that creates measurable, per-nutrient safety thresholds.

| Goal | Condition | Concrete Threshold | Evidence |
|---|---|---|---|
| `diabetes` | Diabetes | sugar ≤ 25 g/100g | WHO free-sugar guidance |
| `low_sodium` | Hypertension | salt ≤ 1.5 g/100g | EU "high salt" regulation |
| `heart_health` | Heart disease | sat fat ≤ 16 g/100g | EFSA dietary reference values |

**What makes Tier 1 distinct:**
- The goal maps to a **specific nutrient ceiling** that can be checked against `nutrition_facts` per product.
- The downstream action is unambiguous: warn when a product exceeds the threshold, filter alternatives accordingly.
- The language must be careful (see §6) but the mechanism is straightforward.

**Status in TryVit:** All three exist in onboarding, map to auto-profile thresholds, and are correctly wired through `api_complete_onboarding()`.

#### Tier 2 — Goal-Driven Preference Layers

**Definition:** The user has a lifestyle aspiration that does not map to a single nutrient threshold but could influence how results are ranked, filtered, or highlighted.

| Candidate Goal | What It Might Mean | Concrete Mechanism | Problem |
|---|---|---|---|
| `weight_management` | Prefer lower-calorie products? Lower-fat? Higher-protein? | Unclear — could mean any combination | No single threshold; requires a preference *profile* not a threshold |
| `avoid_additives` | Prefer products with fewer additives | `additive_count` or `concern_tier` filters | Already partially modelled via `p_max_concern_tier` in `find_better_alternatives_v2()` |
| `high_protein` | Prefer higher-protein products | Sort/filter by `protein_g` | Not a safety concern; pure preference |
| `low_calorie` | Prefer lower-calorie products | Sort/filter by `calories_kcal` | Could use `max_calories_kcal` threshold on profile |

**What makes Tier 2 distinct:**
- No single nutrient threshold captures the intent.
- The downstream action is a **preference**, not a safety warning.
- Language is simpler (no medical connotation) but the mechanism is more complex.

**Status in TryVit:** `weight_management` was removed (#887). `avoid_additives` exists in `HEALTH_GOALS` constant as a selection option but has no profile threshold mapping — `api_complete_onboarding()` does not set any threshold for it. It is effectively a dead-end like the removed goals, but is still shown in the UI.

#### Tier 3 — Generic Wellness Signals

**Definition:** The user wants to "eat healthier" in a vague, non-specific way that does not map to any concrete nutrient, condition, or product filter.

| Candidate | Why It's Tier 3 |
|---|---|
| `general_wellness` | Means everything and nothing; no concrete downstream action |
| `eat_better` | Synonym for "use TryVit" — the entire app is this goal |
| `balanced_diet` | Not actionable at per-product granularity |

**What makes Tier 3 distinct:**
- Cannot be translated into any concrete filtering, ranking, or warning mechanism.
- Collecting it provides zero downstream value.
- Showing it in onboarding sets expectations the product cannot meet.

**Status in TryVit:** `general_wellness` was removed (#887). **It should stay removed.** No Tier 3 goal should be collected unless and until a concrete consumption mechanism exists.

### 2.2 Classification Decisions

| Goal | Tier | Decision | Reasoning |
|---|---|---|---|
| `diabetes` | 1 | **Keep** | Concrete threshold, clear mechanism, exists today |
| `low_sodium` | 1 | **Keep** | Concrete threshold, clear mechanism, exists today |
| `heart_health` | 1 | **Keep** | Concrete threshold, clear mechanism, exists today |
| `weight_management` | 2 | **Stay removed** | No single threshold model works; reintroduce only if a multi-factor preference system is built (see §9 Phase 3) |
| `general_wellness` | 3 | **Stay removed permanently** | No concrete mechanism possible; collecting it is misleading |
| `avoid_additives` | 2 | **Keep — but fix** | Currently dead-end; wire to `p_max_concern_tier` filter in alternatives API |
| `high_protein` | 2 | **Defer** | No urgency; could be a future sort preference |
| `low_calorie` | 2 | **Defer** | Could map to `max_calories_kcal` but unclear user demand |

### 2.3 Onboarding vs. Settings

| Goal | Where | Rationale |
|---|---|---|
| **Tier 1 (condition) goals** | Onboarding health-goals step + editable in Settings | Early selection creates the safety profile that shapes the user's first product interactions; must be changeable later |
| **Tier 2 (preference) goals** | Settings only | Not urgent enough for first-run; preferences are discovered through use, not onboarded |
| **Tier 3 (generic) goals** | Nowhere | Not collected |

**`avoid_additives` exception:** Currently shown in onboarding. Recommendation: **move to Settings** in a future pass. It is a preference, not a safety concern. For MVP, it can remain in onboarding if wiring it to `p_max_concern_tier` is deferred — but it must not stay as a dead-end indefinitely.

---

## 3. Personalization Model Comparison

### 3.1 Option A — Threshold-Based Filtering

**Mechanism:** Each health goal maps to a nutrient threshold stored on `user_health_profiles`. API functions accept the profile and filter/warn when products exceed thresholds.

| Pros | Cons |
|---|---|
| Simple, deterministic, explainable | Only works for Tier 1 goals with clear nutrient ceilings |
| Already partly built (`user_health_profiles` schema) | Cannot express "prefer high protein" or "avoid additives" |
| No scoring formula changes needed | Rigid — thresholds are per-100g, ignoring serving context |
| Easy to test: product exceeds threshold → warning | Limited to 4 nutrient dimensions (sugar, salt, sat fat, calories) |
| Privacy-friendly: minimal data stored | |

**Verdict:** ✅ **Best fit for MVP** — covers all Tier 1 goals with existing schema.

### 3.2 Option B — Weighted Emphasis (Re-Score Per User)

**Mechanism:** Each health goal adjusts the weights in `compute_unhealthiness_v33()` per user. A diabetes-focused user might see sugar weight increased from 0.17 to 0.25.

| Pros | Cons |
|---|---|
| Very personalized score | **Breaks scoring comparability** — users see different scores for same product |
| Feels meaningful to the user | Violates scoring philosophy: score is an objective property of the product |
| Could express Tier 2 preferences | Massive complexity: per-user scoring requires caching, MV rethink |
| | Difficult to explain: "why does my friend see a different score?" |
| | Scoring regression tests (§8.19) become per-profile |

**Verdict:** ❌ **Rejected.** Undermines trust — the TryVit Score must remain an objective, product-intrinsic metric. Personalization should augment what the user *sees* (warnings, filters, rankings), not change what the product *is* (its score).

### 3.3 Option C — Recommendation Filters (Pre-Query)

**Mechanism:** Health goals add WHERE clauses to API queries. A user with `low_sodium` sees category listings pre-filtered to exclude products above their salt threshold.

| Pros | Cons |
|---|---|
| Immediate visible impact — results change | Hides products silently — user may not know what they're missing |
| Simple to implement (WHERE clause) | "Filter bubble" problem — user cannot discover products outside their profile |
| Works well with `api_category_listing()` | Does not work for `api_product_detail()` (single-product view) |
| | Users expect to see all products, with relevant ones highlighted |

**Verdict:** ❌ **Rejected as primary model.** Hiding products is a poor UX pattern for a transparency-focused app. Could be offered as an opt-in "strict mode" toggle in a later phase.

### 3.4 Option D — Threshold Warnings + Highlight Layer (Hybrid)

**Mechanism:** Combine threshold-based warnings (Option A) with a UI highlight layer. Products are never hidden, but personal health warnings are overlaid on product detail, score explanation, and alternatives.

| Component | How It Works |
|---|---|
| **Product detail** | Show personalized warning badges: "Exceeds your sugar limit (25 g/100g)" alongside static product flags |
| **Score explanation** | Highlight the factors most relevant to the user's conditions; surface them first in the top-factors list |
| **Better alternatives** | Filter alternatives to respect user's thresholds (already stubbed in `api_better_alternatives_v2`) |
| **Category listing** | No filtering by default — but add optional `p_health_profile_id` for "show compliant products" toggle |
| **Dashboard** | Surface recently-viewed products that exceeded user's thresholds as "watch out" items |

| Pros | Cons |
|---|---|
| Never hides products — transparency preserved | More UI work than pure filtering |
| Warnings are concrete and actionable | Requires frontend to load active profile and pass it to APIs |
| Score stays objective; warnings are layered on top | Need careful copy (§6) to avoid medical-advice language |
| Naturally extends to Tier 2 preferences later | |
| Works with existing schema + minimal API changes | |
| Matches DESIGN_REFRESH_SPEC.md principle of "Trust Before Score" | |

**Verdict:** ✅ **Recommended.** See §4 for full specification.

### 3.5 Summary

| Option | Tier 1 | Tier 2 | Score Impact | Products Hidden | Recommendation |
|---|---|---|---|---|---|
| A. Threshold filtering | ✅ | ❌ | None | No | MVP foundation |
| B. Weighted re-scoring | ✅ | ✅ | **Yes** | No | ❌ Rejected |
| C. Pre-query filters | ✅ | Partial | None | **Yes** | ❌ Rejected |
| **D. Warnings + highlights** | **✅** | **Extensible** | **None** | **No** | **✅ Chosen** |

---

## 4. Recommended Model

### 4.1 Core Principle

> **The TryVit Score is a product property. Personalization shapes what the user *sees and is warned about*, never what the product *scores*.**

### 4.2 Which Goals Exist Now

| Goal | Status | Onboarding | Settings | MVP Consumer |
|---|---|---|---|---|
| `diabetes` | ✅ Active | ✅ Yes | ✅ Editable | Threshold warnings on product detail + score explanation + alternatives filtering |
| `low_sodium` | ✅ Active | ✅ Yes | ✅ Editable | Same |
| `heart_health` | ✅ Active | ✅ Yes | ✅ Editable | Same |
| `avoid_additives` | ⚠️ Active (dead-end) | ✅ Currently shown | ✅ Future home | Wire to `p_max_concern_tier` in alternatives; move to Settings later |
| `weight_management` | ❌ Removed | No | No | Do not reintroduce until multi-factor preference model is designed (§9 Phase 3) |
| `general_wellness` | ❌ Removed | No | No | Never reintroduce — no concrete mechanism possible |

### 4.3 Model: Threshold-Based Warnings with Highlight Layer

**The model is threshold-based (Option A) with a presentation highlight layer (Option D).**

The mechanism works in four stages:

**Stage 1 — Profile existence check (frontend)**

```
On app load or auth state change:
  → Fetch active health profile (RPC or cached query)
  → If no active profile → no personalization (show generic product views)
  → If active profile → store profile_id + thresholds in client state (Zustand or TanStack Query cache)
```

**Stage 2 — Threshold comparison (per product view)**

```
When viewing a product with nutrition data:
  → Compare product's sugar_g vs user's max_sugar_g
  → Compare product's salt_g vs user's max_salt_g
  → Compare product's saturated_fat_g vs user's max_saturated_fat_g
  → Compare product's calories_kcal vs user's max_calories_kcal (if set)
  → For each exceedance → generate a personalized warning
```

**Stage 3 — Warning generation**

This can happen **client-side** (comparing cached profile thresholds against product nutrition data returned by existing APIs) or **server-side** (adding optional `p_health_profile_id` parameter to API functions).

**Recommended for MVP: client-side.** Rationale:
- Avoids API contract changes in the first phase.
- Nutrition data is already returned by `api_product_detail()`.
- Profile thresholds are already available via direct table query (RLS-protected).
- No server-side computation needed — it's a simple numeric comparison.

**Stage 4 — Display**

```
Product detail page:
  → Show personalized warning card: "⚠ Exceeds your sugar limit"
    with detail: "This product has 32g sugar per 100g. Your limit is 25g."
  → Highlight the relevant factor in score explanation breakdown

Score explanation page:
  → Lift condition-relevant factors to the top of the factors list
  → Add a "Relevant to your profile" badge on matching factors

Better alternatives:
  → Pass health_profile_id to api_better_alternatives_v2()
  → Future: implement actual threshold filtering in the SQL function

Category listing:
  → No change in MVP — all products shown
  → Future: optional "Show products within my limits" toggle
```

### 4.4 What the MVP Does

| Surface | MVP Behaviour |
|---|---|
| **Product detail** | Show personalized warning badges when product exceeds active profile thresholds. Warnings are client-side computed. |
| **Score explanation** | Highlight factors relevant to user's conditions (client-side: sort/badge the matching factors). |
| **Better alternatives** | Pass `p_health_profile_id` to `api_better_alternatives_v2()` (parameter already accepted). |
| **Category listing** | No change. |
| **Dashboard** | No change. |
| **Settings** | Health profile editable (thresholds, conditions). Already possible via direct table operations. |
| **Onboarding** | Unchanged — 3 Tier 1 goals remain. |

### 4.5 What the MVP Does NOT Do

| Excluded from MVP | Why |
|---|---|
| Change any product's score based on user profile | Score is product-intrinsic (§4.1) |
| Filter/hide products from category listings | No silent filtering — transparency first |
| Add `weight_management` or `general_wellness` back | No concrete model exists (§2.2) |
| Server-side personalized warnings API | Client-side comparison is sufficient for MVP |
| Custom threshold editing in onboarding | Onboarding sets presets; Settings is the place for customization |
| Additive preference filtering | Wire `avoid_additives` to `p_max_concern_tier` in Phase 2 |
| Multiple active profiles | Schema supports it via trigger; UI does not need it for MVP |

### 4.6 Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Score objectivity | Score is never modified by user profile | Trust, comparability, regression testing stability |
| Warning computation | Client-side in MVP | Avoids API changes; nutrition data already returned; thresholds small and cacheable |
| `weight_management` | Stay removed | No single-threshold model; would need multi-factor preference system |
| `general_wellness` | Stay removed permanently | No mechanism; collecting it is misleading |
| `avoid_additives` | Keep but acknowledge dead-end | Wire to concern-tier filter in Phase 2; move to Settings eventually |
| Pre-query filtering | Rejected for MVP | Hides products, undermines transparency |
| GDPR consent | Required before profile activation (Phase 1 privacy) | Health conditions are Art. 9 special category data |

---

## 5. API & Surface Impact

### 5.1 API Changes Required (Future Phases)

**No API changes are required for MVP.** MVP uses client-side threshold comparison.

Post-MVP API enhancements (all additive, backward-compatible):

| Function | Change | Phase | Backward Compatible |
|---|---|---|---|
| `api_better_alternatives_v2()` | **Implement** threshold filtering logic (parameter already accepted but unused) | Phase 2 | ✅ Yes — parameter already exists with DEFAULT NULL |
| `api_score_explanation()` | Add optional `p_health_profile_id uuid DEFAULT NULL`; highlight matching factors | Phase 2 | ✅ Yes — new param with default |
| `api_product_detail()` | Add optional `p_health_profile_id uuid DEFAULT NULL`; return `personal_warnings` array | Phase 3 | ✅ Yes — new param with default + new response key |
| `api_category_listing()` | Add optional `p_health_profile_id uuid DEFAULT NULL`; support "compliant only" toggle | Phase 3 | ✅ Yes — new param with default |

### 5.2 Frontend Surface Map

| Surface | Component / Page | What Changes | Phase |
|---|---|---|---|
| Product detail | `app/app/product/[id]/page.tsx` | Add `<HealthWarningCard>` when profile active + thresholds exceeded | MVP |
| Score explanation | Score explanation section | Badge/lift condition-relevant factors | MVP |
| Better alternatives | Alternatives list | Pass `p_health_profile_id` from client state | MVP |
| Settings | `app/app/settings/page.tsx` | Health profile editor (conditions, thresholds, delete) | MVP |
| Onboarding | `HealthGoalsStep.tsx` | Unchanged — 3 goals remain | — |
| Category listing | `app/app/categories/[slug]/page.tsx` | Optional "within my limits" toggle | Phase 3 |

### 5.3 Frontend State

The active health profile must be available to product-viewing components. Recommended approach:

```
TanStack Query cache:
  queryKey: ['health-profile', 'active']
  queryFn: SELECT * FROM user_health_profiles WHERE user_id = auth.uid() AND is_active = true
  staleTime: 5 minutes (profile changes rarely)
```

Components that need the profile:
- Product detail page (threshold comparison)
- Score explanation section (factor highlighting)
- Better alternatives hook (pass profile_id)

---

## 6. Copy & Safety Guidelines

### 6.1 Language Tiers

This section defines what TryVit can and cannot say when presenting health-related information to users. The three tiers correspond to increasing regulatory risk.

#### ✅ Tier A — Screening Language (Safe to Use)

Factual, data-comparisons that state what a product contains versus the user's selected threshold.

| Context | Acceptable Copy | Why Safe |
|---|---|---|
| Product exceeds sugar limit | "This product contains 32g sugar per 100g. Your selected limit is 25g." | Factual comparison — states numbers, no health claim |
| Product within salt limit | "Within your salt limit (0.8g vs 1.5g per 100g)" | Factual comparison |
| Score explanation relevance | "Sugar is the biggest contributor to this product's score — you've flagged sugar as a priority." | Describes user's own selection + factual score factor |
| Better alternative | "This alternative has 60% less sugar per 100g" | Factual nutrient comparison |
| Threshold setup | "Set the maximum sugar content per 100g you'd like to be warned about" | User is setting their own preference |

**Pattern:** `{product fact} + {user's selected threshold} = {comparison}`

#### ⚠️ Tier B — Guidance Language (Use with Explicit Disclaimers)

Statements that connect user goals to product choices. Require a disclaimer.

| Context | Copy | Required Disclaimer |
|---|---|---|
| Goal selection label | "I'm monitoring my sugar intake" | None needed — user's self-description |
| Goal description | "We'll highlight products that exceed your sugar limit" | None needed — describes app behaviour |
| Onboarding intro | "Select health goals to get personalized product warnings" | "These are not medical recommendations. Consult a healthcare provider for dietary advice." |
| Health profile section header | "Your Health Priorities" | Avoid "Health Plan" or "Health Program" |
| Settings description | "Manage the nutrient limits you're tracking" | "These limits are your personal preferences, not medical prescriptions." |

**Pattern:** Describe what the *app does* for the user, not what the *user should do* for their health.

#### 🚫 Tier C — Medical-Advice Territory (Never Use)

Statements that prescribe, diagnose, treat, or imply clinical efficacy.

| ❌ Never Say | Why |
|---|---|
| "Helps manage diabetes" | Implies therapeutic benefit — regulatory violation in EU |
| "Recommended for heart disease patients" | Medical recommendation requires clinical authority |
| "Safe for people with hypertension" | Safety claim requires clinical validation |
| "This product is bad for your condition" | Diagnostic statement |
| "You should eat less than X grams of sugar" | Prescriptive dietary advice |
| "Based on your health profile, avoid this product" | Prescriptive; implies clinical judgement |
| "TryVit-approved for your diet" | Implies certification or clinical endorsement |

**Pattern to recognise Tier C violations:** Any sentence where TryVit is the *subject* giving health advice, or where the copy implies the app has clinical authority.

### 6.2 Warning Card Copy Templates

For each threshold type, use these exact templates:

**Exceeds threshold:**
```
⚠ Exceeds your [nutrient] limit
This product has [X]g [nutrient] per 100g.
Your selected limit is [Y]g per 100g.
```

**Within threshold:**
```
✓ Within your [nutrient] limit
[X]g per 100g (your limit: [Y]g)
```

**No profile / no threshold set:**
```
(no personal warning shown — show only static product flags)
```

### 6.3 Onboarding Copy

Current acceptable labels:
- "I'm monitoring my sugar intake" (diabetes → sugar threshold)
- "I'm watching my salt intake" (low_sodium → salt threshold)
- "I'm tracking my saturated fat intake" (heart_health → sat fat threshold)

Footer disclaimer (required on health-goals step):
> "TryVit highlights products based on your selections. This is not medical advice. Consult a healthcare provider for personalised dietary guidance."

### 6.4 Global Disclaimer

Every health-profile-related screen (onboarding health step, settings health section, personalized warning cards) must display or link to:

> "TryVit provides nutrition information for personal awareness. It does not diagnose, treat, or prevent any medical condition. Always consult a qualified healthcare professional for dietary advice related to medical conditions."

Placement: inline on onboarding + settings screens; link/tooltip on warning cards.

---

## 7. Privacy & Data Minimization

### 7.1 GDPR Art. 9 — Special Category Data

Health conditions listed in `user_health_profiles.health_conditions` constitute **health data** under GDPR Art. 9(1). Processing requires an explicit legal basis.

**Chosen legal basis:** Art. 9(2)(a) — Explicit consent.

This means the app must:
1. Obtain **explicit, informed, specific** consent before storing health conditions.
2. Store consent metadata (timestamp, version of consent text).
3. Allow withdrawal of consent (which deletes the health profile).
4. Not process health data for any purpose beyond the stated one.

### 7.2 What Data Is Truly Necessary

| Data Point | Necessary? | Justification |
|---|---|---|
| Health condition labels (`diabetes`, `hypertension`, `heart_disease`) | ⚠️ Debatable | Only needed to display the condition name back to the user. The *thresholds* are what drive personalization. See §7.3. |
| Nutrient thresholds (`max_sugar_g`, `max_salt_g`, etc.) | ✅ Yes | These are the operational data — used to compare against product nutrition |
| `profile_name` | ✅ Yes | User identification of their own profiles |
| `notes` | ❌ Optional | User convenience; not operationally needed |

### 7.3 Data Minimization Option: Thresholds Without Condition Labels

A privacy-maximizing alternative is to store **only nutrient thresholds** without condition labels:

| Approach | Stores | Art. 9 Applies? | UX Impact |
|---|---|---|---|
| **Current schema** | `health_conditions` array + thresholds | ✅ Yes — condition labels are health data | User sees "Diabetes profile" in settings |
| **Threshold-only** | Only `max_sugar_g`, `max_salt_g`, etc. | ⚠️ Arguable — numeric preferences alone may not constitute health data | User sees "Your nutrient limits" — loses condition context |

**Recommendation:** Proceed with the **current schema** (conditions + thresholds) but add explicit consent. Rationale:
- Users *expect* to see their selected conditions reflected in the UI ("My diabetes profile").
- Stripping condition labels degrades UX without eliminating Art. 9 risk entirely (thresholds themselves could be inferentially health data).
- The consent mechanism is needed regardless.

### 7.4 Consent Implementation Requirements

| Requirement | Detail |
|---|---|
| **Consent capture timing** | Before the `INSERT INTO user_health_profiles` in `api_complete_onboarding()` (or before profile creation in Settings) |
| **Consent text** | "TryVit will store your selected health conditions and nutrient limits to show personalised product warnings. This data is stored securely and never shared with third parties. You can view, edit, or delete this data at any time in Settings." |
| **Consent storage** | New column: `consent_given_at timestamptz` on `user_health_profiles` (NULL = no consent = profile should not be activated) |
| **Consent withdrawal** | Delete health profile via Settings → "Remove health profile" button → calls `api_delete_health_profile()` or direct DELETE (RLS-protected) |
| **Consent version** | Optional: `consent_version text` column to track which consent text version was accepted (useful if consent text changes) |
| **No pre-checked boxes** | Health goal selection in onboarding must start with nothing selected. User makes affirmative choices. |
| **Consent separate from ToS** | Health data consent must be a separate action from general terms acceptance. Cannot be bundled. |

### 7.5 Where Consent Should Be Requested

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Onboarding health-goals step** | Natural flow; user is already selecting goals | Adds friction to first-run; mixing consent with onboarding | ✅ **Recommended** — add a brief consent notice below goal selection, with a "I understand" confirmation before proceeding |
| **Settings (first profile creation)** | Cleaner separation; onboarding stays simple | User must navigate to Settings to get personalization | ❌ Not for MVP — would leave onboarding goals disconnected from profile creation |
| **Separate consent screen** | Maximum legal clarity | Extra step; high drop-off risk | ❌ Overkill for MVP — inline consent is sufficient under Art. 9(2)(a) |

### 7.6 Editability and Deletion

| Action | Where | Mechanism |
|---|---|---|
| View health profile | Settings → Health section | Query `user_health_profiles` (RLS: own rows only) |
| Edit conditions / thresholds | Settings → Health section | UPDATE `user_health_profiles` (RLS: own rows only) |
| Delete health profile | Settings → "Remove health profile" | DELETE `user_health_profiles` (RLS: own rows only); covered by `api_delete_user_data()` for full account deletion |
| Export health data | Settings → Export (GDPR Art. 15) | Already covered by `api_export_user_data()` — includes health profiles |

### 7.7 Data Retention

Health profile data is retained until the user:
1. Deletes the profile manually, OR
2. Deletes their account (cascade via `api_delete_user_data()`), OR
3. Withdraws consent (treated as profile deletion)

No automatic expiry. No time-based retention limit (user controls their own data).

---

## 8. MVP Scope Definition

### 8.1 In Scope (MVP)

| Item | Detail |
|---|---|
| Client-side threshold warnings on product detail | Compare product nutrition vs active profile thresholds; display warning card |
| Factor highlighting in score explanation | Badge/sort factors relevant to user's conditions |
| Pass `p_health_profile_id` to better-alternatives API | Parameter already accepted — enables future filtering |
| Health profile editor in Settings | CRUD on `user_health_profiles` via RLS-protected queries |
| GDPR consent notice in onboarding health step | Inline consent text + "I understand" before profile creation |
| `consent_given_at` column on `user_health_profiles` | Track when consent was given |
| Global health disclaimer | On onboarding, settings, and warning card screens |
| Copy safety guidelines | Follow §6 strictly in all health-related UI text |

### 8.2 Out of Scope (Deferred)

| Item | Deferred To | Rationale |
|---|---|---|
| Server-side personalized warnings API | Phase 2 | Client-side sufficient for MVP; avoids API contract changes |
| Threshold filtering in `api_better_alternatives_v2()` | Phase 2 | Parameter accepted but logic not implemented |
| `api_score_explanation()` profile parameter | Phase 2 | MVP uses client-side factor highlighting |
| `api_product_detail()` profile parameter | Phase 3 | Not needed while warnings are client-side |
| `api_category_listing()` profile filtering | Phase 3 | "Compliant products" toggle is a post-MVP feature |
| `weight_management` reintroduction | Phase 3+ | Requires multi-factor preference model design |
| `avoid_additives` wiring to concern-tier filter | Phase 2 | Currently dead-end; wire to `p_max_concern_tier` |
| Multiple active profiles UI | Not planned | Schema supports it; no user demand signal |
| Dashboard "watch out" items | Phase 3 | Low priority; needs recently-viewed + threshold cross-reference |
| Custom threshold editing in onboarding | Not planned | Onboarding sets presets; Settings is the customization surface |

### 8.3 Do Not Collect Until Consumed

| Data | Current Status | Rule |
|---|---|---|
| `weight_management` goal selection | Removed | Do not re-add to UI until a concrete downstream consumer exists |
| `general_wellness` goal selection | Removed | Never re-add — no mechanism possible |
| Detailed condition metadata (diagnosis date, severity, medication) | Not collected | Do not collect — far exceeds what TryVit needs |
| BMI, weight, height | Not collected | Do not collect — `weight_management` requires this, which is why it needs its own design phase |

---

## 9. Phased Implementation Plan

### Phase 1 — Privacy Foundation (Schema Only)

**Prerequisite for all personalization work.**

| Step | Change | Type |
|---|---|---|
| 1.1 | Add `consent_given_at timestamptz` to `user_health_profiles` | Migration |
| 1.2 | Add `consent_version text DEFAULT 'v1'` to `user_health_profiles` | Migration |
| 1.3 | Update `api_complete_onboarding()` to set `consent_given_at = now()` when creating profile | Migration |
| 1.4 | Add QA check: profiles with `is_active = true` must have `consent_given_at IS NOT NULL` | QA suite |
| 1.5 | Add pgTAP test: `api_complete_onboarding()` sets consent timestamp | pgTAP test |

**Migration filename:** `YYYYMMDDHHMMSS_health_profile_consent.sql`

### Phase 2 — Client-Side Warnings (Frontend MVP)

**The core personalization experience.**

| Step | Change | Type |
|---|---|---|
| 2.1 | Create `useHealthProfile()` TanStack Query hook — fetches active profile | Frontend hook |
| 2.2 | Create `usePersonalWarnings(productNutrition)` hook — compares nutrition vs profile thresholds | Frontend hook |
| 2.3 | Create `<HealthWarningCard>` component — displays threshold exceedance warnings | Frontend component |
| 2.4 | Integrate `<HealthWarningCard>` into product detail page | Frontend page |
| 2.5 | Add factor highlighting in score explanation section | Frontend component |
| 2.6 | Pass `p_health_profile_id` from client state to better-alternatives calls | Frontend hook |
| 2.7 | Add consent notice + disclaimer to onboarding health-goals step | Frontend component |
| 2.8 | Add health profile editor to Settings page | Frontend page |
| 2.9 | Add global health disclaimer component | Frontend component |
| 2.10 | Unit tests for all new hooks and components | Vitest |
| 2.11 | E2E test: onboarding → profile created → product shows warning | Playwright |

### Phase 3 — Server-Side Personalization (API Enhancement)

**Move threshold comparison server-side for richer functionality.**

| Step | Change | Type |
|---|---|---|
| 3.1 | Implement threshold filtering in `api_better_alternatives_v2()` | Migration |
| 3.2 | Add `p_health_profile_id` to `api_score_explanation()` | Migration |
| 3.3 | Wire `avoid_additives` to `p_max_concern_tier` default mapping | Migration |
| 3.4 | Move `avoid_additives` from onboarding to Settings-only | Frontend |
| 3.5 | Add pgTAP tests for all modified API functions | pgTAP tests |
| 3.6 | Update `docs/API_CONTRACTS.md` with new parameters | Documentation |

### Phase 4 — Extended Personalization (Post-MVP)

**Only if user demand signals justify it.**

| Step | Change | Type |
|---|---|---|
| 4.1 | Add `p_health_profile_id` to `api_product_detail()` — return `personal_warnings` array | Migration |
| 4.2 | Add `p_health_profile_id` to `api_category_listing()` — optional "compliant only" toggle | Migration |
| 4.3 | Dashboard "watch out" surface for recently-viewed threshold-exceeding products | Frontend |
| 4.4 | Design multi-factor preference model for `weight_management` (if reintroduced) | Design spec |

---

## 10. Follow-Up Issues

These are implementation-ready issue stubs, grouped by domain. Each becomes a separate GitHub issue when implementation begins.

### 10.1 Backend / Schema

| Title | Scope | Phase | Effort |
|---|---|---|---|
| `schema(migration): add consent_given_at to user_health_profiles` | Add `consent_given_at timestamptz` + `consent_version text`; update `api_complete_onboarding()` to set consent timestamp | Phase 1 | S |
| `schema(migration): implement threshold filtering in find_better_alternatives_v2` | Add WHERE clauses comparing alternative nutrition vs profile thresholds; ORDER BY relevance | Phase 3 | M |
| `schema(migration): wire avoid_additives to p_max_concern_tier` | Default mapping in `api_complete_onboarding()`: `avoid_additives` → `max_concern_tier = 1` (or profile column) | Phase 3 | S |

### 10.2 API

| Title | Scope | Phase | Effort |
|---|---|---|---|
| `feat(api): add p_health_profile_id to api_score_explanation` | New optional parameter; highlight matching factors in response; condition-relevant factor sorting | Phase 3 | M |
| `feat(api): add p_health_profile_id to api_product_detail` | Return `personal_warnings` JSONB array when profile provided | Phase 4 | M |
| `feat(api): add p_health_profile_id to api_category_listing` | Optional threshold-based pre-filtering with "strict mode" toggle | Phase 4 | M |

### 10.3 Frontend / UX

| Title | Scope | Phase | Effort |
|---|---|---|---|
| `feat(frontend): health profile hooks and client-side threshold warnings` | `useHealthProfile()`, `usePersonalWarnings()`, `<HealthWarningCard>`, product detail integration | Phase 2 | L |
| `feat(frontend): score explanation factor highlighting for health goals` | Badge condition-relevant factors; sort to top when profile active | Phase 2 | M |
| `feat(frontend): health profile CRUD in Settings` | Profile editor: view/edit conditions, thresholds, delete profile | Phase 2 | M |
| `feat(frontend): move avoid_additives from onboarding to Settings` | Remove from `HEALTH_GOALS` constant; add to Settings preference toggles | Phase 3 | S |

### 10.4 Privacy / Consent

| Title | Scope | Phase | Effort |
|---|---|---|---|
| `feat(frontend): GDPR Art. 9 consent notice on health-goals step` | Inline consent text, "I understand" confirmation, consent_given_at written on profile creation | Phase 1–2 | M |
| `feat(frontend): health profile deletion and consent withdrawal in Settings` | "Remove health profile" button; confirmation dialog; DELETE operation | Phase 2 | S |
| `test(qa): health profile consent audit checks` | QA check: active profiles must have consent_given_at; pgTAP test for consent flow | Phase 1 | S |

### 10.5 Copy / Policy

| Title | Scope | Phase | Effort |
|---|---|---|---|
| `docs(copy): health warning card copy templates and disclaimer text` | Finalize warning card templates (§6.2), onboarding copy (§6.3), global disclaimer (§6.4); i18n keys for en/pl/de | Phase 2 | S |
| `docs(policy): health data processing policy page` | Public-facing page explaining what health data TryVit stores, why, and how to delete it; linked from Settings and onboarding | Phase 2 | S |

---

## Appendix A — Glossary

| Term | Definition |
|---|---|
| **Health goal** | A user-selected preference in onboarding (e.g., `diabetes`, `low_sodium`). Stored in `user_preferences.health_goals`. |
| **Health condition** | A diagnosed medical condition label stored in `user_health_profiles.health_conditions` (e.g., `diabetes`, `hypertension`). |
| **Nutrient threshold** | A per-100g numeric limit stored on `user_health_profiles` (e.g., `max_sugar_g = 25`). |
| **Health profile** | A row in `user_health_profiles` containing conditions + thresholds + consent metadata. |
| **Personalized warning** | A UI element shown when a product's nutrition exceeds the user's active profile thresholds. |
| **Static flag** | A per-product attribute (`high_sugar_flag`, etc.) that does not vary by user. |
| **TryVit Score** | `100 − unhealthiness_score`. Product-intrinsic. Never modified by user profile. |

## Appendix B — References

| Source | URL / Location |
|---|---|
| WHO Sugar Guidelines | WHO Guideline: Sugars intake for adults and children (2015) |
| EU "High Salt" Regulation | Regulation (EU) No 1169/2011, Annex XIII |
| EFSA Saturated Fat DRV | EFSA Journal 2010; 8(3):1461 |
| GDPR Art. 9 | Regulation (EU) 2016/679, Article 9 |
| TryVit Scoring Methodology | `docs/SCORING_METHODOLOGY.md` |
| TryVit Privacy Checklist | `docs/PRIVACY_CHECKLIST.md` |
| Issue #887 — Onboarding Cleanup | Removed `weight_management` + `general_wellness` |
| Issue #892 — This Design Spec | Health Goal Personalization Design |
