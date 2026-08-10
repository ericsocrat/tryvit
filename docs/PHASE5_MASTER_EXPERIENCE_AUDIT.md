# Phase 5 Master Experience Audit

> **Last updated:** 2026-08-10
> **Status:** Active — audit and design decision record; no redesign is implemented
> **Owner issue:** Frontend domain

## Executive decision

TryVit should become a **living food label**: a calm, premium European product that turns a package, barcode, or search result into an understandable, evidence-aware decision. The interface should make three things immediately clear: what the product data says, how confident TryVit is, and what remains unknown.

The strongest current visual hypothesis is **Living Label**. It replaces the current generic glass-and-glow language with warm editorial surfaces, deep forest ink, precise ruled information panels, tactile label details, strong typography, and restrained motion that visually “decodes” a product label. Its semantic foundations can support an expressive public site and a dense authenticated application without making them feel like separate products. Phase 5A.2 must nevertheless challenge it against up to two other genuinely different TryVit-native directions before the final language is approved.

Implementation should not begin with an unrestricted landing-page makeover. The first implementation phase is **Phase 5A.0 — Public Experience Foundation Gate**. It must make public routing, demo-mode isolation, localization, accessibility primitives, performance measurement, and local-only visual baselines trustworthy. Exactly two Phase 5A.1 PRs then establish Design System V2 foundations, primitives and compatibility without migrating production routes. Phase 5A.2 is a non-production Experience Architecture and Golden Reference Gate. Production public/authentication work begins in Phase 5A.3 only after Eric approves that gate.

No open P0 was found. Phase 5 Preflight A corrected the former allergen truthfulness risk, and that contract is now a non-negotiable redesign guardrail. The audit found nine P1 issues that should be resolved or structurally contained before broad visual migration.

## Audit boundary and evidence

The audit was performed on `codex/phase-5-master-experience-audit` from verified commit `362e0e907b1ea93e25b05a9bb8859bc8a07f4e78`.

Evidence included:

- all 54 `page.tsx` routes, 26 layouts, route handlers, proxy rules, metadata, PWA files, providers, localization, and route-quality manifests;
- all 181 production component modules and the 126-token light-theme inventory;
- global CSS, responsive utilities, icons, imagery, motion, dark mode, and existing design-system documentation;
- frontend unit, accessibility, Playwright, Lighthouse, bundle, screenshot, and repository-hygiene infrastructure;
- 74 tracked historical screenshots plus eight fresh public/auth viewport captures at 390×844, 768×1024, and 1440×900 in light and dark modes;
- current official product and design references listed below.

This was a read-only product/code audit except for these documentation artifacts. No product code, API, schema, migration, dependency, scanner behavior, Vercel setting, or hosted database state was changed.

### Important visual-testing limitation

Fresh public landing and authentication screens were captured locally. Authenticated fixture capture was stopped when the compiled development client was found to contain the inactive hosted Supabase URL despite an intended local override. No hosted session was established and no hosted write occurred. The failed local-only assumption is itself a P1 finding: visual tooling must reject non-loopback Supabase hosts before it creates a browser or test user.

The 74 tracked application screenshots were visually inspected as current-state reference material, but they are not authoritative regression baselines: the repository contains no Playwright baseline snapshots, several captures show placeholder or “Product not found” states, and the existing screenshot workflow can receive hosted credentials.

No measured Core Web Vitals are claimed in this audit. The dedicated tracing integration was unavailable, so performance findings come from source, bundle/CI configuration, and existing repository measurements. Future values in this document are acceptance budgets, not invented measurements.

A final read-only production check at 2026-07-30 21:06 UTC returned HTTP 200 for `https://tryvit.vercel.app/` and the expected HTTP 503 readiness payload for `/api/health` (`application: available`, `data_backend: unavailable`, `full_product: not_ready`). The server-rendered landing HTML used “In validation” language but did not contain an explicit demo, paused, or backend-unavailable statement. Phase 5 must treat that mismatch as a separate truth/observability issue; this audit does not change production. The response summary is persisted in the supporting inventory so reviewers can distinguish this timestamped observation from a permanent claim.

## Current product truth

### What TryVit currently communicates

TryVit presents itself as a Polish/German food intelligence product with an explainable 1–100 health score, nine scoring factors, Nutri-Score, NOVA, data confidence, barcode scanning, search, comparison, and personalized tools. The strongest product thesis is not “another score”; it is **auditable food decisions with visible confidence and provenance**.

The current data truth supports that positioning only with careful qualification:

- 8,652 active products;
- approximately 38.3% with ingredient links;
- approximately 29.5% with known `contains` allergen evidence;
- 100% nutrition coverage;
- approximately 99.9% valid EAN coverage;
- zero data-quality failures and warnings at the verified baseline;
- production backend intentionally paused, with `/api/health` returning the known HTTP 503.

The redesign must not imply universal ingredient or allergen completeness. It should turn incompleteness into understandable provenance, not hide it.

### Strongest existing moments

