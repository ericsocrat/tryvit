# Phase 5 Design System Blueprint

> **Last updated:** 2026-08-10
> **Status:** Active target architecture — Phase 5A.1a foundations are recorded in `PHASE5A1_DESIGN_SYSTEM_FOUNDATIONS.md`
> **Owner issue:** Frontend domain

## Purpose

This document defines a direction-resilient Design System V2 architecture using
**Living Label** as the strongest current working hypothesis. It is not final approval
of the art direction, typography, iconography, imagery, or identity; the current mark
is also provisional. Phase 5A.2 must challenge and approve those decisions through the
non-production Golden Reference gate before production routes migrate. Existing
components remain available through compatibility facades and migrate route by route
only after that approval.

The system must support two expressions of the same brand:

- an expressive, editorial public experience;
- a focused, information-dense authenticated decision workspace.

Both use the same semantic tokens, evidence language, accessibility primitives, typography, icon rules, motion grammar, and responsive foundations.

## Current-system assessment

### Audited baseline inventory

| Measure | Audit-baseline result |
|---|---:|
| Production component modules | 181 |
| Client production components | 99 / 181 (54.7%) |
| All production TSX files | 291 |
| Client-boundary production TSX | 166 / 291 (57.0%) |
| Light-theme root tokens | 126 |
| Color tokens | 79 |
| Spacing tokens | 10 |
| Type-size tokens | 7 |
| Radius tokens | 5 |
| Shadow tokens | 3 |
| Motion/easing/transition tokens | 11 |

These figures describe the original master-audit snapshot and remain useful as the
migration baseline; they are not a claim that the working tree has remained static. The
historical component disposition is recorded in
[`phase5/route-component-inventory.json`](phase5/route-component-inventory.json). The
current deterministic dependency, route-reachability, boundary, disposition, and debt
report is [`phase5/live-route-component-inventory.json`](phase5/live-route-component-inventory.json).

### Findings that shape V2

1. **Semantic utility registration is incomplete.** Semantic-looking classes such as `border-border`, `border-strong`, `border-default`, and `bg-background` are used hundreds of times while Tailwind namespace mappings are absent or mismatched. Components cannot rely on names that may not compile to the intended declarations.
2. **The contrast contract is weaker in tests than in documentation.** Documentation promises 4.5:1 normal-text contrast, while a general test accepts 2:1. Current examples such as `#22c55e` success text on white (2.28:1) and `#ef4444` error text on white (3.76:1) fail AA for normal text.
3. **Primitive adoption is partial.** The shared `Card` appears four times across three files while the legacy `.card` pattern appears across roughly 62 files. Raw controls remain common, and several documented form primitives are nearly unused outside the development catalog.
4. **Visual values drift.** There are 87 arbitrary-shadow uses across 45 recipes, 713 radius uses across nine forms, 38 explicit-duration uses, ten arbitrary animations, 21 arbitrary-tracking uses across eight values, and 32 `transition-all` declarations.
5. **Semantic typography is not consumed.** A type-role module exists but has no production import; no production font contract gives TryVit a recognizable voice.
6. **Navigation is duplicated.** Desktop sidebar, desktop header, mobile navigation, and More drawer own independent destinations and active-state behavior.
7. **The visual system spans several eras.** Landing glass/glow, editorial legal/Learn shells, compact auth, and utility app cards do not express one product.

## Design-system principles

1. **Truth before decoration.** A beautiful state cannot overstate evidence or certainty.
2. **Semantic roles before palette values.** Components consume meaning, not raw color names.
3. **Information has a reading order.** Product identity → conclusion → confidence/source → detail → action.
4. **One primitive owns one interaction contract.** Dialog, Sheet, Menu, Tabs, Tooltip, Combobox and CardLink are not reimplemented per route.
5. **Density changes, identity does not.** Public and app surfaces may differ in spacing, but not in type, status semantics, motion or tone.
6. **Motion explains causality and place.** It never hides critical content or delays access.
7. **Localization and accessibility are architecture.** EN, PL and DE, keyboard, screen-reader, reflow, reduced-motion and high-contrast behavior are designed together.
8. **Migration ratchets forward.** Legacy exceptions are recorded and can only shrink.

## Proposed source architecture

