# TryVit — Agent Review Workflow (Strategic Stabilization)

> **Last updated:** 2026-05-31
> **Status:** Active
> **Owner issue:** —
> **Authority:** `copilot-instructions.md` §0 (Top Priority — Strategic Stabilization Mode) is the primary rule. This doc defines the full multi-pass process referenced there.

---

## Purpose

This document defines the four-pass workflow used for **strategic documentation,
truthfulness, and product-positioning stabilization sprints**. It is intentionally
stored separately from `copilot-instructions.md` so the instructions file stays
short and authoritative, and so agents do not treat review-workflow text as
permanent project law (and over-focus on docs forever).

Use this workflow **only** for stabilization sprints — not for routine feature work.

---

## Governing Principles (apply to every pass)

- **Scope is documentation-only** unless explicitly stated otherwise: no feature
  code, no migrations, no CI logic, no package files, no tests, no production data.
- **Source-of-truth hierarchy** (highest first):
  1. Scripts / workflows — `RUN_QA.ps1`, `RUN_NEGATIVE_TESTS.ps1`,
     `scripts/repo_verify.ps1`, `scripts/check_doc_counts.py`,
     `scripts/check_doc_drift.py`
  2. Runtime / config / file inventory — `frontend/package.json`,
     `supabase/migrations`, `db/pipelines`, `supabase/tests`,
     `pr-gate` / `main-gate` / `qa` workflow files
  3. `CURRENT_STATE.md`
  4. Narrative markdown docs
- **Never invent a count.** If a number is required and not source-backed, run the
  verifying command. If it still cannot be confirmed, mark it "Needs verification"
  with the exact command.
- **Markdown is not current truth.** A markdown file may carry historical context,
  but it cannot be the final source of truth for a current count unless it clearly
  labels the value as historical (e.g. "as of YYYY-MM-DD").
- **Reversibility.** Every change must be revertable with zero runtime impact.

---

## Pass 1 — Claude Opus 4.8: Audit Only (No Edits)

**Goal:** Produce an evidence-backed audit of documentation/positioning drift. No
files are modified in this pass.

**Rules:**
- Read-only. Do not edit any file.
- For every numeric/version claim found, classify it against the source-of-truth
  hierarchy: Verified / Needs-verification / Wrong.
- Record an **uncertainty register**: each unconfirmed value plus the exact command
  that would confirm it.
- Document concrete drift (e.g. QA badge vs scripts, Next.js version vs
  `package.json`, API function-count mismatches, product totals across docs).

**Output:**
- Drift inventory (file → claim → classification → source/command).
- Uncertainty register.
- A prioritized list of contradictions to resolve in Pass 2.

---

## Pass 2 — Claude Opus 4.8: Documentation Stabilization (Docs-Only Execution)

**Goal:** Apply the corrections identified in Pass 1, plus author the agreed
positioning artifacts, as a documentation-only diff.

**Rules:**
- Documentation-only. No runtime code, migrations, CI logic, package files, tests,
  or production data.
- Every corrected number must be source-backed; otherwise label it "Needs
  verification" with the command.
- Keep edits minimal and reversible. Do not rewrite unrelated sections for style.
- Fix contradictions in **all** affected files — do not correct one file while
  leaving the same stale value elsewhere.

**Typical artifacts:**
- `README.md` rewrite — product-first (what / who / why) before architecture.
- `PROJECT_SNAPSHOT.md` — current, source-backed snapshot of key counts.
- `docs/PRODUCT_POSITIONING.md` — honest positioning, non-goals, unvalidated
  monetization clearly labeled.
- `docs/DEMO_SCRIPT.md` — a 3–5 minute runnable demo with a recovery branch.

**Output (final report):**
- Files changed.
- Contradictions fixed (with sources).
- Residual uncertainty register.

---

## Pass 3 — ChatGPT GPT-5.5 Thinking: Strict Reviewer Mode

**Goal:** Aggressively challenge the Pass 2 diff and decide merge / change / reject
per file, with explicit criteria.

**Inputs to provide:**
1. The Pass 1 audit output.
2. The Pass 2 final report.
3. The actual changed files / GitHub PR diff.
4. Any verification logs run during Pass 2.

**Rules:**
- Treat every number as guilty until proven by a source (hierarchy above).
- Any new number not in the uncertainty register and not source-backed →
  automatic Change-Required.
- Any scope creep beyond docs (feature code, migrations, CI, production data) →
  automatic Reject for that hunk.
- Do not punish a historical doc for being historical — but require it be clearly
  labeled so it cannot be mistaken for current truth.
- If the reviewer cannot inspect the actual diff/source, it must say the review is
  **limited** and not pretend full verification occurred (mark affected rulings
  "Conditional — diff not inspected").

**Output:**
- Verdict summary: MERGE / MERGE-WITH-CHANGES / REJECT (state full vs limited review).
- Per-file rulings table.
- Fact-integrity findings.
- Contradiction-closure table.
- **Must-fix-before-merge** list (ordered, blocking).
- Nice-to-have list (non-blocking).
- If MERGE-WITH-CHANGES: minimal, copy-pasteable correction tasks for Pass 2.1.

---

## Pass 2.1 — Claude Opus 4.8: Blocker-Only Correction Round

**Goal:** Resolve **only** the reviewer's "Must-fix-before-merge" items. Nothing else.

**Rules:**
- Touch only files in the blocking list; touch the minimum lines required.
- Do not add new claims, numbers, sections, or positioning unless the reviewer
  explicitly requested it.
- Do not rewrite accepted sections for style; do not broaden scope.
- No runtime code, migrations, CI logic, package files, tests, or production data.
- If a blocker is ambiguous or cannot be fixed within scope, stop and record it
  under "remaining uncertainties" — do not guess.

**Output:**
- Blocker checklist (# → blocker → file:lines → fix → source/command).
- Patch summary (one bullet per file).
- Verification commands run (command → result).
- Reversibility confirmation.
- Remaining uncertainties.

---

## Loop Summary

```
Pass 1  (Opus)   audit only, no edits
   ↓
Pass 2  (Opus)   docs-only stabilization + positioning artifacts
   ↓
Pass 3  (GPT-5.5) strict review → merge / change / reject
   ↓
Pass 2.1 (Opus)  blocker-only correction (only if MERGE-WITH-CHANGES)
```

This keeps agents from endlessly polishing the repo and drives the project toward a
clean, truthful, mergeable state.
