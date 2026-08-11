# Phase 5A.1 — Design System V2 Foundations and Canonical Primitives

> **Last updated:** 2026-08-11
> **Status:** Phase 5A.1a is merged and green, and Eric explicitly approved its 90 foundation-candidate PNGs; Phase 5A.1b is implemented locally and remains subject to draft-PR review and exact-head evidence
> **Entry gate:** Phase 5A.1a merged through PR #1263 at `2c0bc9d2d8da49ea2518194925d3aa90d72796e4`; authoritative `main` entry SHA `296742c9b941e0aad9cfb5b00dfa3738af9eba0e` passed Main Gate, Sonar, CodeQL, hygiene, deployment, and post-deploy readiness before 5A.1b began

## Phase 5A.1 foundation decision

Eric approved the following bounded decisions for the direction-resilient Phase 5A.1
foundation—not as final production art-direction or identity approval:

- **Living Label** as the strongest current Design System V2 working hypothesis;
- oat/ivory light canvases and **warm-forest dark mode**;
- compact authenticated-application density, with more expressive public-page spacing;
- low elevation, restrained radii, and the existing TryVit mark retained provisionally;
- a **Manrope assay only**, with serif typography deferred;
- zero new runtime dependencies by default;
- exactly two official pull requests: foundations first, primitives and compatibility
  facades second. There is no Phase 5A.1c.

The mandatory Phase 5A.2 gate will compare up to three art directions and identity
systems and requires Eric's explicit final selection. Nothing in 5A.1 freezes Living
Label, the current mark, a type pairing, illustration language, or production-route
composition.

The intended character is warm, editorial, evidence-led, and trustworthy. It must not
become generic glass SaaS, neon health-tech, a wall of decorative cards, ornamental
motion, moralizing health language, or an interface where confidence and provenance
are visually weaker than a score.

## Phase boundary

### Included in 5A.1a

- one canonical typed token manifest and deterministic generator;
- generated CSS, TypeScript, and documentation artifacts;
- the V2 primitive-token layer, semantic roles, component recipe tokens, domain roles,
  and an exact V1 token compatibility layer;
- spacing, sizing, typography, radius, border, elevation, motion, z-index, and
  breakpoint foundations;
- theme bootstrap, explicit-theme Tailwind behavior, color-scheme metadata,
  forced-colors mappings, skip navigation, and localized route announcements;
- a live AST-backed route/component inventory with shrink-only visual-debt ratchets;
- a guarded `/dev/components` catalog foundation with four stable scenes and
  deterministic candidate capture evidence;
- scripts, CI wiring, tests, and documentation for those contracts.

### Implemented in 5A.1b

- canonical Button, IconButton, Surface, CardLink, Field, Combobox, Dialog, Sheet,
  Menu, Tabs, Tooltip, and PageState implementations;
- V1 component compatibility facades;
- interaction-heavy keyboard/focus contracts and their complete catalog scenes;
- typed interface-icon registry and provisional custom domain-glyph admission contract;
- symbol-aware compatibility-facade and transitive production-isolation evidence.

5A.1b deliberately relocates the five still-consumed V1 implementations behind exact
facades; it does not remove their visual debt or migrate their consumers. The relocation
ratchet prevents keeping both old and new debt-bearing copies or increasing a relocated
recipe.

Production routes and shells are not visually migrated in either part of 5A.1. This
PR changes only `/dev/components` presentation plus semantic accessibility landmarks.
It does not change route policy, APIs, database/Supabase behavior, service-worker
policy, Open Graph output, dependency manifests, Next/Vercel configuration, or the
reviewed Phase 5A.0d baseline images.

## Source hierarchy

For Phase 5 visual work, the master experience audit, Design System V2 blueprint,
implementation roadmap, this phase record, and the future
[`PHASE5A2_EXPERIENCE_ARCHITECTURE_GOLDEN_REFERENCE.md`](PHASE5A2_EXPERIENCE_ARCHITECTURE_GOLDEN_REFERENCE.md)
gate are the governing documents. The older brand guidelines remain authoritative for
current production-asset use while the mark is provisionally retained; their V1
palette/type guidance is historical. `DESIGN_REFRESH_SPEC.md` is a superseded planning
artifact, and `frontend/docs/DESIGN_SYSTEM.md` documents the V1 compatibility surface
rather than the V2 source of truth.

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