```text
frontend/src/design-system/
  tokens/
    manifest.ts           # canonical typed token data
    primitives.css        # generated private numeric/palette scales
    semantic.css          # generated public roles used by layouts/components
    themes.css            # generated light/dark/high-contrast adaptations
    domain.css            # generated score/nutrition/allergen/confidence roles
    motion.css            # generated durations/easing/reduced-motion policy
  foundations/
    typography.ts         # semantic text roles and numeric styles
    layout.ts             # containers, grids, density and safe areas
    elevation.ts          # named surface levels
    breakpoints.ts        # shared responsive contract
    z-index.ts            # stacking contract
  primitives/
    Button/
    IconButton/
    Surface/
    Link/
    CardLink/
    Field/
    Input/
    Select/
    Textarea/
    Checkbox/
    Switch/
    Badge/
    Alert/
    Skeleton/
    Progress/
    Meter/
    Toast/
    Tooltip/
    Dialog/
    Sheet/
    Menu/
    Tabs/
    Combobox/
  patterns/
    PageShell/
    PageHeader/
    Section/
    StatusBanner/
    PageState/
    Metric/
    FormSection/
    BottomSheet/
    Disclosure/
  domain/
    ProductCard/
    ProductMedia/
    ScoreBadge/
    ScoreTrendChart/
    NutriScoreBadge/
    NutritionSignal/
    NutritionMetric/
    IngredientEvidence/
    AllergenEvidence/
    ConfidenceBadge/
    ProvenanceLedger/
    ComparisonMeasure/
  marketing/
    LivingLabelDemo/
    EvidenceStory/
    CoveragePanel/
    MethodologySummary/
  shell/
    route-manifest.ts
    PublicShell/
    AuthShell/
    AppShell/
    ShareShell/
  motion/
    Reveal/
    Presence/
    SharedProductTransition/
  accessibility/
    LiveRegion/
    RouteAnnouncer/
    SkipLink/
```

Existing `frontend/src/components/common/*` modules should initially become compatibility facades over V2 primitives. A route migration may not delete a facade until all imports are moved and tests prove behavior parity.

## Token architecture

### Required hierarchy

```text
private primitive token
  → semantic role token
    → component token
      → rendered component state
```

Example:

```css
/* Primitive: never consumed by a component. */
--ds-forest-700: #175c3b;

/* Semantic: theme-adjusted meaning. */
--color-action-primary: var(--ds-forest-700);

/* Component: local contract. */
--button-primary-background: var(--color-action-primary);
```

Rules:

- Prefix private primitives with `--ds-*` to avoid self-referential Tailwind aliases.
- Map public semantic colors through the correct Tailwind `--color-*` namespace using `@theme inline`.
- A component may use a semantic token directly only if no component-specific state exists.
- Every status family supplies foreground, surface, border and icon values; a single fill color cannot double as readable text.
- Domain-regulated palettes such as Nutri-Score remain separate from general success/error feedback.
- A token schema test must verify existence, theme parity, forbidden cycles and compiled utility output.

`tokens/manifest.ts` is the single source of truth. A deterministic generator emits the CSS layers, TypeScript token-name/types and `docs/assets/design-tokens.json`. CI regenerates to a temporary directory and fails on drift; hand-editing generated outputs is forbidden. Breakpoint, z-index and motion exports consume the same manifest rather than repeating numeric values.

### Primitive layers

| Layer | Contents | Rule |
|---|---|---|
| Color | Forest, oat, neutral, blue, amber, red, green and violet ramps | Private; no component import |
| Space | 0, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24 | 4px base; exceptions documented |
| Size | control, icon, avatar, media and container scales | No arbitrary control heights |
| Radius | none, small, medium, large, label, round | Remove 2xl/3xl/4xl drift unless explicitly exempt |
| Border | hairline, standard, strong, focus | Theme-aware non-text contrast |
| Shadow | none, raised, overlay, floating | Four recipes replace 45 arbitrary recipes |
| Opacity | disabled, muted, overlay, scrim | Never reduce essential text below contrast |
| Type | font families, sizes, weights, line heights, tracking | Semantic roles consume them |
| Motion | duration, easing, displacement | Transform/opacity first |
| Z-index | base, sticky, dropdown, overlay, modal, toast | No arbitrary z values |
| Breakpoint | compact, medium, wide, canvas | CSS and test fixtures share one source |

