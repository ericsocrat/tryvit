# Phase 5A.1a — Design System V2 Foundations

> **Last updated:** 2026-08-09
> **Status:** Implemented on the Phase 5A.1a draft branch; exact-head CI and catalog candidate review pending
> **Entry gate:** Phase 5A.0f merged to `main` at `2d40001754d370782bc7f502918daac06a8d024f`

## Approved direction

Eric approved the following human visual decisions before implementation:

- **Living Label** as the Design System V2 direction;
- oat/ivory light canvases and **warm-forest dark mode**;
- compact authenticated-application density, with more expressive public-page spacing;
- low elevation, restrained radii, and the existing TryVit mark retained;
- a **Manrope assay only**, with serif typography deferred;
- zero new runtime dependencies by default;
- two official pull requests: foundations first, primitives and compatibility facades second.

The intended character is warm, editorial, evidence-led, and trustworthy. It must not
become generic glass SaaS, neon health-tech, a wall of decorative cards, ornamental
motion, moralizing health language, or an interface where confidence and provenance
are visually weaker than a score.

## Phase boundary

### Included in 5A.1a

- one canonical typed token manifest and deterministic generator;
- generated CSS, TypeScript, and documentation artifacts;
- V2 primitives, semantic roles, component recipes, domain roles, and an exact V1
  compatibility layer;
- spacing, sizing, typography, radius, border, elevation, motion, z-index, and
  breakpoint foundations;
- theme bootstrap, explicit-theme Tailwind behavior, color-scheme metadata,
  forced-colors mappings, skip navigation, and localized route announcements;
- a live AST-backed route/component inventory with shrink-only visual-debt ratchets;
- a guarded `/dev/components` catalog foundation with four stable scenes and
  deterministic candidate capture evidence;
- scripts, CI wiring, tests, and documentation for those contracts.

### Explicitly deferred to 5A.1b

- canonical Button, IconButton, Surface, CardLink, Field, Dialog, Sheet, Menu, Tabs,
  Tooltip, and PageState implementations;
- V1 component compatibility facades;
- interaction-heavy keyboard/focus contracts and their complete catalog scenes;
- removal of any legacy component or utility debt.

Production routes and shells are not visually migrated in either part of 5A.1. This
PR changes only `/dev/components` presentation plus semantic accessibility landmarks.
It does not change route policy, APIs, database/Supabase behavior, service-worker
policy, Open Graph output, dependency manifests, Next/Vercel configuration, or the
reviewed Phase 5A.0d baseline images.

## Source hierarchy

For Phase 5 visual work, the master experience audit, Design System V2 blueprint,
implementation roadmap, and this phase record are the governing documents. The older
brand guidelines remain authoritative for the retained mark and asset-use rules, while
their V1 palette/type guidance is historical. `DESIGN_REFRESH_SPEC.md` is a superseded
planning artifact, and `frontend/docs/DESIGN_SYSTEM.md` documents the V1 compatibility
surface rather than the V2 source of truth.

The source of truth is:

1. `frontend/src/design-system/tokens/manifest.ts` — canonical token definitions;
2. `frontend/src/design-system/tokens/schema.ts` and `validation.ts` — contract and
   fail-closed validation;
3. `frontend/src/design-system/tokens/generate.ts` — deterministic rendering;
4. generated outputs, which must never be hand-edited:
   - `frontend/src/design-system/generated/tokens.css`;
   - `frontend/src/design-system/generated/tokens.ts`;
   - `docs/assets/design-tokens.json`.

Generation uses stable ordinal ordering and contains no timestamps or environment-
derived fields. `npm run design-system:tokens:check` fails if any generated output
differs from the manifest.

The manifest contains five sections:

| Section        | Count | Purpose                                                        |
| -------------- | ----: | -------------------------------------------------------------- |
| `primitive`    |   180 | Private `--ds-*` colors, spacing, sizing, type, motion, and more |
| `semanticV2`   |    59 | Living Label roles such as canvas, surface, content, and action |
| `componentV2`  |    28 | Component recipe tokens reserved for canonical V2 primitives   |
| `domain`       |    57 | Evidence, allergen, confidence, score, and regulated roles      |
| `compatV1`     |   126 | Existing production variables reproduced exactly                |

