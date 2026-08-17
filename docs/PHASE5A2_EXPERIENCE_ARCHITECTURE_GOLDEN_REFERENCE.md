# Phase 5A.2 — Experience Architecture and Golden Reference Gate

> **Last updated:** 2026-08-17
> **Status:** Checkpoint 1 evidence staged; Eric selection pending; no Golden Reference or production migration is authorized
> **Entry gate:** Phase 5A.1a and Phase 5A.1b are reviewed, merged, and green on authoritative `main`, followed by explicit authorization from Eric
> **Exit gate:** Eric explicitly selects the art direction and identity and approves all six Golden References after independent review

## Purpose and boundary

Phase 5A.2 is the mandatory design, interaction, content, accessibility, and frontend-
architecture approval gate between Design System V2 construction and production-route
migration. It converts a promising visual hypothesis into reviewed reference
experiences before route teams multiply it across the product.

Phase 5A.1 remains exactly two official pull requests:

1. Phase 5A.1a — foundations;
2. Phase 5A.1b — canonical primitives, interaction contracts, and V1 compatibility
   facades.

There is no Phase 5A.1c. Phase 5A.2 begins only after both official Phase 5A.1 PRs are
complete. It does not redesign a production route, replace a production identity asset,
add a production dependency, or authorize deployment. Its screenshots and recordings
are review evidence, not immutable production baselines.

Before any production-route migration, Phase 5A.2 must add targeted Firefox and WebKit
interaction proof for Dialog, Sheet, Menu, Combobox, and Tabs. That proof is a blocking
entry requirement and must cover keyboard containment and restoration, Escape,
outside-pointer dismissal, and nested portal ownership. It extends behavioral coverage;
it does not replace the immutable Chromium visual baselines or authorize a new broad
screenshot matrix. Production-route migration remains prohibited until this
cross-browser interaction gate passes.

### Approval checkpoints

Phase 5A.2 uses two approval checkpoints without adding roadmap phases:

1. **Direction and identity selection:** three paired candidate studies, bounded
   representative compositions, motion/scanner evidence, independent review, and Eric's
   explicit selection.
2. **Six Golden References:** complete landing, authentication, home, search,
   product/evidence, and scanner references built only after Checkpoint 1 selection.

Checkpoint 1 evidence is staged at
[`phase5a2/checkpoint-1/`](phase5a2/checkpoint-1/README.md). Completing Checkpoint 1 does
not satisfy this document's final exit gate and does not authorize production work.

## Product north star

The complete TryVit public website and authenticated application must ultimately feel
like one distinctive, world-class food-intelligence product. The identity must connect
brand, typography, themes, iconography, imagery, layout, information architecture,
motion, state design, content, accessibility, localization, performance, and frontend
architecture.

The result must not resemble generic SaaS glass, an interchangeable green wellness
brand, AI-generated healthcare branding, a neon health-tech dashboard, or a copied
design system. Premium quality means deliberate hierarchy and craft, not constant
animation.

## Living Label and identity are hypotheses

Living Label is the strongest current working direction and supplies useful semantic
foundations. It is not an untouchable conclusion. Phase 5A.2 must produce up to three
genuinely different, original, TryVit-native art-direction expressions. They must vary
in more than palette, radius, or shadow and explore different balances among:

- editorial warmth and tactile label character;
- scientific precision and evidence clarity;
- premium consumer utility and rapid decision-making.

Each direction is evaluated for distinctiveness, TryVit fit, evidence truthfulness,
hierarchy, motion potential, coherent light/dark quality, responsive scalability,
accessibility, localization, implementation cost, and maintenance cost. Warm-forest
dark is the current foundation candidate, not a mandatory final art-direction choice.
The phase may recommend one direction or a deliberate hybrid, but it must stop for
Eric's explicit selection before freezing the final language.

The current mark is retained provisionally until the same gate challenges the complete
identity: logo, symbol, wordmark, typography, color, iconography, imagery,
illustration, pattern/texture, and overall recognition. Produce up to three coherent,
original systems:

1. a refined evolution of the current mark;
2. a substantial redesign;
3. a distinct new identity aligned with the selected art direction.

Each shortlisted identity must demonstrate a primary logo, symbol, wordmark, horizontal,
stacked, and compact lockups; light, dark, monochrome, high-contrast, and forced-color
resilience; favicon and small-size legibility; maskable PWA/mobile icons with safe-area
proof; social avatar and Open Graph treatment; splash/loading treatment; and realistic
application on the landing, authenticated shell, product/evidence experience, and
scanner. The package also defines clear space, minimum size, misuse, and accessibility
rules plus its illustration, texture, and photographic direction. It may include a
motion-logo concept only when motion adds recognition or meaning and has an equivalent
static and reduced-motion treatment.

Avoid generic leaves, shields, hearts, checkmarks, nutrition badges, and interchangeable
green wellness marks. AI-generated imagery may support private concept exploration only.
Final identity assets require intentional vector construction, originality and
licensing review, and Eric's explicit approval. Phase 5A.2 does not itself replace the
production identity.