### Semantic layers

- Canvas: `canvas`, `canvas-subtle`, `canvas-inverse`.
- Surface: `surface-1`, `surface-2`, `surface-raised`, `surface-overlay`, `surface-selected`.
- Content: `content-primary`, `content-secondary`, `content-muted`, `content-inverse`, `content-link`.
- Border: `border-subtle`, `border-default`, `border-strong`, `border-focus`.
- Action: primary/default/hover/pressed/disabled; secondary; destructive.
- Feedback: success, warning, error, info, neutral—each with text/surface/border/icon roles.
- Domain: score bands, Nutri-Score, NOVA, nutrition levels, allergen evidence, confidence, provenance.
- Interaction: hover, pressed, selected, dragged, focus-visible, disabled, read-only.
- Density: expressive public, focused app, compact data table.

### Theme bootstrap contract

1. An explicit saved user choice (`light`, `dark` or `system`) wins; `system` follows `prefers-color-scheme`; light is the final deterministic fallback.
2. `ThemeScript` applies `data-theme` and the matching `color-scheme` before first paint, using the repository’s CSP-safe nonce/hash strategy.
3. A complete CSS `prefers-color-scheme` fallback—not only logo swapping—keeps light/dark variables usable when JavaScript is unavailable.
4. Changing the OS theme updates a `system` choice but never overwrites an explicit light/dark choice.
5. `forced-colors: active` uses system colors for text, borders, focus and controls; decorative textures/shadows disappear and domain states retain text/icon labels.
6. Unit and first-paint browser tests cover saved choice, system change, no-JavaScript fallback, hydration parity and no theme flash.

### Living Label base palette

These are candidate semantic pairings, validated mathematically for normal-text contrast. Rendered components, borders, icons and dark-mode combinations still require automated and visual validation.

| Role | Light foreground / surface | Contrast | Dark foreground / surface | Contrast |
|---|---|---:|---|---:|
| Primary ink | `#17251D` / `#F7F3E8` | 14.36:1 | `#F7F3E8` / `#10261B` | 14.40:1 |
| Brand text/action | `#175C3B` / `#F7F3E8` | 7.20:1 | `#B7E4C7` / `#10261B` | 11.36:1 |
| Muted content | `#475467` / `#F7F3E8` | 6.93:1 | `#D0D5DD` / `#10261B` | 10.83:1 |

Brand green may be used as a filled action background only with a tested inverse foreground. It is not automatically a success, health, allergen or “good food” signal.

## Allergen and evidence state system

Phase 5 Preflight A is the source-of-truth semantic contract. It has **five display statuses** and an orthogonal evidence basis. V2 must not flatten provenance into a sixth status, because a legacy-unclassified row can be either `contains` or `may_contain`.

| Display status | Meaning | Candidate light pair | Contrast | Candidate dark pair | Contrast | Icon/shape | Required wording behavior |
|---|---|---|---:|---|---:|---|---|
| Contains | Positive `contains` evidence; basis may be explicit or legacy-unclassified | `#B42318` on `#FEE4E2` | 5.45:1 | `#FECDCA` on `#55160C` | 9.82:1 | stop/octagon + filled marker | “Contains”; show basis/source when known |
| May contain | Positive trace/cross-contact evidence; basis may be explicit or legacy-unclassified | `#7A2E0E` on `#FEF0C7` | 8.32:1 | `#FEDF89` on `#4E1D09` | 10.73:1 | warning triangle + dashed edge | “May contain”; show basis/source when known |
| Deterministic derived | A governed ingredient relationship produces positive `contains` evidence | `#1849A9` on `#D1E9FF` | 6.55:1 | `#B2DDFF` on `#102A56` | 9.87:1 | linked nodes + solid edge | “Derived from ingredient”; never present as a source declaration |
| Unknown/unavailable | No evidence supports presence or absence | `#475467` on `#F2F4F7` | 6.98:1 | `#D0D5DD` on `#344054` | 7.10:1 | question mark + neutral rule | “Evidence unavailable/unknown”; never green |
| Future assessed absent | Reserved for authoritative negative evidence | `#067647` on `#D1FADF` | 5.00:1 | `#A6F4C5` on `#054F31` | 7.55:1 | shield-check + double rule | “Assessed absent”; provenance mandatory |