1. **Truthful allergen semantics.** Explicit `contains`, explicit `may contain`, deterministic ingredient-derived, legacy-positive, unknown, and reserved authoritative absence are distinct.
2. **Explainable scoring.** Score breakdown, confidence, provenance, and educational routes give TryVit a more defensible thesis than opaque food grades.
3. **Functional theme and focus foundations.** Light/dark themes, global focus styling, reduced-motion handling, live regions, route announcements, and 44px touch utilities provide useful groundwork.
4. **Broad journey coverage.** Search, comparison, lists, settings, scanning, Learn, and provenance already exist; Phase 5 is refinement and architecture, not a concept mock-up without product depth.
5. **Polished authentication shell.** The desktop split-panel treatment and focused mobile auth card are more coherent than many authenticated application screens.
6. **Engineering credibility.** Deterministic data replay, quality gates, CodeQL, SonarCloud, and evidence-aware APIs can become visible brand proof.

### Where the experience loses quality

- The landing page is competent but generic: one large glass card, green glow fields, repeated pills, and floating-card hover recipes resemble a reusable SaaS template more than a food-intelligence identity.
- The authenticated shell is visually flatter and denser than the public site. Large whitespace zones coexist with overloaded navigation and utility-card repetition.
- Typography is assembled route by route from utilities; no production type family or semantic type roles establish a recognizable voice.
- Four navigation implementations hold separate registries and active-state rules.
- Product/search/compare pages are very large client surfaces, increasing cognitive and technical coupling.
- Radius, shadow, transition, and card choices drift enough to make the product feel assembled from multiple visual eras.
- Mobile navigation and header actions are cramped; settings and filters expose breakpoint-specific interaction problems.
- Loading, empty, retry, offline, paused, and error states lack one route-level contract.

These observations are design judgment where stated as visual character. The route, component, semantic, and accessibility findings below are source-backed defects or measurable inconsistencies.

## Complete experience coverage

The machine-readable inventory is in [`phase5/route-component-inventory.json`](phase5/route-component-inventory.json). It maps every route to one of the following audited journey archetypes.

| Journey | Routes | Purpose and primary action | Current strengths | Principal problems | Complexity | Priority / phase |
|---|---:|---|---|---|---|---|
| Visitor / marketing | 1 | Understand TryVit; explore or sign in | Clear core claim, live/demo variants | Generic visual language, hardcoded copy, backend coupling | High | P1 / 5A |
| Learn / editorial | 9 | Understand scores, labels, confidence, allergens | Substantive educational content | Locale and metadata gaps; repetitive glass shells | Medium | P2 / 5A.3 |
| Legal / support / system | 5 | Trust, support, offline and policy access | Simple readable content | Placeholder contact; offline auth-gated; incomplete metadata | Low–medium | P1 / 5A.0–5A.3 |
| Authentication | 4 | Enter or recover an account | Visually coherent shell and useful form labels | Toast-only errors; global provider weight; locale gaps | Medium | P1 / 5A.2 reference, 5A.3 production |
| Public sharing | 2 | Open a shared list or comparison | Acquisition-capable concept | Proxy can redirect anonymous recipients to login | Medium | P1 / 5A.0 |
| Onboarding | 3 | Choose region/preferences and establish profile | Clear stepped concept | Chosen language does not immediately localize; legacy redirects | Medium | P1 / 5D |
| Dashboard | 1 | Resume a useful task | New/returning user branches | New-user state lacks page-level `h1`; empty dashboard feels sparse | Medium | P1 shell / 5B; P2 content / 5D |
| Discovery | 3 | Search, filter, browse categories | Strong functional breadth | Dense filters, nested controls, weak empty/retry consistency | High | P1 / 5C.1 |
| Product decision | 3 | Understand, compare, and act on evidence | Deep score/evidence model | Oversized client pages; tabs incomplete for keyboard; hierarchy overloaded | Very high | P1 / 5C.2 |
| Saved / personal | 5 | Save, organize, and revisit decisions | Lists, watchlist, saved searches/comparisons exist | Inconsistent states; list-card nested action | High | P1 / 5D |
| Explore / recipes | 2 | Find and inspect recipe ideas | Search/detail journeys exist | Secondary value; mixed state/copy patterns | Medium | P2 / 5D |
| Gamification | 1 | Review achievements/progress | Unlock/progress states exist | Weak fit with the evidence-first north star | Low–medium | P3 / 5D |
| Scanner / contribution | 6 | Scan, recover, submit, revisit | Multiple recovery journeys exist | Camera surface dominates; usefulness gated by data readiness | High | P2 / 5A.2 reference, 5E implementation (gated) |
| Settings / account | 5 | Manage preferences, privacy, notifications | Logical domain separation | Mixed form/error patterns; mobile tab overflow | Medium | P2 / 5D |
| Admin | 3 | Review submissions and operations | Separate operational views | Hardcoded English; authorization/nav exposure risk | Medium | P1 policy / 5B; P3 page visuals / 5F |
| Development catalog | 1 | Inspect shared components | Useful migration aid | Not a complete canonical component catalog | Low | P2 / 5A.1 |

### State coverage

- 29/29 authenticated pages are client pages.
- 26/29 authenticated pages show a local loading marker, but there are zero route-level `loading.tsx` boundaries.
- 16/29 authenticated pages visibly implement an empty state.
- 16/29 authenticated pages expose retry/refetch/reset behavior.
- There are two route error boundaries, one fatal global-error surface, and one global not-found page.
- Shared, offline, backend-paused, authentication-error, no-evidence, and degraded-data states exist, but their routing and visual contracts are inconsistent.

