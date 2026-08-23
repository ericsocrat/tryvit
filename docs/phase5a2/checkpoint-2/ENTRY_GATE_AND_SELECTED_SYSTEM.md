# Phase 5A.2 Checkpoint 2 entry gate and selected system

> **Status:** Entry passed; non-production implementation authorized
> **Observed:** 2026-08-23
> **Branch:** `codex/phase-5a2-golden-references`

## Prompt ingestion

The standalone prompt was read directly from the attached Markdown file before any
repository mutation. It matched:

- SHA-256: `d711d19f760afd20fd6363a92e02c5b63d85f47a28c7d7e5f8141e65532e83db`;
- bytes: `32874`;
- content lines: `1270` (the file also ends in a newline);
- exact first heading and final sentinel.

No parent task, chat preview, browser history, or truncated message supplied contract
text.

## Certified repository authority

- Repository: `ericsocrat/tryvit`.
- Main/head: `c21d9bb8a25ddf3deee7b11a2386dfa59cccac7c`.
- Single parent: `bb4cd53fa37c9e5f6a59a0dbbd9752cbd2e3a03a`.
- Tree: `3771b8f5a81614cc59ac3b4ebad15358c3655d76`.
- PR `#1294`: normally squash-merged from `4f14a8a10af5bb0d50cade2f5bfc62c33efda4fa`;
  exactly the two authorized renderer metadata files changed; PR-head and merged-main
  trees are byte-identical.
- Main Gate `32654820794` attempt 2, CodeQL `32654820771`, hygiene `32654820780`,
  deployment `6050708183`, and post-deploy smoke `32654919750`: terminal success on
  the exact main SHA.
- Renderer candidate `32653121285`, attestation `32653829812`, and immutable visual
  verification `32653829492`: terminal success with the expected runtime identity.
- Retries-disabled Nightly `32649733528`: `234 passed`, `2 skipped`, zero retry mode,
  terminal success on the immediate parent.
- PR `#1283`: merged. The Checkpoint 1 selection record is unchanged.
- No Golden Reference branch, PR, worktree, route, or implementation existed at entry.
- The current worktree was clean and synchronized before branch creation.

The frozen Checkpoint 1 manifest is governed as UTF-8 with LF line endings. Its
canonical Git-content SHA-256 remains
`9c10d0243b5208319fc8c3b1497ca9dae552f7fdfd899823ae2fca39f8993c1e`.
Windows checkout CRLF conversion produces a different raw working-tree hash; that is
not evidence drift and must not replace the governed hash.

Code-scanning and secret-scanning open alerts are zero. Dependabot alerts `#92`, `#93`,
and `#94` are inherited high-severity development-transitive findings created on
2026-08-09/12, before the certified baseline. They remain explicitly disclosed and are
not described as new or resolved. All open pull requests have zero current unresolved,
non-outdated review threads.

## Fail-closed repository-mechanics corrections

1. Checkpoint 1 routes, source, tooling, and evidence remain frozen. Checkpoint 2 uses
   static sibling route `/dev/phase5a2/golden/[reference]` and a separate
   `checkpoint-2` evidence namespace.
2. The existing Phase 5A.2 gate intentionally opens Checkpoint 1 in development. New
   Golden routes additionally require exact
   `PHASE5A2_DIRECTION_SELECTION=1` in every environment.
3. The protected route-policy default remains unchanged. The local-authenticated
   visual-safety launcher is the only review runtime.
4. A Vercel preview may redirect an anonymous flag-off request before the page-level
   gate. Acceptance is zero Golden content/assets on that preview plus an authenticated
   local-production 404. No public route exception will be added.
5. New evidence tooling lives beside the frozen direction-selection tooling and may
   reuse its path-safety, environment-restoration, and WebM verification primitives.
6. The generated live inventory gains an explicit `5A.2` phase classification for the
   guarded subtree instead of misclassifying it as later production Phase 5A.3.

These corrections do not alter authority, scope, thresholds, rubric, production route
policy, or the selected hybrid.

## Selected system: Folded Label Register

Source Fold owns identity, warm editorial character, package/source metaphor, vector
imagery, and expressive motion. Evidence Register owns decision-first information
architecture, ruled evidence rows, compact application density, explicit confidence,
unknown/partial states, comparison, and recovery.

The system is one design, not Candidate A artwork pasted over Candidate B CSS:

- asymmetric folded-label geometry with a square registration aperture;
- warm oat/paper/forest/rust palette, without Evidence Register cobalt;
- edge-to-edge evidence bands and rules rather than a grid of generic rounded cards;
- decision, data confidence, main reason, and next action first on compact product and
  application surfaces;
- evidence origin communicated by label, glyph morphology, rule, and placement—not hue;
- public editorial spacing and compact application spacing sharing the same identity.

### Palette

| Role | Light | Dark |
|---|---|---|
| Canvas | `#F3EBDC` | `#15231C` |
| Paper | `#FFFAF0` | `#1D3026` |
| Raised paper | `#FFFDF7` | `#294336` |
| Primary ink | `#17271F` | `#F7EFDF` |
| Secondary ink | `#526158` | `#C0C9C1` |
| Brand/action deep | `#123D2C` | `#C1DFC4` |
| Brand/action support | `#1F5B42` | `#9FC8A8` |
| Fold/rust | `#8E3D22` | `#EF9D75` |
| Meaningful rule | `#817564` | `#718077` |

Dark mode is recomposed, not inverted. Forced colors collapse identity to a single
`CanvasText` silhouette and use system colors for focus, rules, and links.

### Identity and domain glyphs

The candidate master mark uses a 24×24 optical grid. A separate fill-only 16×16
reduction has a 1px safe edge, no feature below 2px, and a 2×2 registration aperture.
The path-only wordmark uses exact `TryVit` casing. No live SVG text, raster master,
filter, gradient, emoji, or generic icon-library addition is admitted.

The original typed glyph grammar covers source, observed, derived, context, decision,
confidence, unknown, scanner, and compare on a 24×24 grid with rounded 1.75px strokes
and optical 16px treatment. Labels remain mandatory where meaning matters.

Legal/trademark clearance is not claimed.

### Typography disposition

The deterministic system stack remains the rendered control. Manrope with restrained
Source Serif 4 is not rendered because current evidence lacks immutable upstream
commits, checked-in license/RFN files, complete EN/PL/DE message coverage, fallback
metrics, size adjustment, and CLS proof. The prior bounded Google Fonts transfer assay
is useful cost evidence but is not adoption or complete-render evidence.

This is a fail-closed assay result. No font package, root preload, public asset, or
production font change is permitted. Meaningful metadata remains at least 12px,
evidence rows 14–16px, primary body text at least 16px, and numeric evidence uses
tabular figures.