| Evidence basis | Applies to | Presentation modifier |
|---|---|---|
| `explicit_source` | Contains or may-contain | Show the declaration source when available. |
| `ingredient_derived` | Deterministic derived contains evidence | State that evidence came from a governed ingredient relationship. |
| `legacy_unclassified` | Contains or may-contain | Preserve the positive type and add “provenance unavailable”; never collapse may-contain into generic presence. |

The current API exposes no authoritative per-allergen absence source or assessment date. Assessed-absence presentation is therefore **blocked** until a separately reviewed database/API contract supplies authoritative evidence, source, scope, assessment time and provenance. Phase 5 UI work may retain a reserved type and fixture for compatibility, but it must not generate production assessed-absence records or imply that this backend contract already exists.

Non-negotiable rules:

1. Unknown is visually neutral and structurally different from assessed absence.
2. Empty arrays, nulls and zero counts never map to absence.
3. “Allergen-Free” does not return without authoritative assessed-absence data, provenance and approved language.
4. Color is never the only indicator; label, icon/shape and provenance accompany it.
5. Explicit and derived evidence stay distinguishable in summaries, details, search and comparison.
6. EN, PL and DE convey equivalent confidence and instruction.
7. Every allergen view states that the package label is the final safety reference.
8. Future assessed absence cannot be synthesized for compatibility with a green UI.

## Typography

### Candidate families

- **Primary UI:** Manrope variable, Latin + Latin Extended.
- **Optional display/editorial:** Source Serif 4 variable, used only for marketing headlines, editorial pull statements and selected evidence-story moments.
- **Fallback:** `Manrope, "Segoe UI", Arial, sans-serif`; display falls back to `Georgia, "Times New Roman", serif`.

This unadopted pairing may balance approachable consumer utility with editorial
credibility, but Phase 5A.2 must compare it in the complete identity and Golden
References. It must be tested with Polish diacritics, German compounds, tabular figures
and bold weights before any selection. If the font transfer budget cannot be met, use
the system stack until a compliant subset is available. No dependency is added by this
blueprint.

Phase 5A.1 keeps Manrope assay-only and adopts neither family. Serif selection and the
complete production type pairing are deferred to the non-production Phase 5A.2 Golden
Reference gate and Eric's explicit approval.

Delivery contract:

- use Next.js build-time font handling or checked-in licensed WOFF2 assets; never request a third-party font host at runtime;
- include Latin and Latin Extended glyphs, then verify the complete EN/PL/DE character set in CI;
- preload only the primary UI face needed above the fold; load the optional display face without delaying first render;
- use `font-display: swap` or `optional` based on measured layout behavior;
- apply metric-compatible fallbacks/size adjustment to keep CLS within budget;
- include all transferred font files in the 100KiB total font budget.

### Semantic roles

| Role | Compact / wide | Line height | Weight | Notes |
|---|---|---:|---:|---|
| Display hero | clamp 40–72px | 0.98–1.05 | 550–650 | Optional serif; max 12 words |
| Page title | 30–44px | 1.1 | 650–700 | One per page |
| Section title | 24–32px | 1.2 | 650 | Short editorial rhythm |
| Card title | 18–22px | 1.3 | 650 | Avoid every card becoming a heading |
| Body large | 18–20px | 1.55 | 400–500 | Marketing explanation |
| Body | 16–18px | 1.5 | 400–500 | Never below 16px for primary copy |
| Label | 13–15px | 1.35 | 600 | Sentence case |
| Meta | 12–14px | 1.4 | 500 | Must retain 4.5:1 when meaningful |
| Numeric display | 28–56px | 1.0 | 650 | Tabular figures; visible unit/context |
| Data row | 14–16px | 1.35 | 500 | Tabular numeric variant |

Rules:

- Use tabular numerals for scores, nutrient tables, percentages and comparisons.
- Do not compress German or Polish labels with negative tracking.
- Avoid all-caps for localized functional labels.
- Preserve at least 44-character and at most roughly 75-character readable line lengths for prose.
- Text remains usable at 200% zoom and with WCAG text-spacing overrides.