| Section       | Count | Purpose                                                          |
| ------------- | ----: | ---------------------------------------------------------------- |
| `primitive`   |   182 | Private `--ds-*` colors, spacing, sizing, type, motion, and more |
| `semanticV2`  |    59 | Living Label roles such as canvas, surface, content, and action  |
| `componentV2` |    28 | Component recipe tokens reserved for canonical V2 primitives     |
| `domain`      |    57 | Evidence, allergen, confidence, score, and regulated roles       |
| `compatV1`    |   126 | Existing production variables reproduced exactly                 |

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

## Canonical 5A.1b API and behavior freeze

The canonical API is documented in
[`frontend/docs/DESIGN_SYSTEM_V2_PRIMITIVES.md`](../frontend/docs/DESIGN_SYSTEM_V2_PRIMITIVES.md).
The freeze covers semantic props, state models, native/ARIA behavior, focus and Escape
rules, portal scoping, client/server ownership, and compatibility behavior. It does not
freeze the provisional Living Label recipes: Phase 5A.2 may restyle components through
semantic tokens, recipe CSS, icon mappings, and composition without rewriting their
public behavior.

- Button and IconButton are native buttons with safe `type="button"` defaults,
  localized loading names, real 44 px minimum targets, registry-only icons, and no
  manual Enter/Space handling.
- Surface and CardLink keep noninteractive container semantics fail-closed. CardLink
  requires exactly one direct primary anchor and at most one secondary action slot;
  concrete nested controls are rejected.
- Field keeps the non-empty localized label, external description, hint, count, and error IDREFs
  together. Input, Textarea, native Select, Checkbox, and native-checkbox Switch retain
  native required/disabled/read-only behavior; only indeterminate IDL synchronization
  is a client island.
- Combobox, Dialog, Sheet, Menu, Tabs, and Tooltip implement the relevant composite
  keyboard/focus contracts. Native modal dialogs own inertness and containment;
  nested popups portal into the nearest dialog host and only the top overlay handles
  dismissal. Dialog and Sheet admit native zero-order light-DOM focus scopes: positive
  `tabIndex`, HTML custom-element hosts, customized built-ins, and inspectable open shadow
  roots fail closed, while non-introspectable closed shadow roots are explicitly outside
  the supported composition contract. Popup geometry respects the effective mobile visual
  viewport, and checked menu state remains visible without relying on color.
- PageState is server-compatible and covers loading, empty, degraded, error, offline,
  paused, and recovering semantics with a caller-selected h1–h6 hierarchy, polite
  defaults, and explicit urgent opt-in.

Exactly six canonical primitive modules are explicit client entries: Combobox,
IndeterminateCheckbox, Menu, Overlay, Tabs, and Tooltip. Static primitives, Field
composition, Icon, and PageState remain server-compatible. No primitive barrel or root
provider was added, and production remains transitively isolated from the new V2 API.

The typed icon registry is the only new V2 Lucide import boundary. Icon names describe
meaning rather than a drawing, glyphs are inert, and custom `domain.*` entries require a
controlled repository implementation path, source, license, SHA-256, 24 px-grid review,
and forced-color review. The domain registry intentionally remains empty until a future
candidate is reviewed; 5A.1b changes no production identity artwork.

## Visual foundations

- Light mode uses oat and ivory canvases with forest actions and ink.
- Dark mode uses deep, warm forest canvases rather than neutral-black SaaS panels.
- Spacing follows a strict 4 px grid.
- App surfaces default to compact/focused gaps; public editorial scenes may use the
  expressive gap.
- Radii are limited to none, small, medium, large, label, and round.
- Elevation is limited to exactly four recipes: none, raised, overlay, and floating.
- The canonical Phase 5 transition durations are limited to **0, 120, 180, 240, 360,
  and 500ms**: 0ms for the final reduced-motion state; 120ms for direct feedback;
  180ms for hover/focus and disclosure/overlay exits; 240ms for disclosure entrances
  and determinate progress; 360ms for overlay entrances, section/evidence reveals, and
  spatial continuity; and 500ms exclusively for a future approved landing shared-label
  narrative. Four named easings and four displacement sizes remain the maximum;
  reduced-motion resolves every recipe immediately to its final information state.
- The existing mark is provisionally retained. This phase adds no illustration or
  photography asset and does not approve a final identity.

Forty-six named text and meaningful-UI pairs pass deterministic light/dark contrast
contracts. The minimum measured normal-text ratio is 4.716:1 in both themes; the
minimum meaningful UI/focus ratios are 3.432:1 in light and 3.710:1 in dark. The
exact-head rendered matrix at reviewed implementation head `72ff09fc` separately proves
system-color pairing, visible focus, shadow removal, and whole-page WCAG 2.2 Axe
compliance. The first candidate review exposed forced-color text loss in filled
specimens; the corrected matrix re-rendered all affected states and independent review
confirmed that the labels, mixed indicator, and localized locked fields are visible at
all three widths.

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