## V1 compatibility and rollout

V2 is opt-in under `data-design-system="v2"`. Existing production content remains
under `data-design-system="v1"`. The compatibility scope reproduces all 126 V1 light
values and 86 dark overrides exactly, while the original global declarations remain
temporarily present. This deliberate overlap makes the new layer independently
reversible and prevents a global Living Label restyle.

The Tailwind bridge is `@theme inline`, which prevents same-name custom-property
self-cycles. New V2 utilities resolve through private bridge variables. Known legacy
class names that currently compile to no CSS, including `bg-background` and
`border-border`, remain inactive; activating them would be a production visual change.

Explicit `data-theme="light"` and `data-theme="dark"` work on the scope itself or its
normal inherited root theme. A same-node theme is the supported override boundary; a
local light scope suppresses the system-dark fallback even inside an outer dark scope.
Conflicting nested theme ancestors are not a public composition contract. With
JavaScript unavailable and no explicit preference, the system media query selects both
the V1/V2 dark values and existing `dark:` utilities. Forced-colors mode maps meaningful
V1 and V2 roles to system colors and removes decorative shadows.

## Visual foundations

- Light mode uses oat and ivory canvases with forest actions and ink.
- Dark mode uses deep, warm forest canvases rather than neutral-black SaaS panels.
- Spacing follows a strict 4 px grid.
- App surfaces default to compact/focused gaps; public editorial scenes may use the
  expressive gap.
- Radii are limited to none, small, medium, large, label, and round.
- Elevation is limited to exactly four recipes: none, raised, overlay, and floating.
- Motion is limited to four durations, four named easings, and four displacement sizes;
  reduced-motion and forced-colors equivalents remain mandatory.
- The existing mark is retained. This phase adds no illustration or photography asset.

Twenty-five named contrast pairs pass in light, dark, and forced-color contracts. The
minimum measured normal-text ratios are 5.000:1 in light and 7.096:1 in dark; the
minimum meaningful UI/focus ratios are 3.432:1 and 3.710:1 respectively.

## Typography decision

The production contract remains the deterministic system sans stack. It covers the
EN/PL/DE corpus with zero font transfer, no runtime font host, no root preload, and no
Open Graph change.

Manrope is recorded as `candidate-not-adopted`. No authoritative, redistributable,
version-pinned Latin Extended WOFF2 with a verified license and checksum was supplied,
so adopting it would require guessing. A future adoption requires all of:

- an authoritative pinned source and redistributable license;
- EN/PL/DE and Latin Extended glyph proof;
- checked-in WOFF2 checksum evidence;
- a total transfer budget of at most 100 KiB;
- fallback and layout-shift evidence;
- no unintended production-route preload.

Serif typography remains deferred by explicit approval.

## Accessibility and locale contract

- `ThemeScript`, `useTheme`, and `ThemeSynchronizer` share one theme vocabulary,
  storage key, custom event, system-media behavior, color scheme, and theme-color map.
- Theme changes synchronize between independent React consumers, same-document
  providers, system preference changes, and cross-tab storage events.
- A root skip link targets exactly one `#main-content` landmark per rendered shell.
- Route announcements use request/client locale copy for EN, PL, and DE rather than
  hard-coded English.
- Catalog verification includes WCAG 2.2 AA axe checks, keyboard-visible structure,
  console/hydration checks, horizontal-overflow checks, reduced motion, and forced
  colors.

The new Polish and German route labels require native-speaker copy review before a
future content freeze. That review is not a reason to guess or to block the structural
contract in this draft.

## Live inventory and ratchets

`docs/phase5/live-route-component-inventory.json` is generated from production modules
under `frontend/src/app`, `frontend/src/components`, and `frontend/src/design-system`.
It records resolvable local imports, inverse consumers, valid directive-prologue client
boundaries, the stable merge base, and a source fingerprint. It does not modify the
historical Phase 5 inventory.

Visual-debt ratchets classify exact path/value/count maxima for legacy `.card` and
`.input-field` usage, arbitrary shadow/radius/duration/animation/tracking recipes, and
`transition-all`. New categories, files, values, or higher counts fail. Removal and
lower counts pass.