Every route remains visible to the migration program. An active user-facing route must
ultimately be migrated to the approved V2 experience or removed by explicit product
decision. Scanner and image-search readiness may change the implemented experience, but
cannot create an indefinite deferral while Phase 5 is declared complete.

## Screenshot inventory and visual inspection

### Fresh session captures (retained audit evidence)

| View | Viewports / themes | Finding |
|---|---|---|
| Landing | 390×844 light/dark; 768×1024 light/dark; 1440×900 light/dark | Clear headline and status, but generic glass/glow treatment, repeated pills, and an oversized hero card weaken distinction. Mobile header is crowded. |
| Login | 390×844 dark; 1440×900 dark | Most coherent existing visual surface. Desktop illustration and form split well; mobile remains focused and readable. |

The eight public/auth captures are retained under [`phase5/screenshots/`](phase5/screenshots/) because they are direct current-state audit evidence for the working direction and responsive findings. They are not approval of an art direction, Golden References, or production regression baselines. They are already compact PNGs (30–68KB each), contain no authenticated user data, and cover the three required viewport classes without creating another large image collection. Their exact byte sizes and SHA-256 checksums are recorded in [`phase5/route-component-inventory.json`](phase5/route-component-inventory.json).

- Landing: [390 light](phase5/screenshots/landing-390x844-light.png), [390 dark](phase5/screenshots/landing-390x844-dark.png), [768 light](phase5/screenshots/landing-768x1024-light.png), [768 dark](phase5/screenshots/landing-768x1024-dark.png), [1440 light](phase5/screenshots/landing-1440x900-light.png), [1440 dark](phase5/screenshots/landing-1440x900-dark.png).
- Login: [390 dark](phase5/screenshots/login-390x844-dark.png), [1440 dark](phase5/screenshots/login-1440x900-dark.png).

The landing captures include the local paused/demo treatment and therefore document that degraded-data design. The browser run did not proceed into authenticated journeys after the local-only host guard failure described above. The live-production observation is separately timestamped in the inventory because it is transient and was made by unauthenticated HTTP response inspection rather than a committed production screenshot.

### Tracked screenshot library

| Collection | Count | Typical coverage | Audit use |
|---|---:|---|---|
| `docs/screenshots/audit/desktop` | 42 | Public, Learn, auth, dashboard, discovery, scanner, saved, settings, admin | Broad historical route reference |
| `docs/screenshots/audit/mobile` | 13 | Landing, auth, Learn, dashboard, category, product, search, scan, lists, compare, settings/nav | Historical responsive reference |
| `docs/screenshots/dark-mode` | 3 | Dashboard, product, compare | Theme consistency reference |
| `docs/screenshots/desktop` | 12 | Core authenticated journeys | Duplicate/legacy reference |
| `docs/screenshots/mobile` | 4 | Product, search, scan, category | Duplicate/legacy reference |
| **Total** | **74** | — | Documentation only; not pixel baselines |

Visual review found excessive card repetition, inconsistent spacing and radius, a flat utility-dashboard feel, a very large dark scanner viewport, clipped settings navigation, and several placeholder product captures. The screenshot set proves coverage breadth but not meaningful-data or regression quality.

### Required future screenshot matrix

Each redesigned route archetype needs meaningful fixtures at 320, 390×844, 768×1024, 1024×768, 1280×800 and 1440×900 in light and dark modes. The 1024px header regime and 1280px sidebar transition are mandatory because they exercise distinct shell behavior. Critical journeys additionally need 200% zoom, reduced motion, high contrast, loading, empty, error, offline/paused, complete evidence, and unknown-evidence states. Stable visual baselines must be generated in a pinned local/CI environment that fails closed on any non-loopback backend host.

## Prioritized issue backlog

### P0 — none open

The former misleading allergen-absence behavior was corrected in Phase 5 Preflight A. Any regression that renders missing evidence as safe/green, reintroduces “Allergen-Free” without authoritative absence, or merges explicit and derived evidence becomes a P0 release blocker.

### P1 — must be resolved or contained before broad redesign