## Component taxonomy and disposition

### Migration totals

| Disposition | Count | Meaning |
|---|---:|---|
| Retain | 10 | Keep structure/behavior; inherit tokens |
| Restyle | 91 | Stable domain behavior; migrate visual contract |
| Refactor | 55 | Correct or consolidate API/interaction before restyling |
| Merge | 7 | Move into a canonical equivalent |
| Split | 13 | Separate oversized or multi-responsibility component |
| Deprecate | 4 | Remove after consumers migrate |
| Replace | 1 | Substitute a new domain pattern |
| **Total** | **181** | Mutually exclusive classification |

The historical JSON is the complete mutually exclusive audit taxonomy; it is not a
generated import graph. Phase 5A.1a adds the separate deterministic
[`phase5/live-route-component-inventory.json`](phase5/live-route-component-inventory.json),
which records direct and inverse consumers, transitive route consumers, client-entry and
reachable boundaries, target phases, disposition, migration/removal gates, V1/V2
status, and classified debt. That live report must remain green before any compatibility
facade is deleted.

Notable decisions:

- Retain structural utilities such as `LiveRegion`, `RouteAnnouncer`, `RouteGuard`, hydrators, `GlobalKeyboardShortcuts`, `Providers`, `CachedTimestamp`, and `ThemeScript`; improve their locale/provider contracts in the owning phase.
- Merge `SubmitButton` into `Button`, two tooltip implementations into one, `SectionError` into canonical `Alert` plus the `PageState` error composition, `CompareCheckbox` into `Checkbox`, `HealthInsightsSummary` into `HealthInsightsPanel`, and `ScoreSparkline` into the shared score-trend/chart primitive.
- `NutrientTrafficLight` becomes the canonical `NutritionSignal` primitive. `TrafficLightChip` and `TrafficLightStrip` remain domain compositions that consume it rather than reimplementing thresholds and colors.
- Split `ComparisonGrid`, `CommandPalette`, `MoreDrawer`, `ImageCapture`, `AddToListMenu`, `HealthWarningsCard`, `ImageLightbox`, `ScoreBreakdownPanel`, `ScanResultView`, `FilterPanel`, `SearchAutocomplete`, `HealthProfileSection`, and the shared error boundary.
- Deprecate `AchievementBadge`, `OnboardingIllustration`, `NovaDistribution`, and `SwapSavingsBadge` after usage and product-value review.
- Replace `CategoryPlaceholder` with one `ProductMedia` fallback system.

### Canonical interaction contracts

| Primitive | Required behavior |
|---|---|
| Button / IconButton | native semantics, loading/disabled parity, visible focus, 44px target, label-in-name |
| CardLink | sibling actions; stretched link without nested interactive descendants |
| Dialog / Sheet | modal semantics, initial focus, containment, Escape, labelled title, trigger restoration, scroll lock |
| Menu | arrow keys, Home/End, Escape, typeahead where useful, trigger restoration |
| Tabs | tablist/tab/tabpanel relationships, roving tabindex, arrow/Home/End behavior, persistent URL where appropriate |
| Tooltip | hover and focus, dismissible, persistent, no essential hidden-only content |
| Combobox | input/listbox relationships, active descendant or managed focus, keyboard selection, announcement |
| PageState | loading, empty, degraded, error, retry and paused variants with one content hierarchy |
| Field | visible label, help, inline error, summary linking, autocomplete and input-purpose support |

## Route and navigation architecture

One typed route manifest should own:

- path and active matcher;
- public/auth/admin policy;
- parent destination;
- translation key and route-announcement label;
- breadcrumb and metadata policy;
- indexability and sitemap eligibility;
- loading/error archetype;
- screenshot fixture and readiness status.

Authenticated primary destinations remain stable at all breakpoints:

1. Home
2. Discover
3. Scan
4. Saved

Explore, Profile and Labs are secondary. Compare is a contextual workspace/tray. Admin is role-gated. Product, ingredient and category detail activate Discover; list/watchlist/saved pages activate Saved; scan result/history/submission activate Scan.

These are grouping labels, not new URLs:

- Home → `/app`.
- Discover → `/app/search`, `/app/categories`, category detail, product detail and ingredient detail.
- Scan → `/app/scan`, result, history, submit and submissions.
- Saved → `/app/lists`, list detail, watchlist, saved search and saved comparison.
- Explore → `/learn/**` and `/app/recipes/**`.
- Profile → `/app/settings/**` and `/app/achievements`.
- Labs → `/app/image-search`.
- Compare → `/app/compare` as a contextual tray/workspace.
- Admin → `/app/admin/**`, visible only after the role policy authorizes it.

## Layout and responsive system

| Range | Intent | Default behavior |
|---|---|---|
| 0–479px | compact phone | one column, 16px gutters, bottom navigation, sheets |
| 480–767px | large phone/small tablet | one column with wider media and selective two-up groups |
| 768–1023px | tablet | adaptive rail or compact header; two-column evidence where useful |
| 1024–1279px | desktop | persistent shell, 12-column content grid |
| 1280px+ | wide canvas | capped reading width; data workspace can expand intentionally |

Rules:

- Test 320, 375/390, 768, 1024, 1280 and 1440 widths.
- Never force orientation.
- Sticky headers and bottom navigation must not obscure focused controls.
- Public expressive sections cap prose width independently of the media canvas.
- Product and comparison content prioritizes reading order over equal-height cards.
- Container queries may be recommended later only after existing CSS can justify their maintenance benefit; no dependency is required.

## Motion system

### Principles

1. Direct manipulation feedback is fastest.
2. Navigation establishes spatial continuity.
3. Evidence reveals in reading order.
4. Loading motion suggests structure, not fake progress.
5. Reduced motion removes movement, not information.

### Tokens

| Token | Target | Use |
|---|---:|---|
| instant | 0ms | reduced-motion substitution, state reset |
| feedback | 120ms | press, check, icon state |
| fast | 180ms | hover/focus response, disclosure exit, overlay exit |
| standard | 240ms | disclosure entrance, determinate progress |
| deliberate | 360ms | overlay entrance, section/evidence reveal, spatial continuity |
| narrative max | 500ms | landing shared-label transition only |

These are the only approved transition durations: **0, 120, 180, 240, 360, and
500ms**. Use 120ms for press/direct-manipulation and icon-state feedback; 180ms for
hover/focus response and disclosure or overlay exits; 240ms for disclosure entrances
and determinate progress; and 360ms for overlay entrances, section/evidence reveals,
and spatial continuity. The 500ms duration is reserved exclusively for an approved
landing narrative; no authenticated, scanner, system, or general component transition
uses it. Determinate progress uses the 240ms standard duration and linear-progress
easing tied truthfully to work rather than a decorative fixed-duration loop. Use
standard, emphasized-decelerate, emphasized-accelerate and linear-progress easing
roles. Avoid `transition-all`.

### Performance constraints

- Animate only transform and opacity by default.
- No layout-shifting entrance.
- No large animated blur/filter surface.
- No animation-attributable task over 50ms in the target lab profile.
- Target 60fps; gracefully reduce density on lower-power devices.
- Intersection observers disconnect after one-shot reveals.
- No critical content waits for JavaScript animation to become visible.
- `prefers-reduced-motion: reduce` renders the final state immediately; behavioral tests cover it separately.

## Icons, photography and illustration

The accessibility, licensing, performance, and library-discipline rules below are
architectural. Living Label-specific stroke, texture, and illustration choices are
working candidates until Phase 5A.2 approves the complete identity and art direction.

### Icons

- Retain Lucide as the default library during migration; do not add a second general icon library.
- Standard sizes: 16, 20, 24 and 32px; 1.75–2px rounded stroke; optical alignment tested in controls.
- Icons never replace a required text label.
- Custom icons are limited to TryVit-specific concepts: barcode/scan, provenance/source, ingredient relationship, evidence unknown, package-label reference and confidence.
- Status icons pair with text and shape; allergen states must remain distinguishable in monochrome.

### Product imagery

- Prefer genuine product packaging where source/licensing permits; preserve source attribution.
- Use `next/image`, stable aspect ratios, responsive `sizes`, and optimized AVIF/WebP.
- Never crop away a label detail required to identify a product.
- `ProductMedia` owns missing, loading, error, user-submitted and source-badge states.
- The fallback uses the approved direction's restrained illustration language—not
  category emoji or a falsely realistic package. Living Label line work is the current
  candidate, not a frozen production decision.