Assess every identity for memorability; food-intelligence and evidence relevance;
premium trustworthiness; fit with its art direction; favicon-to-large-format
scalability; light, dark, monochrome, high-contrast, and forced-color resilience;
motion potential; international suitability; originality and licensing safety; and
implementation and maintenance cost. The current mark may win only on that evidence,
not merely because it already exists.

## World-class experience charter

Every direction package must make its quality system concrete rather than relying on a
single attractive hero composition. It includes:

- art-direction principles and explicit anti-patterns;
- a complete typography proposal with hierarchy, tabular data, EN/PL/DE character and
  expansion proof, font licensing, transfer cost, and metric/fallback behavior;
- a coherent icon family, rules for default-library versus TryVit-specific symbols,
  optical sizing, small-size proof, and no emoji or raw-SVG drift;
- an original illustration, product-imagery, and photography language with source,
  licensing, crop, fallback, loading, error, dark-mode, and performance rules;
- layout grids, responsive composition, public and application spacing/density modes,
  surface/elevation logic, and information-hierarchy examples;
- light and dark theme expressions plus selected forced-color/high-contrast proof;
- motion, direct-manipulation, focus, hover, pressed, selected, disabled, loading,
  empty, error, offline, partial, unknown, and recovery behavior;
- realistic navigation, forms, tables, evidence rows, overlays, charts, calls to action,
  empty states, loading states, errors, and microcopy—not placeholder rectangles.

The public expression may use editorial rhythm, authored imagery, generous composition,
and one premium narrative sequence, but it must communicate product truth within the
first viewport and remain fast without motion. The authenticated expression is denser,
task-led, and operational: stable navigation, strong scan/search entry, compact evidence
hierarchy, rapid comparison, predictable overlays, and calm recovery. They must still
share one recognizable identity, typography system, evidence language, icon grammar,
theme logic, and motion discipline.

“Premium” does not mean oversized headings everywhere, glass panels, ambient gradients,
floating-card choreography, gratuitous parallax, excessive rounding, animation on every
scroll, decorative dashboards, generic leaf/checkmark wellness marks, low-information
empty states, or dark mode produced by simple color inversion.

## Six required Golden Reference experiences

The gate requires six complete, responsive experiences:

| Reference | Minimum complete scenario |
|---|---|
| Expressive landing | First-viewport comprehension, package-to-label narrative, deterministic decode, trust/evidence explanation, methodology/market context, final action and footer |
| Authentication | Sign in, registration/recovery entry, validation, busy, service failure, success/redirect, password-manager/autofill, keyboard and localized long-copy behavior |
| Authenticated home | New and returning user priorities, search/scan entry, recent/saved decisions, partial/paused/error data and stable navigation across app densities |
| Search | No query, typing, suggestion, filtering, active-filter summary, results, empty, degraded/error, mobile Sheet and desktop rail behavior |
| Product/evidence | Identity and source, score/confidence, nutrition, ingredients, allergens, provenance, unknown/partial evidence, alternatives/compare entry and package-label reminder |
| Signature scanner | Permission, acquisition, recognition, processing, result, partial/not-found/offline failures, manual entry and contribution/recovery |

Each Golden Reference is a deterministic, interactive non-production prototype or
reference harness—not only a still composition. It must be complete enough to test
input, focus, announcements, interruption, responsive restructuring, state transitions,
content, and reduced motion. It must not replace or restyle the corresponding production
route in Phase 5A.2.

Authentication remains a primary reference. Scanner is an additional signature
reference, not a replacement for authentication.

The scanner reference includes camera permission not requested, permission request,
permission denied, scanner ready, framing/acquisition guidance, recognition feedback,
processing, successful result, partial or uncertain result, product not found, offline,
camera unavailable, manual barcode entry, and contribution/recovery. It must remain
truthful about current data readiness.

## Motion architecture and evidence

Static screenshots cannot approve interaction quality. The default architecture is:

1. tokenized CSS transform/opacity transitions;
2. feature-detected View Transitions as progressive enhancement;
3. a small route-local WAAPI/client helper only for named, interruptible interactions.

There is no global animation provider. A motion library requires a measured ADR showing
that platform primitives cannot satisfy a named interaction. The ADR must cover SSR/RSC
safety, reduced motion, interruption, focus, fallback, route-local loading, tree
shaking, gzip delta, license, maintenance, security, and route-JavaScript thresholds.

The only approved transition durations are **0, 120, 180, 240, 360, and 500ms**:

- 0ms renders the complete final state for reduced motion and state reset;
- 120ms is direct-manipulation, press, and icon-state feedback;
- 180ms is hover/focus response and disclosure or overlay exit;
- 240ms is disclosure entrance and determinate progress;
- 360ms is overlay entrance, section/evidence reveal, and spatial continuity;
- 500ms is reserved exclusively for an approved landing package-to-label narrative.

No authenticated, scanner, system, or general component transition uses 500ms.
Determinate progress uses the 240ms standard duration and linear-progress easing tied
to actual work; indeterminate feedback must also remain truthful rather than becoming a
decorative fixed-duration loop.