| ID | Finding and evidence | Impact | Resolution | Dependency / effort | Blocks |
|---|---|---|---|---|---|
| P1-01 | Public route policy omits shared lists/comparisons, offline, manifest, service worker, robots, sitemap, and OG assets even though the proxy matcher handles them. Tests disagree about sharing. | Acquisition, PWA fallback and SEO requests can redirect to login. | Central typed route policy; HTTP tests for every public/system route. | M | Public launch and screenshots |
| P1-02 | Public/demo requests still create a Supabase middleware client; global providers can load flags, Realtime, telemetry and application state. | Paused backend can degrade the visitor experience and invalidate “static demo” assumptions. | Explicit public/demo execution path and route-group provider topology with zero Supabase traffic. | L | Visitor redesign |
| P1-03 | Visual capture accepts any configured Supabase URL and current PR screenshots may receive hosted credentials; zero actual Playwright baselines exist. | Unsafe fixtures and non-authoritative visual QA. | Fail-closed loopback guard, deterministic local fixtures, pinned Linux baselines, secret-free public job. | M | Visual migration |
| P1-04 | Current token documentation promises AA while a general contrast test accepts 2:1; current success/error foreground examples fail 4.5:1. | Text/status accessibility and trust risk. | Correct token contracts; role-specific foreground/surface pairs; compiled utility and 4.5:1 tests. | M | Design System V2 |
| P1-05 | Search/list cards nest buttons inside links; mobile filter and More drawers lack complete dialog/focus behavior; menus/tabs lack full keyboard contracts. | Ambiguous semantics, keyboard failure and focus loss. | Canonical CardLink, Dialog, Sheet, Menu, Tabs and Tooltip primitives before restyling pages. | L | App migration |
| P1-06 | Language is hydrated only inside `/app`; `<html lang>` and route announcements stay English; onboarding selection does not immediately translate. | WCAG language risk and mixed EN/PL/DE journeys. | Root locale contract, localized announcements/metadata and route-wide hydration. | M | All public/app phases |
| P1-07 | Landing is a 532-line client component and client translation imports include roughly 340KB raw JSON across three dictionaries. Performance gates do not test `/` authoritatively. | Unnecessary hydration and risk to the page intended to impress visitors. | Server-render static narrative, tiny interactive islands, route-specific JS and Lighthouse gates. | L | Landing choreography |
| P1-08 | Contact is a stub exposing `hello@example.com`, while paused-mode copy points visitors there. | Direct trust failure. | Human-approved support/status path and localized policy. | S + human decision | Public launch |
| P1-09 | Production landing returns 200 and says “In validation” while `/api/health` reports the expected unavailable backend/full-product-not-ready state; server HTML lacks explicit paused/backend-unavailable language. | A visitor can mistake a visually live product for an available catalog. | Human-approved status strip and truthful demo-mode public contract; keep the 503 observable. | S–M / separate authorized PR | Public launch |

### P2 — meaningful usability and consistency work

| ID | Finding | Recommended resolution | Effort / phase |
|---|---|---|---|
| P2-01 | Four separate navigation registries and shifting breakpoint hierarchy | One route manifest; four stable primary app destinations | M / 5B |
| P2-02 | Zero route loading boundaries and inconsistent empty/retry states | `PageState` pattern plus route-level boundaries | M / 5B–5D |
| P2-03 | 87 arbitrary shadows, 713 radius uses, 38 explicit duration uses, 32 `transition-all` uses | Token ratchet and migration allowlist that can only shrink | M / 5A.1 onward |
| P2-04 | Shared primitives exist but adoption is partial (`Card` 4 uses versus legacy `.card` across about 62 files) | Compatibility facades and incremental codemod/review rules | L / all phases |
| P2-05 | Product and search pages exceed 900 lines; comparison grid is 758 lines | Split data/controller, state, and presentational responsibilities | L / 5C |
| P2-06 | Metadata, JSON-LD, sitemap, PWA copy and currency/market framing are inconsistent | Locale- and environment-aware public metadata contract | M / 5A |
| P2-07 | PWA manifest forces portrait and shortcuts do not match current routes | Correct orientation/shortcuts and add offline route tests | S / 5A.0 |
| P2-08 | Scanner-first marketing is ahead of ingredient/allergen usefulness | Reframe scanner as one input; gate scanner redesign on readiness metrics | S / 5A copy, L / 5E |
| P2-09 | Error handling often relies on toast-only feedback despite an existing form summary | Inline field errors plus summary and focus movement | M / 5A–5D |

### P3 — polish opportunities

- Replace repeated glow blobs and floating cards with the Living Label narrative grammar.
- Establish a real typography voice and tabular-number treatments.
- Unify icon stroke/size and replace emoji-like category markers.
- Use motion for decoding, continuity, feedback and spatial understanding—not decoration.
- Replace generic placeholders with one product-media fallback system.
- Apply editorial rhythm to Learn/legal routes without compromising scanability.

## Current WCAG 2.2 AA assessment

This is a source- and screenshot-level assessment, not a conformance claim. Contrast, screen-reader output, 200% zoom, text-spacing overrides and focus visibility still require rendered manual verification.