## Guarded component catalog

`/dev/components` is open during local development. A production build exposes it only
when both `PHASE5A1_CATALOG=1` and `NEXT_PUBLIC_QA_MODE=1`. Normal production therefore
continues to return not found. The browser project also requires the guarded
local-authenticated visual-safety mode and inherited egress controls; service workers,
trace, screenshots, and video are disabled at the Playwright-project layer except for
the explicit candidate images written by the test.

The four stable scenes are:

1. foundations;
2. actions and forms;
3. overlays and navigation;
4. evidence and page states.

The capture matrix is 6 locale/theme/accessibility contexts × 3 widths (390, 768, and
1440) × 4 scenes = **72 candidate scene images**, plus contact sheets. These are review
candidates in `phase5a1-catalog-candidates`; they are never snapshot assertions and
never replace the immutable Phase 5A.0d baseline namespace.

Quality Gate and Nightly reuse their existing guarded local Supabase build/runtime,
preflight, deterministic fixture, safety assertion, teardown, and no-backup shutdown.
The candidate artifact uploads only after every safety and cleanup step succeeds.

## Verification

Local implementation checks required before the draft PR is pushed:

- deterministic token generation and `--check`;
- deterministic live-inventory generation and shrink-only ratchet tests;
- focused manifest, validation, contrast, foundation, theme, skip-link, catalog, and
  workflow-contract tests;
- complete unit suite, type-check, lint, and clean production build;
- exact byte hashes for all reviewed Phase 5A.0d PNGs and their manifest;
- diff/scope audit proving no dependency, lockfile, route policy, API/database,
  service-worker, Next config, or immutable-baseline mutation.

Completed local evidence on 2026-08-09:

- deterministic token generation/check and live-inventory regeneration passed;
- 41 focused design-system/inventory/catalog contracts passed;
- the integrated theme, provider, announcer, skip-link, root-layout, catalog, and
  workflow contracts are included in the passing complete suite;
- the complete frontend suite passed: 384 files passed, 1 skipped; 6,476 tests
  passed, 19 skipped;
- type-check, full source lint, scoped tooling/E2E lint, and `git diff --check`
  passed;
- the normal production build compiled all routes and generated the service worker;
- compiled CSS contains the four representative V2 utilities and both scoped token
  layers, while `bg-background` and `border-border` remain absent;
- all seven immutable baseline PNGs still match their manifest SHA-256 values and the
  manifest remains `B8504DA5DB591D82E1C6ADDE12B9A32DCDB766AC74633258ABA268F34DE3D1EC`;
- forbidden-scope inspection found no dependency lockfile, Next config, route policy,
  PWA source, API/database, or immutable-baseline change.

The guarded Windows catalog run was attempted once. It stopped at the fail-closed local
Supabase start because the Docker-backed runtime was unavailable, before any fixture,
build, server, or browser action. The matching no-backup stop found no usable runtime.
No hosted fallback or guard relaxation was used, so this document does not claim a local
browser pass.

The guarded catalog browser run, route-JavaScript comparison, immutable visual
verification, private PWA proof, Quality Gate, Lighthouse, CodeQL, Main Gate, and
SonarCloud remain exact-head CI acceptance evidence. This document must be updated with
their final run IDs and artifact checksums before 5A.1a is considered merge-ready.

## Deferred and rollback boundaries

- CSP currently permits the existing stable inline bootstrap. Nonce/hash hardening is
  a separate security task; this PR does not change `next.config.ts`.
- Candidate screenshots require human review. Automated checks cannot approve visual
  warmth, brand distinctiveness, evidence hierarchy, or editorial/app balance.
- Any unexplained immutable screenshot delta, route-JS regression over the existing
  budget, PWA privacy regression, or accessibility failure blocks merge. Baseline
  replacement is not an acceptable fix.
- The rollback boundary is the complete 5A.1a PR. Because production remains on the V1
  compatibility scope, reverting the PR requires no route migration cleanup.

5A.1b may begin only after this foundations PR is reviewed, its candidate catalog is
human-approved, and exact-head gates are green.