### Food photography and illustration

- Photography supports editorial/educational context, not an unsupported freshness or “natural equals healthy” halo.
- Prefer ingredients, label materials and grocery context over aspirational lifestyle bodies.
- Illustration uses precise lines, paper texture and limited color; no childish mascot system.
- Empty-state art is optional and never displaces the recovery action.

## Accessibility standard — WCAG 2.2 AA

Automated tools support but do not prove conformance. Each phase must document automated and manual results.

### Acceptance checklist

- [ ] One `main`, one visible or programmatic `h1`, logical heading order and named landmarks.
- [ ] Skip link reaches main content and remains visible on focus.
- [ ] Page title, route announcement and `html[lang]` match EN/PL/DE content.
- [ ] Every function works with keyboard alone; no nested interactive controls.
- [ ] Dialogs, sheets, menus, tabs, tooltips and comboboxes implement their canonical keyboard contract.
- [ ] Focus is visible, logically ordered, restored after overlays, and not hidden by sticky UI.
- [ ] Normal text is at least 4.5:1; large text and meaningful non-text UI at least 3:1.
- [ ] Color is never the sole carrier of score, allergen, nutrition, confidence or state meaning.
- [ ] Touch targets are at least 44×44 CSS px, with a 48px preferred control height on mobile.
- [ ] Content reflows at 320 CSS px and remains usable at 200% browser zoom.
- [ ] WCAG text-spacing overrides do not clip, overlap or hide controls.
- [ ] No orientation lock; drag/swipe interactions have simple alternatives.
- [ ] Meaningful images have useful alternatives; decorative media is ignored.
- [ ] Forms use visible labels, input purpose/autocomplete, inline errors, error summary and recovery guidance.
- [ ] Status changes use live regions without duplicate or disruptive announcements.
- [ ] Reduced motion, dark mode and forced/high-contrast modes retain meaning and focus visibility.
- [ ] EN/PL/DE text expansion is tested at all target widths.
- [ ] Tables and charts have titles, labels, summaries and non-color access to critical values.
- [ ] Unknown allergen evidence never receives success semantics.

Realistic AAA enhancements: 7:1 body-text contrast for long editorial content, 44px+ targets throughout, plain-language evidence summaries, always-visible focus treatment, captions/transcripts for future media, and no timing-dependent essential tasks.

## Performance and frontend architecture

### Required architecture changes

- Keep root layout/provider topology minimal. Mount TanStack Query, feature flags, achievements, authenticated telemetry and app-only toasts in the authenticated route group.
- In demo/public mode, do not construct Supabase clients, call auth, open Realtime, or request `/api/flags`.
- Render static landing, Learn, legal and support content as Server Components; use small client islands for theme, approved auth-dependent CTA, demonstrations and motion.
- Load only the selected locale dictionary for a public route; do not bundle all three dictionaries into every client consumer.
- Introduce route-level loading/error boundaries and progressively reduce the 45/54 client-page ratio.
- Dynamically load expensive inactive product/compare panels when the interaction benefits outweigh latency.
- Replace global chunk arithmetic with route-specific compressed first-load JS measurement.
- Use one local/pinned visual test environment and loopback-only fixture guard.

### Phase 5 budgets

| Metric | Acceptance budget |
|---|---:|
| Landing Lighthouse mobile | ≥ 0.90 performance |
| Landing Lighthouse desktop | ≥ 0.95 performance |
| Lighthouse accessibility / best practices / SEO | ≥ 0.95 each |
| Axe | zero critical or serious violations |
| LCP | ≤ 2.5s |
| INP field target | ≤ 200ms at p75 |
| TBT lab proxy | ≤ 200ms |
| CLS | ≤ 0.05 landing; never > 0.1 |
| TTFB | ≤ 800ms |
| Landing initial client JS | ≤ 180KiB gzip target |
| Public informational route JS | ≤ 150KiB gzip target |
| Route bundle regression | ≤ +10KiB and ≤ +5%; fail when either limit is exceeded |
| Hero visual | ≤ 250KiB optimized |
| Cold mobile first-load transfer | ≤ 900KiB |
| Web fonts | ≤ 100KiB WOFF2 total, Latin + Latin Extended |
| Demo landing backend traffic | zero Supabase auth/REST/Realtime and zero `/api/flags` |
| Runtime quality | zero hydration errors, console errors, unexpected first-party 4xx/5xx |
| Visual diff | ≤ 0.3% critical viewport; ≤ 0.5% full page |
| Animation | 60fps target; no animation task >50ms; no layout shift |