Serif typography is not adopted in Phase 5A.1. Phase 5A.2 must evaluate the complete
type system in rendered Golden References; this phase boundary is not permission to
omit an approved display/editorial role from the eventual production redesign.

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
Its bounded 393-record report is backed by a complete 498-module `frontend/src`
runtime graph so imports through libraries, hooks, and stores retain correct client and
route reachability. It records direct and inverse consumers, transitive route
consumers, client-entry/reachable/server boundaries, target redesign phases,
disposition, migration/removal gates, V1/V2 status, classified debt, the stable merge
base, and deterministic fingerprints. A fail-closed boundary audit rejects runtime
imports from production source into docs, E2E, tests, or tooling; the current report
contains zero violations. The Phase 5A.1b generated JSON SHA-256 is
`6569B98734BDD537B39DD76AAE5995CCCB3C8B37BE9FBD639ADE111D07562B3A`; its governed
source fingerprint is
`5112eb6e1d0f3772fa6b0b3e40a8c71e9feefaaa7daa35ff922400b08b35581a`, and its
runtime-boundary fingerprint is
`3f72087780be06b886cd94ce67f453ac43db938f7138111375dd4e8d5941791f`. The
historical Phase 5 inventory remains untouched.

Visual-debt ratchets classify exact path/value/count maxima for legacy `.card` and
`.input-field` usage, arbitrary shadow/radius/duration/animation/tracking recipes, and
`transition-all`. New categories, files, values, or higher counts fail. Removal and
lower counts pass. Generation resolves the actual checkout/CI merge base without network
access, reads its report directly from Git, and validates those independent maxima before
overwrite. The mutable worktree report cannot authorize its own provenance or debt, so
editing source and generated JSON together cannot bypass the ratchet.

Schema v3 also records six symbol-aware compatibility entries, five fixed V1
implementation relocations, and their exact direct/transitive consumers. Both baseline
and current debt paths normalize to the same historical maximum, making generation
idempotent while still rejecting a duplicated source/target value. Thirty-nine new V2
icon, pattern, and primitive modules have zero transitive consumers outside the guarded
catalog.

## Guarded component catalog

`/dev/components` is open during local development. A production build exposes it only
when both `PHASE5A1_CATALOG=1` and `NEXT_PUBLIC_QA_MODE=1`. Normal production therefore
continues to return not found. The browser project requires the guarded
local-authenticated visual-safety launcher/runtime and inherited egress controls.
Service workers, trace, automatic screenshots, and video are disabled at the
Playwright-project layer; only the explicit candidate images or sanitized failure
diagnostics written by the test are eligible for artifacts.

The four stable scenes are:

1. foundations and semantic roles;
2. action and form specimens;
3. interaction cues and feedback;
4. evidence semantics and status states.

The capture matrix remains 6 locale/theme/accessibility contexts × 3 widths (390, 768,
and 1440) = 18 cases. Each case captures the four stable scenes plus nine deterministic
open/selected interaction states: populated, loading, empty, and load-error Comboboxes,
then Dialog, Sheet, Menu, Tabs, and Tooltip. Every case also retains a reviewable
text-spacing capture, and the six 768 px cases retain a reviewable 200% zoom capture.
That yields **72 base scenes + 162 interaction states + 24 resilience states + 36 contact
sheets = 294 PNGs**. A sanitized 18-record `evidence.json` ledger and exact manifest
bring the artifact to 296 files. The verifier requires the precise path matrix, PNG
signatures, byte sizes,
SHA-256 values, source SHA/tree/PR-head provenance, clean or explicitly known Next-build
source state, and no symlinks or extra files.

The contexts include explicit light/dark, system-dark, forced colors, reduced motion,
fine/hover and coarse/no-hover input, and fully localized representative EN/PL/DE copy.
Thirty-five evidence checks per case cover default and open-state WCAG 2.2 Axe, the
Combobox loading/empty/error status contracts, keyboard
operation, bidirectional modal containment, restoration, roving focus, nested portal
scope, outside/pointer behavior, actual 44 px targets, focus visibility, overflow,
200% reflow, text spacing, forced colors, reduced motion, system theme, and RTL/LTR
Switch endpoints. These are candidate captures, never snapshot assertions, and never
replace the immutable Phase 5A.0d baseline namespace.