| Criterion / area | Current status | Evidence or required action |
|---|---|---|
| 1.1.1 Non-text content | Partial | Shared icon abstractions exist; raw SVG, emoji/category markers and ad-hoc icon buttons need review. |
| 1.3.1 Relationships | Gap | Nested controls, incomplete tabs and the new-user dashboard heading hierarchy are incorrect. |
| 1.3.2 Meaningful sequence | Partial | Most document flow is logical; overlay/background focus and responsive reordering need testing. |
| 1.3.4 Orientation | Gap | PWA manifest forces portrait. |
| 1.3.5 Input purpose | Partial | Auth fields are generally useful; complete form/autocomplete audit remains. |
| 1.4.1 Use of color | Mostly strong | Scores usually pair text/number with color; preserve this and correct allergen/evidence states. |
| 1.4.3 Contrast | Gap / unverified | Current token test permits 2:1 and documented foreground examples fail 4.5:1. Rendered matrix required. |
| 1.4.4 Resize text | Not assessed | Add 200% zoom coverage. |
| 1.4.10 Reflow | Risk | No 320px gate; five mobile navigation controls and dense filters need verification. |
| 1.4.11 Non-text contrast | Not assessed | Test borders, focus, controls, charts and dark mode. |
| 1.4.12 Text spacing | Not assessed | Add WCAG spacing override tests. |
| 1.4.13 Hover/focus content | Partial | Tooltip behavior is not yet one dismissible/persistent contract. |
| 2.1.1 Keyboard | Gap | Menu, sheet and tab implementations are incomplete. |
| 2.1.2 No keyboard trap | Partial | Some native dialogs are sound; More/filter overlays do not fully contain/restore focus. |
| 2.1.4 Character shortcuts | Strong baseline | Global shortcuts exclude editable/control targets. |
| 2.2.2 Pause/stop/hide | Strong baseline | Global reduced-motion handling exists; future narrative motion still needs equivalent tests. |
| 2.4.1 Bypass blocks | Gap | No skip link. |
| 2.4.2 Page titled | Partial | Metadata exists unevenly across auth, contact, legal and system routes. |
| 2.4.3 Focus order | Gap | Drawers, filters, menus and route transitions need correction. |
| 2.4.6 Headings/labels | Partial | New-user dashboard lacks an `h1`; some icon labels are missing or hardcoded. |
| 2.4.7 Focus visible | Strong baseline | Global focus outline exists; rendered contrast and overrides still need validation. |
| 2.4.11 Focus not obscured | Not assessed | Test sticky header, bottom navigation, sheets and comparison tray. |
| 2.5.1 / 2.5.7 Pointer alternatives | Mostly strong | Swipe/drag paths generally have controls; retain alternatives. |
| 2.5.3 Label in name | Gap | Mobile filter close control lacks an accessible name. |
| 2.5.8 Target size | Strong baseline | 44px utilities exist; audit ad-hoc controls and prefer 48px mobile controls. |
| 3.1.1 / 3.1.2 Language | Gap | Root language and route announcements remain English when visible content may be PL/DE. |
| 3.2.3 / 3.2.4 Consistency | Gap | Navigation hierarchy and identification shift by breakpoint. |
| 3.2.6 Consistent help | Gap | Contact is a placeholder. |
| 3.3.1 / 3.3.3 Errors | Gap / partial | Toast-only failures persist despite an available error-summary component. |
| 3.3.8 Accessible authentication | Not assessed | Test password managers, paste, CAPTCHA and cognitive burden manually. |
| 4.1.2 Name, role, value | Gap | Nested controls and incomplete sheet/menu/tab semantics. |
| 4.1.3 Status messages | Strong baseline | Live regions and route announcements exist; they need localization and broader consistent use. |

