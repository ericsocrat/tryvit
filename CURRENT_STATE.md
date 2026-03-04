# CURRENT_STATE.md

> **Last updated:** 2026-03-15 by GitHub Copilot (session 17)
> **Purpose:** Volatile project status for AI agent context recovery. Read this FIRST at session start.

---

## Active Branch & PR

- **Branch:** `score/610-rescore-v33`
- **Latest SHA:** pending commit (re-score all products with v3.3)
- **Open PRs:** 18 (PRs #623–#640, all OPEN/unmerged) + 1 pending (#610)

## Recently Shipped (This Session)

| SHA       | Summary                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| pending   | score(migration): re-score all products with v3.3 nutrient density bonus (#610)        |

## Recently Shipped (Last 7 Days)

| Date       | PR/SHA    | Summary                                                                             |
| ---------- | --------- | ----------------------------------------------------------------------------------- |
| 2026-03-03 | #583      | **MERGED** — Milestone #17: 17 UX issues, 134 files, 4,504 tests                   |
| 2026-03-15 | #564      | **MERGED** — fix doc count drift — migration 184→185 (closes #562)                  |
| 2026-03-15 | #561      | **MERGED** — fix 11 ESLint non-null assertion warnings across 8 files (closes #555) |
| 2026-03-15 | #560      | **MERGED** — fix nightly data audit false-positive criticals (closes #554)          |

## Known Issues & Broken Items

- [ ] Quality Gate dashboard test still fails — staging DB missing API functions (schema sync needed)
- [ ] 18 PRs (#623–#640) OPEN/unmerged — v3.3 scoring chain + multi-country + frontend features

## Next Planned Work

- [ ] Merge v3.3 scoring chain PRs (#632→#640→this PR→#611→#612→#613→#614)
- [ ] Implement #563 — sync staging DB schema (P2, requires staging access)

## Key Metrics Snapshot

- **Products:** 1,671 active (20 PL + 5 DE categories)
- **QA checks:** 733 total, all pre-existing failures only (scoring v3.3 chain)
- **Scoring model:** v3.3 (10-factor: 9 penalties − nutrient density bonus)
- **EAN coverage:** 99.8%
- **Frontend test coverage:** ~88% lines
- **DB migrations:** 186 append-only (185 on main + 1 pending)
- **Ruff lint:** 0 errors

---

## Maintenance Protocol

- **After every PR merge:** Update "Recently Shipped" and "Active Branch" sections
- **After every session:** Update "Known Issues" and "Next Planned Work"
- **Weekly:** Refresh "Key Metrics Snapshot" and "CI Gate Status"