The Dialog and Sheet journeys additionally exercise nested Menu and ready Combobox
content inside each exact modal host, explicit-ref and default-heading focus entry,
one-Tab boundary containment, and popup-only Escape without changing the fixed artifact
or evidence-check counts.

Text-spacing and zoom checks audit hidden/clip boundaries, sibling text intersections,
visible-point obscuration, and document/component overflow before writing their named
altered-state PNGs. Those automated screens remain paired with mandatory human review;
they do not claim that layout quality can be approved from geometry alone.

Quality Gate and Nightly reuse their existing guarded local Supabase build/runtime,
preflight, deterministic fixture, safety assertion, teardown, and no-backup shutdown.
Candidate verification requires the exact source SHA/tree, 294 PNG hashes, evidence
ledger, manifest, and safe paths before upload; the artifact remains gated on every
visual-safety, fixture-cleanup, and no-backup shutdown step. Sanitized failure
diagnostics are uploaded separately only after the same guards.

## Future Phase 5A.2 governance — not implemented here

Phase 5A.1 remains exactly two official PRs. The approved 5A.1a artifact's 72 scene
images and 18 contact sheets, plus 5A.1b's expanded 294-PNG interaction and resilience
catalog, are foundation candidates only: none is a Golden Reference or an approved
production baseline.
After 5A.1a and 5A.1b are reviewed, merged, and green on authoritative `main`, a
separately authorized non-production Phase 5A.2 must:

- compare up to three original art directions and up to three coherent identity
  systems, with Living Label and the current mark treated as provisional;
- complete landing, authentication, authenticated home, search, product/evidence, and
  scanner Golden References with responsive, theme, state, content, full-motion, and
  reduced-motion evidence;
- receive two independent fresh-context reviews and meet the 100-point rubric, 88-point
  threshold, category floors, veto rules, and Eric's explicit approval defined in the
  Golden Reference contract.

Phase 5A.2 does not migrate production routes or replace production identity assets.
Production redesign begins in Phase 5A.3+. No active user-facing route may be left
“intentionally retained” or “deferred” when Phase 5 is declared complete: it must be
redesigned on the approved V2 system or removed from the product.

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

Phase 5A.1a completed local evidence on reviewed implementation head
`72ff09fc515dcfc1e597d5c49861ebd063348fd5` on 2026-08-10:

- deterministic token generation/check and live-inventory regeneration passed;
- 46 focused design-system/inventory/catalog contracts passed;
- the integrated theme, provider, announcer, skip-link, root-layout, catalog, and
  workflow contracts are included in the passing complete suite;
- the complete frontend suite passed: 384 files passed, 1 skipped; 6,481 tests
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

The local Windows browser harness was not used as acceptance evidence. No hosted
Supabase fallback or guard relaxation was used. Authoritative browser evidence was
produced by the guarded Linux CI lifecycle against the reviewed implementation head.

### Authoritative implementation evidence — 2026-08-10

The following evidence is bound to exact PR head
`72ff09fc515dcfc1e597d5c49861ebd063348fd5`. GitHub's reviewed merge ref was
`5425db67fdd5e4a64deefc1cf92cf35069149063`, with tree
`34a968bb2b4862001c7d17de5075e02d1b01695b` and the exact base/head parents.

- PR Gate run `31360260505`, CodeQL run `31360260489`, and GHAS check
  `93367817478` passed; both repository and branch open-alert counts were zero.
- Main Gate run `31360596638` passed exactly once. Sonar analyzed SCM revision
  `72ff09fc515dcfc1e597d5c49861ebd063348fd5`: reliability, security, and
  maintainability were A; coverage was 91.2%; duplication was 1.384802947%; and
  security hotspots reviewed were 100%.
- Quality Gate run `31360260503` passed the public and guarded local-authenticated
  lifecycles, all 18 catalog cases, safety assertions, fixture teardown, and no-backup
  runtime shutdown. Candidate artifact `9052264601` has archive SHA-256
  `e9561d4fe6d5005866c92415324efb4ee5973681216112b455c1994d925c89f4` and
  manifest SHA-256
  `dac764820b051669460f5535b52110a5a3a82c1339983169ad6b8be1abcc2866`.
  Independent verification confirmed the exact 72 scene images plus 18 contact sheets,
  including every manifest path, byte size, PNG signature, and content hash.
- Immutable visual run `31360260484` passed all five public and three authenticated
  comparisons without changing the Phase 5A.0d baselines or producing a diff artifact.
- Route-JavaScript run `31360260483` passed all five fail-if-either regression guards.
  Artifact `9052265939` has archive SHA-256
  `6007a527e4d4df425e66ac18672dabfcadca5bf88cc1c1a1b5491619609d08c1`.