The future acceptance checklist is defined in [`PHASE5_DESIGN_SYSTEM_BLUEPRINT.md`](PHASE5_DESIGN_SYSTEM_BLUEPRINT.md#accessibility-standard--wcag-22-aa).

## Current reference research

These are patterns to learn from, not identities to copy.

| Current source | Pattern worth learning | Fit for TryVit | Do not copy |
|---|---|---|---|
| [Yuka](https://yuka.io/en/app/) | A product sheet quickly moves from scan to interpretation and alternatives. | Supports the two-second grocery decision. | Its scoring authority or visual identity; TryVit must foreground provenance and uncertainty. |
| [Open Food Facts](https://blog.openfoodfacts.org/en/press-release-new-mobile-app) | Open product data exposes ingredients, nutrition and allergens rather than hiding the source model. | Reinforces transparency and source attribution. | Database-density or community claims TryVit cannot substantiate. |
| [Oura Trends](https://support.ouraring.com/hc/en-us/articles/360055983614-Using-Trends) and [Tags](https://support.ouraring.com/hc/en-us/articles/360038676993-Using-Tags) | Calm layered metrics and contextual interpretation without pretending every signal changes a score. | Useful model for confidence, provenance and explanations. | Wellness mystique or personal-health claims outside TryVit’s remit. |
| [Apple HIG — Charts](https://developer.apple.com/design/human-interface-guidelines/charts) | Titles, annotations, visible critical information, accessibility, and non-color communication. | Directly applicable to scoring and comparisons. | Platform-specific styling or decorative chart overload. |
| [Linear mobile](https://linear.app/mobile) and [Linear Learn](https://linear.app/learn/intro-to-linear) | Purpose-built mobile workflows and efficient command/keyboard patterns. | Supports a focused decision workspace instead of a shrunken desktop dashboard. | Dense productivity aesthetics on food-consumer surfaces. |
| [Material Design 3](https://m3.material.io/) and [interaction states](https://m3.material.io/foundations/interaction/states/overview) | Adaptive component/state systems and multiple state indicators. | Useful architecture for component tokens, motion and accessibility. | A visibly Material-branded result. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Current accessibility conformance target. | Defines the minimum Phase 5 contract. | Treating automated checks as complete conformance. |
| [web.dev Core Web Vitals](https://web.dev/articles/vitals) | LCP, INP and CLS thresholds evaluated at the 75th percentile. | Gives the “wow” work measurable performance limits. | Claiming field success from lab-only results. |

## Product and emotional positioning

### North-star statement

> **TryVit turns a food label into a clear, evidence-aware decision—showing what is known, what is uncertain, and what to compare next.**

### Product promise

For health-conscious shoppers in Poland and Germany, TryVit decodes nutrition, ingredients, allergens, processing, scoring, and source confidence into a usable explanation. It does not replace a legal label or medical advice; it helps a person inspect a product with more context.

### Audience priority

1. Ordinary PL/DE shoppers making a choice in a store or at home.
2. People with ingredient/allergen concerns who need honest evidence boundaries.
3. Curious researchers and contributors who value reproducibility and provenance.

### Emotional and verbal character

- **Feel:** calm, lucid, optimistic, tactile, credible, European, quietly premium.
- **Personality:** an excellent label interpreter—curious, precise, non-judgmental and candid about uncertainty.
- **Voice:** plain language first; evidence and methodology available one layer deeper; never fear-based or moralizing.
- **Visual adjectives:** editorial, label-like, warm, precise, grounded, legible, structured.
- **Anti-attributes:** clinical coldness, pseudo-medical authority, neon health-tech, childish food stickers, moral scoring, generic SaaS glass, infinite dashboards, ornamental motion.

### Trust principles

1. Show source, confidence and uncertainty near any consequential conclusion.
2. Separate observations, derived interpretations and unknowns.
3. Never use green as the default for missing data.
4. Make the package label the final allergen-safety reference.
5. Avoid unsupported claims, fake social proof, invented statistics, and regulatory implication.
6. Let users inspect methodology without forcing technical language into the first glance.

## Visual directions and decision matrix

Scores are 0–10. Weighted score uses the audit’s required weights. These are audit-
stage hypotheses, not a final brand or production-design approval; Phase 5A.2 must
challenge up to three genuinely different TryVit-native directions through rendered
Golden Reference evidence and independent review.

| Direction | Trust 20% | Distinction 15% | Usefulness 15% | Visitor impact 15% | Scalability 15% | A11y 10% | Perf 5% | Feasibility 5% | Weighted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Living Label** | 9.2 | 9.3 | 9.0 | 9.4 | 9.1 | 9.0 | 8.6 | 8.0 | **9.09** |
| **Signal Lab** | 9.5 | 7.8 | 9.4 | 7.8 | 9.4 | 9.5 | 9.3 | 8.8 | **8.92** |
| **Market Garden** | 7.8 | 9.4 | 7.7 | 9.6 | 7.5 | 8.0 | 6.5 | 6.8 | **8.16** |

### Direction 1 — Living Label (current lead hypothesis)

- **Idea:** the interface behaves like a beautifully decoded package label.
- **Character:** warm scientific clarity; assured rather than clinical.
- **Color:** forest ink, oat/ivory paper, restrained herb green; health/evidence colors remain semantic exceptions.
- **Type:** clean humanist UI sans with a restrained editorial serif for marketing/display moments.
- **Layout:** ruled information panels, strong reading order, generous margins, compact evidence rows.
- **Imagery:** real package/ingredient detail when licensed; abstract label textures and line illustrations otherwise.
- **Icons:** consistent 1.75–2px rounded stroke; custom barcode, provenance, ingredient-tree and evidence icons only where Lucide is insufficient.
- **Depth:** paper layering, subtle border contrast and small shadows—not glass stacks.
- **Motion:** scan line, label unfolding, evidence rows resolving, shared product continuity; opacity/transform only.
- **Landing:** scroll-driven “decode the label” demonstration.
- **App:** a decision workspace made from the same label grammar at denser spacing.
- **Mobile:** the product label becomes a compact bottom-up story; actions stay thumb-reachable.
- **A11y/perf:** strong if typography and motion budgets are enforced; fully equivalent static/reduced-motion narrative.
- **Risk:** medium—requires disciplined tokens and good editorial art direction.

### Direction 2 — Signal Lab

- **Idea:** a precise food-data instrument.
- **Character:** clinical, analytical, controlled.
- **Color/type/layout:** graphite/white/teal; a single technical sans; dense grid and chart modules.
- **Imagery/icons/depth:** minimal photography, schematic diagrams, crisp line icons, almost flat surfaces.
- **Motion:** numerical transitions and direct state changes only.
- **Landing/app/mobile:** efficient data console with excellent responsive tables and signals.
- **A11y/perf:** strongest of the three.
- **Risk:** low–medium technically, high emotionally; it may feel like a compliance dashboard rather than an everyday consumer product.

### Direction 3 — Market Garden

- **Idea:** food exploration through rich photography, seasonality and organic forms.
- **Character:** warm, optimistic, lifestyle-led.
- **Color/type/layout:** produce-inspired palette, expressive serif, asymmetrical image-led sections.
- **Imagery/icons/depth:** prominent food photography, illustrated ingredients, layered textures.
- **Motion:** richer parallax and storytelling reveals.
- **Landing/app/mobile:** memorable campaign site; lighter lifestyle app.
- **A11y/perf:** feasible only with aggressive image/motion controls.
- **Risk:** highest; can weaken provenance clarity, imply freshness/health halos, and scale poorly into dense comparison and evidence views.

Living Label scored highest in this audit because it is almost as rigorous as Signal
Lab, more memorable for first-time visitors, and more scalable into the authenticated
product than Market Garden. It also offers a promising way to turn TryVit’s evidence
model into a visual identity. That lead does not bypass the Phase 5A.2 comparison,
identity exploration, independent scoring, or Eric's explicit selection.

## Future landing-page candidate blueprint

### Landing north star

The visitor should understand TryVit within five seconds and experience its distinct value within one scroll: **a product label is decoded into nutrition, ingredients, allergen evidence, confidence, and a next choice—without pretending unknown data is safe.**

### Narrative and composition

1. **Status strip:** honest demo/data-paused statement with a status link; visually quiet but persistent.
2. **Public navigation:** Product, How it works, Coverage & confidence, Learn, Status/contact, Sign in. One primary CTA: “Explore the demo.”
3. **Hero:**
   - Headline: “Know what the label really tells you.”
   - Support: “TryVit turns nutrition, ingredients, allergens and data confidence into a clear product decision—while showing what remains unknown.”
   - Primary CTA: “Explore a product.”
   - Secondary CTA: “See how scoring works.”
   - Visual: a package/barcode fragment transforms into a Living Label sheet. Avoid unsupported live-scanner claims while the backend is paused.
4. **Interactive decode:** a local, deterministic example product. Toggling a row reveals source, confidence and meaning; no hosted request.
5. **Trust bridge:** four columns—Nutrition, Ingredients, Allergen evidence, Confidence—with current coverage explained honestly and date/source context. No vanity statistics.
6. **Evidence story:** side-by-side examples of `contains`, `may contain`, derived and unknown. The label remains the final safety reference.
7. **Decision story:** a compact comparison shows why a “better alternative” depends on selected evidence and confidence, not a universal good/bad badge.
8. **Methodology:** nine scoring factors, Nutri-Score and NOVA remain distinct, linked to Learn.
9. **Markets:** Poland and Germany presented as current supported markets, with no global implication.
10. **Engineering proof:** deterministic data checks, explainability and provenance, framed for ordinary users.
11. **Final CTA:** “Explore what TryVit can explain today.” Secondary: Learn methodology.
12. **Footer:** status, contact, Learn, methodology, privacy, terms, data sources, supported languages.

### Motion choreography

- Hero label enters as one element; a scan line reveals rows in reading order.
- Scroll changes the product preview from package → evidence sheet → comparison, using one shared product anchor.
- Cards do not float independently. Motion communicates causality and continuity.
- The only approved transition durations are 0, 120, 180, 240, 360, and 500ms:
  0ms renders the final reduced-motion state and resets state; 120ms handles press,
  direct-manipulation, and icon-state feedback; 180ms handles hover/focus response and
  disclosure or overlay exits; 240ms handles disclosure entrances and determinate
  progress; 360ms handles overlay entrances, section/evidence reveals, and spatial
  continuity; 500ms is reserved exclusively for an approved landing-page narrative
  transition.
- No animated large blur/filter layers, layout properties, autoplay video, or default WebGL.
- Reduced motion renders the final state immediately and replaces scroll choreography with clear section separators.

### Desktop wireframe

```text
┌──────────────────── demo/data status ────────────────────┐
│ TryVit | Product  How it works  Coverage  Learn | Sign in │
├────────────────────────────────────────────────────────────┤
│ HEADLINE + COPY + CTA        │ PACKAGE → LIVING LABEL      │
│ supported PL / DE            │ score / evidence / unknown  │
├────────────────────────────────────────────────────────────┤
│                 INTERACTIVE LABEL DECODE                    │
├────────────────────────────────────────────────────────────┤
│ NUTRITION │ INGREDIENTS │ ALLERGEN EVIDENCE │ CONFIDENCE   │
├────────────────────────────────────────────────────────────┤
│ evidence story                 │ comparison / next choice  │
├────────────────────────────────────────────────────────────┤
│ methodology + markets + engineering proof                 │
├────────────────────────────────────────────────────────────┤
│ final CTA                                             footer│
└────────────────────────────────────────────────────────────┘
```

### Mobile wireframe

```text
┌──────────── status ────────────┐
│ TryVit              menu/sign in│
├─────────────────────────────────┤
│ headline                         │
│ support                          │
│ [Explore] [How scoring works]    │
│                                  │
│ package                          │
│   ↓ scan                         │
│ living label sheet               │
├─────────────────────────────────┤
│ swipe-free evidence rows         │
│ Nutrition                        │
│ Ingredients                      │
│ Allergens: evidence/unknown      │
│ Confidence                       │
├─────────────────────────────────┤
│ comparison story                 │
├─────────────────────────────────┤
│ methodology / markets / CTA      │
├─────────────────────────────────┤
│ footer                           │
└─────────────────────────────────┘
```

## Future authenticated application blueprint

### Application north star

The app is a **food-decision workspace, not a generic dashboard**. Every screen should lead from item → evidence → interpretation → next action, with a stable four-destination shell: Home, Discover, Scan, Saved.

| Area | Hierarchy and actions | Responsive / motion | States, trust and accessibility |
|---|---|---|---|
| Home | Resume recent decisions; search/scan primary; saved/list activity secondary | Two-column desktop, single task stream mobile; small continuity transitions | New/returning/paused/error; page `h1`; no fake activity |
| Navigation | Home, Discover, Scan, Saved; Explore/Profile/Labs secondary; Compare contextual; Admin role-gated | Sidebar/rail/header are views of one registry; mobile bottom bar has four stable targets | Correct parent active state, skip link, localized labels, visible focus |
| Search | Query → confidence-aware results → filters; result card keeps evidence summary separate from actions | Desktop filter rail, accessible mobile Sheet; list default on mobile | Loading, no query, no result, degraded, retry; no nested controls |
| Filters | Evidence-aware inclusion/exclusion; active filter summary | Sticky desktop summary, bottom sheet mobile | Dialog semantics, Escape/focus restore, truthful allergen copy |
| Categories | Browse meaningful food groups, then results | Editorial category index; compact product list | Sort/filter empty/error states; category is not a health claim |
| Product | Identity/source → score/confidence → key evidence → nutrition/ingredients/allergens → alternatives | Compact label sheet mobile; wider evidence rail desktop; shared product transition | Complete/partial/unknown evidence; keyboard Tabs; label final reference |
| Ingredients | Plain-language ingredient identity, concern tier, source and occurrence | Progressive disclosure; no animated chart dependency | Unknown translation/source states; no medical claim |
| Allergens | Contains, may contain, derived, unknown and reserved absence; explicit/derived/legacy provenance remains orthogonal | Evidence rows with icon + label + provenance, not color alone | Unknown neutral; legacy keeps contains/may-contain type; package label final; no green default |
| Nutrition | Per-100g baseline, serving context, signal explanation | Tabular numbers and comparable rows | Missing/estimated/source states; charts annotated and keyboard-readable |
| Confidence / provenance | Compact confidence summary, then data-source ledger | Disclosure panel; no decorative gauge-only state | Plain-language reason, recency/source, screen-reader equivalent |
| Alternatives | Explain why items are comparable and what improves | Side-by-side desktop, ranked cards mobile | Require adequate matching data; no universal “healthier” claim |
| Compare | Contextual tray → workspace; aligned measures and evidence | Horizontal comparison avoids hidden critical data; mobile item switcher | Table headers, captions, keyboard control, no color-only winner |
| Saved | Lists, watchlist, saved searches/comparisons under one destination | Section tabs driven by canonical Tabs primitive | Empty/retry/permissions; card action is sibling, not nested |
| Scanner | Scan input → resolving → result/recovery → save/compare | Camera is bounded, not a full black void; result sheet connects to Product | Permission/offline/not-found/partial evidence; gated until data thresholds |
| Settings | Profile, nutrition/allergen preferences, notifications, account/privacy | Side nav desktop, accessible route list mobile—not clipped tabs | Inline errors + summary, irreversible confirmation, privacy-first copy |

Detailed architecture, component taxonomy, tokens and evidence-state specifications are in [`PHASE5_DESIGN_SYSTEM_BLUEPRINT.md`](PHASE5_DESIGN_SYSTEM_BLUEPRINT.md). Implementation sequencing is in [`PHASE5_IMPLEMENTATION_ROADMAP.md`](PHASE5_IMPLEMENTATION_ROADMAP.md).

## Content and localization

### Current findings

- EN/PL/DE dictionaries have strong key/interpolation parity and Polish plural support.
- Hardcoded English bypasses that safety on landing, Learn/legal eyebrows, admin, product labels and feedback.
- `<html lang="en">`, browser-default date formatting and English route announcements can contradict selected language.
- Dictionary parity proves presence, not native quality or health/legal equivalence.
- Root metadata, JSON-LD and PWA content are market-inconsistent.

### Voice rules

1. Lead with the decision a person can make; place method detail one layer deeper.
2. Say “evidence unavailable” or “unknown,” never imply absence.
3. Distinguish “TryVit calculates,” “the source declares,” and “the ingredient relationship suggests.”
4. Avoid “clean,” “toxic,” “safe,” “bad food,” and universal “healthier” without qualified context.
5. Prefer short active CTA labels; do not translate idioms literally.
6. Format dates, numbers, units and decimal separators using the selected locale.
7. Test 30–40% text expansion and compound German labels at every breakpoint.

### Human approvals required

- Phase 5A.2 art-direction and identity selection after comparison of up to three
  coherent candidates; the current mark and Living Label direction remain provisional
  until then.
- Final brand palette, type pairing, icon/illustration language, logomark evolution and
  photography rights.
- All six Golden References—landing, authentication, authenticated home, search,
  product/evidence, and scanner—after two independent fresh-context reviews meet the
  documented rubric and veto rules.
- Final motion language, including full-motion recordings and equivalent reduced-motion
  behavior.
- Final public headline and any “healthier/better” comparison language.
- Support/status address and ownership.
- Native PL/DE review of allergens, health, legal, privacy and account-deletion copy.
- Legal review of source attribution, product imagery, external data licenses and package-label disclaimer.
- Whether current coverage figures are shown publicly, how often they update, and who owns their accuracy.
- Whether assessed-absence data will ever be collected; the redesign must not assume it.
- Whether the inactive backend remains a portfolio demo state or a launch blocker.

## Decision

Use Living Label as the strongest current hypothesis while keeping the semantic
foundation direction-resilient. Phase 5A.1 remains exactly two non-production-route
Design System V2 PRs. Phase 5A.2 is the mandatory non-production Experience
Architecture and Golden Reference Gate defined in
[`PHASE5A2_EXPERIENCE_ARCHITECTURE_GOLDEN_REFERENCE.md`](PHASE5A2_EXPERIENCE_ARCHITECTURE_GOLDEN_REFERENCE.md).
Production redesign begins in Phase 5A.3 only after that gate passes and Eric explicitly
approves the art direction, identity, and six references. The staged acceptance and
rollback plan is in [`PHASE5_IMPLEMENTATION_ROADMAP.md`](PHASE5_IMPLEMENTATION_ROADMAP.md).