The official [Core Web Vitals guidance](https://web.dev/articles/vitals) defines “good” LCP at 2.5 seconds, INP at 200ms, and CLS at 0.1 when evaluated at the 75th percentile. TryVit’s stricter landing CLS target preserves room for later variance. TBT is a lab proxy, not a claim about field INP.

### Client-component ratchet

Record a baseline with exact Next.js route analysis before enforcement. Then:

- no public informational route may become a client page without a written interaction need;
- every migrated page identifies its smallest client islands;
- no Phase 5 PR increases the repository client-boundary count without replacing at least as much client surface or documenting a temporary exception;
- landing client JavaScript and authenticated route JS are measured independently;
- oversized surfaces are split by behavior and loading boundary, not merely by file length.

## Testing and governance

1. Token schema: uniqueness, no cycles, complete theme pairs, correct Tailwind namespace and compiled utility existence.
2. Contrast matrix: every documented text/surface, icon/surface, border/surface and focus/surface pair.
3. Primitive contract tests: semantic roles, keyboard, focus restoration, reduced motion, disabled/loading and accessible names.
4. Evidence contract tests: all five display statuses plus the three evidence bases, no green unknown, no inferred absence, preservation of legacy contains/may-contain type, and EN/PL/DE parity.
5. Visual catalog: `/dev/components` is the canonical foundation-candidate fixture
   gallery; its 5A.1 captures are review candidates, not Golden References or approved
   production baselines. Do not add Storybook unless the existing catalog demonstrably
   cannot serve CI/review needs.
6. Visual evidence and baselines: preserve the immutable Phase 5A.0d baseline namespace.
   Phase 5A.2 Golden stills and recordings are approval evidence, not production
   regression baselines. Route-level 390×844, 768×1024 and 1440×900 light/dark and
   reduced-motion stable baselines begin with separately authorized production
   migrations in Phase 5A.3+ and use the pinned renderer.
7. Ratchet checks: legacy `.card`, `.input-field`, arbitrary shadows/radii and `transition-all` are allowlisted by existing path; new usage fails.
8. Documentation: token and component contracts update with each migration phase.
9. Inventory drift: a verification script regenerates and compares the bounded current
   production graph with
   [`phase5/live-route-component-inventory.json`](phase5/live-route-component-inventory.json);
   new routes/components and new or increased visual debt must be mapped and classified
   before the check passes. The historical audit taxonomy remains unchanged.

## Rollout strategy

- Complete exactly two Phase 5A.1 PRs—5A.1a foundations and 5A.1b primitives/facades;
  there is no 5A.1c.
- Complete and explicitly approve the non-production Phase 5A.2 Golden Reference gate
  before any production-route restyle or identity replacement.
- Build V2 alongside existing components.
- Migrate one route family per PR using compatibility facades.
- Keep legacy CSS until the final importing route is migrated.
- Make each route switch reversible by reverting its focused PR; do not operate two runtime themes behind a long-lived feature flag unless deployment risk demonstrates a need.
- Capture before/after screenshots with meaningful deterministic fixtures.
- Remove deprecated components and legacy tokens only in dedicated cleanup PRs after search proves zero imports.

The staged implementation and first-phase acceptance contract are defined in
[`PHASE5_IMPLEMENTATION_ROADMAP.md`](PHASE5_IMPLEMENTATION_ROADMAP.md). The mandatory
future art-direction, identity, content, motion, and Golden Reference approval contract
is defined in
[`PHASE5A2_EXPERIENCE_ARCHITECTURE_GOLDEN_REFERENCE.md`](PHASE5A2_EXPERIENCE_ARCHITECTURE_GOLDEN_REFERENCE.md).