- Lighthouse run `31360260491` attempt 1 stopped before authenticated measurement on a
  bounded local-auth token-response wait; it produced no incomplete evidence and all
  cleanup gates passed. The single authorized unchanged-SHA retry, attempt 2, passed all
  10 route/profile rows with five runs each, zero blocking failures, and zero instability
  failures. Artifact `9052744518` has archive SHA-256
  `9b341e7cbea58917964d8af1de68fafb91b63e422491fa7f707cf592c03d09b4`
  and report checksum
  `47c704cac34af57b761243f933745772b709dec1d46b92e467a03fa35d279af4`.
- Dependency audit, license compliance, repository hygiene, title checks, and the exact
  Vercel preview status passed. Hosted preview endpoints were not accessed.

All 18 contact sheets and the relevant individual forced-color and localized scene
images were reviewed after correction. No remaining clipping, overlap, contrast,
localization, dark/system-dark, or reduced-motion endpoint defect was found. Eric then
explicitly approved the Phase 5A.1a foundation candidates and authorized PR #1263's
merge and the guarded start of 5A.1b.

This evidence records the stable implementation and candidate bytes. The draft PR body
is the non-self-referential source for the moving final-head rollup because embedding a
final commit SHA in versioned source would itself create another SHA. Every actual final
PR head still required a green exact-head rollup; that final rollup and exact-main
verification passed before the approval and merge recorded at the top of this document.

### Phase 5A.1b local pre-push evidence — 2026-08-11

The settled Phase 5A.1b worktree passed the following checks before the current draft
PR head was pushed. These results are local implementation evidence, not a substitute
for the required exact-head Linux catalog, visual, performance, security, and
integration runs:

- token artifacts passed deterministic `--check`;
- the live inventory generated twice to the identical SHA-256
  `6569B98734BDD537B39DD76AAE5995CCCB3C8B37BE9FBD639ADE111D07562B3A`;
  it records 393 governed modules, 498 inspected runtime modules, zero forbidden
  boundaries, six symbol-aware compatibility entries, five controlled relocations,
  and zero V2 route consumers outside `/dev/components`;
- `npm run design-system:check` passed 23 files and 185 tests, and the transitive
  architecture contract passed its additional 6 tests;
- the complete frontend suite passed 401 files with 1 skipped and 6,628 tests with
  19 skipped;
- TypeScript, full source lint, scoped E2E/tooling/test lint, and `git diff --check`
  passed;
- a normal production build with both catalog flags absent compiled all routes and
  generated the service worker;
- an independent local contract/checksum/file-byte recheck passed all seven immutable
  Phase 5A.0d cases; the authoritative renderer comparison remains intentionally limited
  to exact-head Linux CI. The manifest file SHA-256 remains
  `B8504DA5DB591D82E1C6ADDE12B9A32DCDB766AC74633258ABA268F34DE3D1EC` and its internal checksum remains
  `12a00dc37191191b788964d1c599d103aa0fedb1c15fa8cc36ad80d746953716`;
- the diff contains no dependency/lockfile, Next configuration, global token/theme,
  route-policy, API/database, service-worker, root-layout, or immutable-baseline change.

The guarded 18-case browser matrix was intentionally not treated as local Windows
acceptance evidence. Its 294 PNGs, 18-record/35-check ledger, exact manifest, safety
lifecycle, and independent human review remain blocking exact-head CI evidence.

## Deferred and rollback boundaries

- CSP currently permits the existing stable inline bootstrap. Nonce/hash hardening is
  a separate security task; this PR does not change `next.config.ts`.
- Candidate screenshots require human review. Automated checks cannot approve visual
  warmth, brand distinctiveness, evidence hierarchy, or editorial/app balance.
- Any unexplained immutable screenshot delta, route-JS regression over the existing
  budget, PWA privacy regression, or accessibility failure blocks merge. Baseline
  replacement is not an acceptable fix.
- The 5A.1a foundation remains an independent merged boundary. The current rollback
  boundary is the complete 5A.1b primitives/facades/catalog PR; because production
  remains V1 and facade entry paths are unchanged, reverting it requires no route
  migration cleanup.

That 5A.1b entry gate was satisfied: PR #1263 merged, its approved tree passed exact-main
verification, Eric explicitly approved the foundation candidates, and 5A.1b branched
from the later verified `main` tip recorded above. Phase 5A.2 may begin only after the
5A.1b draft is independently reviewed, explicitly approved by Eric, merged, and green
on authoritative `main`; this record does not authorize or claim any Golden Reference
work.