Deterministic recordings must cover public narrative movement, navigation continuity,
theme changes, direct manipulation, overlays, search/filter updates, product-to-detail
continuity, evidence/provenance exploration, comparison, scanner transitions, and
loading/empty/degraded/error/recovery states. Every family needs reduced-motion evidence
that renders the complete informative state immediately.

Review verifies interruption and repeated-input safety, focus continuity, announcement
timing, low-power and unsupported-browser fallbacks, no hidden animation-dependent
content, no animation-caused layout shift, and no animation-attributable task above
50 ms in the approved profile.

No scroll-jacking, default WebGL, autoplay video, large animated blur/filter surfaces,
ornamental floating-card choreography, or unapproved layout-property animation is
permitted.

## Content design and localization

Written content is part of the interface. Golden Reference review covers headings,
navigation, fields, support text, actions, onboarding, scanner instructions, loading
and processing, empty/permission/error/recovery/offline/degraded states, evidence and
confidence explanations, contribution paths, destructive confirmations, and package-
label safety reminders.

Content must be direct, useful, calm, human, truthful about uncertainty, free of
moralizing food language, and free of unsupported health claims. EN, PL, and DE must
communicate equivalent meaning and recovery rather than literal word-for-word
translations. Evidence must include long German strings, natural Polish constructions
and diacritics, expansion at every target width, documented unresolved translations,
and qualified native-language review before native approval is claimed.

## Responsive, theme, and state evidence

Stable review screenshots cover 390, 768, and 1440 widths in light and dark modes.
Behavioral review covers 320, 390, 768, 1024, 1280, and 1440 widths; 200% zoom; WCAG
text-spacing overrides; normal and reduced motion; selected forced-colors evidence;
coarse and fine pointers; and hover/no-hover behavior.

Each relevant experience includes loading, empty, error, degraded, offline, permission,
paused, partial, complete, unknown-data, and recovery states. The approved design must
preserve evidence meaning without relying on color alone.

## Independent review and scoring

The implementation agent may not self-certify final visual quality. At least two
fresh-context reviewers who did not implement the work independently assess every art
direction, identity direction, and Golden Reference before seeing one another's scores.
They receive the approved brief, rendered screenshots, recordings, and interaction
instructions, but not the implementation rationale.

Record separate scores, reasoning, generic-template concerns, hierarchy/usability
concerns, disagreements, vetoes, and proposed corrections. Automated checks do not
count as visual approval, and scores cannot average away a veto.

The 100-point rubric is:

| Category | Points |
|---|---:|
| Brand distinction and art direction | 15 |
| Hierarchy and typography | 15 |
| Evidence truth and trust | 12 |
| System coherence | 12 |
| Responsive/mobile/reflow | 12 |
| Accessibility/input behavior | 10 |
| State completeness/recovery | 8 |
| Motion/microinteractions | 6 |
| Imagery/icon/brand craft | 6 |
| Dark/high-contrast quality | 4 |
| **Total** | **100** |

Pass requires at least 88/100, no category below 75%, no truthfulness,
accessibility, privacy, or performance veto, no unresolved severe generic-template
concern, two independent reviews, and Eric's explicit approval.

## Performance and Next.js contract

- Server Components are the default.
- Locale, copy, metadata, and public content resolve on the server.
- Small client islands receive serializable view models and exist only for browser APIs,
  controlled forms, gestures, overlays, or live state.
- There is no global client animation shell or hydration-dependent marketing content.
- Images use stable dimensions, responsive sizes, and the built-in optimized image path.
- Scanner, OCR, charts, and advanced interactions load route-locally.
- Every proposed client page/layout records a reason and gzip delta.

Blocking budgets remain public LCP at or below 2.5 s, TBT at or below 200 ms, landing
CLS at or below 0.05 and never above 0.1, TTFB at or below 800 ms, fonts at or below
100 KiB total if adopted, no motion-attributable task above 50 ms, no motion-caused
layout shift, and no route-JS increase exceeding either 10 KiB gzip or 5%.

## Production-migration handoff and completion

After approval, the production program generates a route × state × theme × viewport ×
motion × approval ledger from code and governing manifests wherever practical. Every
active user-facing production route must be migrated to V2 and redesigned or explicitly
removed from the product. “Intentionally retained” and “deferred” do not count as Phase
5 completion.

Admin, Labs, and internal/system surfaces require either an owned migration or an
explicitly approved exclusion. A failed scanner-readiness gate must yield a truthful
unavailable, partial, or contribution experience or a product-removal decision; it may
not create an indefinite visual deferral.

Final Phase 5 completion requires 100% ledger coverage; zero unexplained production V1
scopes; zero orphaned compatibility facades; zero uncontrolled icon-library, raw-SVG,
or emoji drift; zero unclassified motion debt; native EN/PL/DE review for consequential
copy; WCAG 2.2 AA automated and manual evidence; real-device and assistive-technology
sampling; performance evidence; expert visual-cohesion review; and Eric's final
approval.

Production migration, deployment, monitoring, and rollback remain separately authorized
work after this gate.
