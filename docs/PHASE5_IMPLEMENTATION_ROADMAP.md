# Phase 5 Implementation Roadmap

> **Last updated:** 2026-07-30
> **Status:** Active — staged implementation plan; no implementation is included
> **Owner issue:** Frontend domain

## Decision

Phase 5 should begin with **public-experience foundations**, not with visual styling in isolation.

The first implementation phase is:

> **Phase 5A.0 — Public Experience Foundation Gate**

It establishes a correct public-route contract, a genuinely backend-independent demo/public path, route-group provider isolation, server-led public rendering, fail-closed local visual tooling, and authoritative landing performance/visual gates. This work is intentionally visually neutral. It gives the later Living Label redesign a trustworthy, measurable platform.

The precise first PR is **Phase 5A.0a — Local Visual-Test Safety**. It closes the demonstrated stale-compiled-client risk before any further authenticated screenshot run. The remaining 5A.0 contracts then ship independently as 5A.0b route/PWA policy, 5A.0c demo/provider/rendering/locale, and 5A.0d measurement/baselines.

Phase 5A then continues with Design System V2 and the visitor experience. The former `codex/phase-5a-visitor-experience` branch predates the allergen preflight and must never be reused or merged into this program.

## Weighted implementation priority

Scores are 0–10. “Implementation risk” is scored higher when the work is safer/more reversible. The weighted total uses: user impact 20%, trust/safety 15%, brand 15%, design-system leverage 15%, accessibility 10%, performance 10%, risk 10%, and portfolio/demo value 5%.

| Rank | Direction | User | Trust | Brand | DS | A11y | Perf | Risk | Portfolio | Weighted |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | **Public foundation gate** | 9 | 10 | 7 | 9 | 8 | 10 | 8 | 7 | **8.65** |
| 2 | Product detail and evidence | 10 | 10 | 8 | 8 | 9 | 7 | 6 | 9 | **8.55** |
| 3 | Token/design-system foundation | 8 | 9 | 8 | 10 | 9 | 7 | 8 | 7 | **8.40** |
| 4 | Search and discovery | 10 | 9 | 7 | 8 | 9 | 7 | 6 | 9 | **8.25** |
| 5 | Navigation/application shell | 8 | 8 | 7 | 9 | 9 | 8 | 7 | 7 | **7.95** |
| 6 | Landing-page redesign | 9 | 8 | 10 | 6 | 7 | 6 | 6 | 10 | **7.80** |
| 7 | Settings/onboarding | 7 | 8 | 6 | 6 | 9 | 7 | 7 | 6 | **7.00** |
| 8 | Motion and polish | 6 | 6 | 10 | 6 | 5 | 4 | 5 | 10 | **6.40** |
| 9 | Scanner visual redesign | 6 | 6 | 9 | 5 | 7 | 5 | 5 | 9 | **6.35** |

Product detail ranks highly on direct user value, but it depends on correct primitives, semantic tokens, route states and app shell. The public foundation is the only safe first move because it prevents backend coupling and unsafe visual fixtures from contaminating every later review.

## Program guardrails

These apply to every Phase 5 PR:

- Preserve Phase 5 Preflight A allergen semantics and API compatibility.
- Unknown allergen evidence remains neutral; no inferred or green “free from” state.
- Do not modify hosted Supabase state, deploy production, restore the inactive backend, or conceal the known 503.
- Do not change data-quality thresholds, Phase 4 checksums, scoring, scanner behavior or database contracts unless a later separately authorized phase explicitly requires it.
- Use local deterministic fixtures and reject non-loopback backend hosts.
- No dependency addition merely for aesthetics. A new dependency requires a bundle, maintenance, accessibility and security case.
- One route family or infrastructure contract per PR; no big-bang component rewrite.
- Every visual PR includes meaningful light/dark/mobile/tablet/desktop screenshots, reduced-motion behavior, and before/after evidence.
- Every PR has a route-level rollback boundary and remains draft until its required verification passes.

## Roadmap overview

| Phase | Objective | Primary surface | PR shape | Recommended model / effort |
|---|---|---|---|---|
| 5A.0 | Make public/demo rendering truthful, backend-independent and measurable | Visual safety, proxy/PWA, provider topology, landing architecture, visual/perf CI | 4 focused PRs; the exact prompt below covers 5A.0a only | GPT-5.6 Sol / Ultra |
| 5A.1 | Establish Design System V2 foundations and public/auth shells | Tokens, typography, primitives, route locale, component catalog | 2 focused PRs | GPT-5.6 Sol / XHigh |
| 5A.2 | Deliver Living Label landing, Learn/legal/support and auth visual cohesion | Public visitor journey | 2–3 route-family PRs | GPT-5.6 Sol / Ultra for landing; High for follow-ups |
| 5B | Create one app shell, route manifest and accessible navigation/overlay system | `/app` shell and global interactions | 2 focused PRs | GPT-5.6 Sol / XHigh |
| 5C.1 | Redesign discovery | Search, filters, categories | 2 PRs | GPT-5.6 Sol / High |
| 5C.2 | Redesign product decision and evidence | Product, ingredient, compare, alternatives | 2–3 PRs | GPT-5.6 Sol / Ultra |
| 5D | Unify personal journeys | Dashboard, onboarding, saved, settings, recipes | 3–4 PRs | GPT-5.6 Sol / High |
| 5E | Integrate scanner visually after readiness gate | Scan/result/history/submission/image search | 2 PRs, gated | GPT-5.6 Sol / XHigh |
| 5F | Close accessibility, performance, localization and rollout gaps | Complete route matrix | Several small hardening PRs | GPT-5.6 Terra / High; Sol for defects |

### Per-phase delivery contract

| Phase | Dependencies | Routes, components and expected architecture areas | Required screenshots and tests | Accessibility and performance gate | Rollback / PR boundary |
|---|---|---|---|---|---|
| 5A.0 | Merged audit and allergen preflight | Local fixture/network guard; public/system/auth/share policy; `proxy.ts`; PWA; Supabase middleware ordering; root/route-group layouts; `Providers`; public locale and landing Server/Client split; Lighthouse, bundle and visual workflows | 390/768/1024/1280/1440 landing/shell coverage as applicable; auth/offline/share; reduced motion; host/network guard, route/proxy/provider/i18n/unit/type/lint/build/Playwright/axe/Lighthouse/CI | Public reachability, no unintended backend traffic, preserved focus/landmarks; LCP ≤2.5s, TTFB ≤800ms, mobile ≥0.90, desktop ≥0.95, TBT ≤200ms, CLS ≤0.05, JS budgets | Four independent PRs: 5A.0a safety; 5A.0b route/PWA; 5A.0c provider/rendering/locale; 5A.0d gates/baselines |
| 5A.1 | 5A.0 green | `frontend/src/design-system/**`; `globals.css` mapping; compatibility facades; `/dev/components`; root locale/skip link; Button/CardLink/Field/Dialog/Sheet/Menu/Tabs/Tooltip/PageState | Component catalog at 390/768/1440, light/dark/reduced/high contrast; token schema, compiled utilities, contrast, interaction, type/lint/build/axe/Playwright | WCAG 2.2 primitive contracts; no route-JS regression; fonts ≤100KiB if adopted | Two PRs: tokens/foundations, then primitives/facades; V1 remains available |
| 5A.2 | 5A.0 and 5A.1; approved brand/copy/support decisions | `/`, `/learn/**`, `/contact`, `/privacy`, `/terms`, `/forbidden`, `/offline`, `/auth/**`; PublicShell/AuthShell; LivingLabelDemo; marketing/evidence components; metadata/social assets | Full 390/768/1440 light/dark public matrix; normal/reduced-motion story; EN/PL/DE; visual/Lighthouse/axe/Playwright | Headings, reflow, focus, motion equivalence; all Phase 5 public budgets, hero ≤250KiB, cold load ≤900KiB | Landing, editorial/legal, and auth are separate route-family PRs |
| 5B | 5A.1 primitives | `/app` shell; route manifest; DesktopSidebar/HeaderNav/Navigation/MoreDrawer; Breadcrumbs; route announcements; app loading/error boundaries; Admin policy | New/returning/error shell at 320/390/768/1024/1440 light/dark; nav-role unit tests; keyboard, screen-reader and Playwright journeys | Stable nav, skip/focus, 320 reflow, 200% zoom, localized announcements; shell bundle within budget | Route manifest can feed old shell first; shell view replacement is a separate PR |
| 5C.1 | 5B shell and Sheet/Combobox/CardLink | `/app/search`, `/app/search/saved` entry, `/app/categories`, `/app/categories/[slug]`; SearchAutocomplete, FilterPanel, ActiveFilterChips, result/product cards | Complete/unknown evidence results; no-query/loading/empty/error/degraded; 390/768/1440 light/dark; filter/combobox keyboard and search performance tests | No nested controls; truthful filters; dialog/combobox contracts; search response/render and route JS within baseline | Search and category PRs separate; API unchanged |
| 5C.2 | 5C.1 discovery plus Tabs/data-display primitives | `/app/product/[id]`, `/app/ingredient/[id]`, `/app/compare`, alternatives and contextual tray; product/evidence/chart/table components | Five display-status fixtures plus explicit/derived/legacy basis combinations and mixed/partial/error; product/compare at 390/768/1440 light/dark; tabs/table/chart/visual/perf journeys | Evidence never color-only; package-label reference; keyboard tables/tabs; lazy detail panels and route budgets | Summary/evidence, detail tabs/ingredient, and compare are separate PRs |
| 5D | 5B shell; 5C cards/evidence where reused | `/app`, `/onboarding*`, lists/watchlist, saved search/compare, recipes, achievements, `/app/settings*`; forms, dialogs and PageState | New/returning/empty/error/permission/form-error at 390/768/1440; EN/PL/DE; form and destructive-action Playwright | Immediate locale change, inline+summary errors, 320/200% settings, no nested card actions; no budget regressions | Dashboard/onboarding, saved, settings, and secondary content ship separately |
| 5E | Explicit scanner/data-readiness approval plus 5C product patterns | `/app/scan*`, `/app/image-search`; scan components, camera frame, result sheet, contribution states | Permission/scan/manual/not-found/offline/partial/complete at phone/tablet; reduced motion; camera-independent path; performance/battery-oriented tests | Non-camera alternative, visible recovery, unknown evidence, bounded camera; no long animation tasks or route budget regression | Scan entry/results and history/contribution are separate PRs; scanner behavior unchanged unless separately authorized |
| 5F | All migration phases | Remaining 54-route matrix, Admin/experimental routes, PWA/metadata, visual catalog, legacy token/component cleanup, rollout docs | Every route/state fixture at target widths/themes; WCAG manual matrix; native-copy review; Lighthouse/bundle/visual/CI | WCAG 2.2 AA release matrix, all budgets, blocking local visual tests and monitored field plan | Small hardening/cleanup PRs; production rollout remains a separate authorization |

## Phase 5A.0 — Public Experience Foundation Gate

### Objective

Make the public site reliable with an intentionally paused data backend and establish safe, authoritative measurement before changing its visual identity.

### Mandatory PR sequence

1. **5A.0a — Local Visual-Test Safety:** reusable loopback configuration guard, clean build/server lifecycle and browser-level network blocking. No route/rendering change.
2. **5A.0b — Public Route and PWA Contract:** one route-policy schema, proxy behavior, shared/offline/metadata reachability, manifest orientation/shortcuts and contradictory-test reconciliation.
3. **5A.0c — Demo Provider, Locale and Server Rendering:** backend-independent public provider topology, minimal server-resolvable public locale/`html[lang]` contract, and landing Server Component/client islands with visual parity.
4. **5A.0d — Performance and Visual Gates:** route-specific JS, Lighthouse, deterministic local baselines and measurement protocols.

Each PR is reviewed and verified before the next begins. Do not combine them into one squash PR.

### Scope

- Public/system routes: `/`, `/contact`, `/privacy`, `/terms`, `/forbidden`, `/offline`, `/learn/**`, `/auth/**`, `/compare/shared/[token]`, `/lists/shared/[token]`, manifest, service worker, robots, sitemap and Open Graph image.
- `frontend/src/proxy.ts` and Supabase middleware construction order.
- Root and route-group layouts/providers.
- Minimal public locale selection/`html[lang]` contract and landing Server Component/client-island boundary.
- Visual-audit/PR-screenshot loopback guards and deterministic public fixtures.
- Landing Lighthouse, route-bundle and visual-baseline configuration.

### Explicit non-scope

- No Living Label restyle, new typography, new illustrations, copy campaign, design tokens or app-shell redesign.
- No hosted auth, database, Vercel, scanner, dependencies, API/RPC or schema change.
- Do not invent a support address; document the human decision if it remains unavailable.

### Exact acceptance criteria

1. A single typed public-route policy drives proxy classification and tests. It is the initial public/auth schema of the route manifest that Phase 5B extends, not a second registry.
2. Every intended public/system asset and page returns its expected unauthenticated response and never redirects to login.
3. Every protected app/admin route still requires the correct authentication/role policy.
4. Backend-independent public/system routes are classified before a Supabase client is constructed or `getUser()` is called. Auth-entry routes are a separate class: they remain public to signed-out visitors but may perform the documented signed-in redirect. Public-share routes remain anonymous-accessible while their data request can truthfully degrade.
5. In demo mode, loading `/` makes zero requests to Supabase Auth, REST or Realtime and zero `/api/flags` requests.
6. Public routes do not mount Query, flags, achievements or authenticated-only providers; required global accessibility/theme behavior remains available.
7. Static landing content renders on the server. Client islands are limited to demonstrated interactive needs and no client consumer imports all three dictionaries.
8. Existing visible output remains intentionally visually equivalent, apart from unavoidable semantics/focus corrections documented in screenshots.
9. Every browser helper validates the app host as loopback. A helper that uses Supabase also validates its Supabase host as loopback; secret-free public helpers require no Supabase URL/key. Browser request interception blocks and fails every non-loopback Supabase/Auth/REST/Realtime request, catching a stale compiled client even when process environment checks pass.
10. Public screenshot tests run secret-free with deterministic local/demo fixtures and stable reduced-motion settings.
11. `/` is included in mobile and desktop Lighthouse checks; route-specific compressed first-load JS is measured from production builds with shared/dynamic chunk attribution documented and the base/head built on the same runner.
12. The bundle gate treats reductions as success and fails increases exceeding either +10KiB or +5%.
13. Landing budgets pass under a pinned Lighthouse version/device profile with documented aggregation: mobile Lighthouse ≥0.90, desktop ≥0.95, accessibility/best-practices/SEO ≥0.95, LCP ≤2.5s, TTFB ≤800ms, TBT ≤200ms, CLS ≤0.05, and zero critical/serious axe violations. INP ≤200ms at p75 remains a post-release field target, not a lab CI claim. If authorized architecture work cannot meet a budget, stop and report measured evidence rather than weakening it.
14. Public landing initial client JS targets ≤180KiB gzip and public informational routes ≤150KiB gzip. Record exact baselines and fail regressions.
15. Visual diff setup documents renderer, fonts, animation stabilization, dynamic masks and pixel thresholds. Animation trace limits remain nonblocking until the measurement protocol is implemented; they cannot be claimed as measured early.
16. No unexpected console errors, hydration errors or first-party 4xx/5xx occur in the public matrix. The known `/api/health` 503 remains outside the public-page success contract and is not concealed.
17. The PWA manifest no longer forces portrait without an approved accessibility exception, and shortcuts resolve to the current search/list routes.
18. EN/PL/DE route copy remains semantically equivalent; existing allergen wording tests remain green.
19. Repository hygiene, unit/type/lint/build, focused proxy/provider/i18n tests, public Playwright, accessibility, Lighthouse, visual checks, PR Gate, CodeQL, exact-head Main Gate and SonarCloud pass.
20. Each PR remains draft until its own acceptance subset passes and contains no redesign implementation.

### Required screenshots

- Landing at 390×844, 768×1024, 1024×768, 1280×800 and 1440×900, light and dark.
- Login at 390×844 and 1440×900, light and dark.
- Offline, shared-list invalid token and shared-comparison invalid token at mobile and desktop.
- Reduced-motion landing at mobile and desktop.
- One network assertion artifact proving zero Supabase/flags traffic in demo mode.

### Accessibility requirements

- Existing visible focus, landmarks, heading order and live-region behavior do not regress.
- Public/system routes remain reachable without authentication.
- Stable snapshots do not disable content in reduced motion.
- No new nested controls or inaccessible status-only color treatment.

### Rollback boundary

Revert Phase 5A.0 PRs to restore prior proxy/provider/landing architecture. No database, migration, dependency or visual-token rollback is involved.

## Phase 5A.1 — Design System V2 foundations

### Objective

Introduce the Living Label token hierarchy and canonical accessibility primitives without performing a mass page restyle.

### Scope

- `frontend/src/design-system/tokens`, foundations, initial primitives and component-test catalog.
- Correct Tailwind semantic mappings and remove token cycles.
- Candidate Manrope/Source Serif 4 loading through a measured built-in font path, only after validating Latin Extended and the 100KiB budget.
- Canonical Button, IconButton, Surface, CardLink, Field, Dialog, Sheet, Menu, Tabs, Tooltip and PageState.
- Compatibility facades for existing shared components.
- Complete component-level locale/announcement contract and skip link, extending the minimal public `html[lang]` contract from 5A.0c.

### Acceptance

- Token schema and compiled-utility tests pass in light/dark/high-contrast modes.
- Every documented normal-text pair is ≥4.5:1; meaningful UI/focus pairs are ≥3:1.
- All allergen evidence states pass semantic, contrast and EN/PL/DE tests.
- Primitive keyboard/focus/reduced-motion contracts pass unit and Playwright component journeys.
- Legacy class/value allowlist is recorded and new arbitrary shadow/radius/transition usage fails.
- A generated route/component dependency report validates every current route and component, records client-boundary status and migration/removal gates, and fails when inventory drift is unclassified.
- No route is visually migrated except `/dev/components` and minimal facade parity fixtures.

### Screenshots/tests/rollback

Capture the full component catalog at 390, 768 and 1440 in light/dark/reduced-motion/high-contrast. Run unit, type, lint, build, axe, Playwright and token validation. V2 exists alongside V1 and can be removed by reverting the focused PR.

## Phase 5A.2 — Living Label visitor experience

### Objective

Deliver the memorable public experience after Phase 5A.0/5A.1 gates are green.

### Scope

- Landing, public shell, status treatment, deterministic Living Label demo, Learn hub/articles, contact, privacy, terms, forbidden/offline and auth shell.
- Approved EN/PL/DE marketing and support copy, metadata, sitemap and social preview.
- Purposeful scroll narrative with equivalent reduced-motion output.

### Acceptance

- A visitor understands product, evidence boundaries, PL/DE support and paused state within the first viewport.
- No fake testimonials, statistics, partnerships, safety claims or implied global coverage.
- Demo is deterministic and backend-independent.
- All Phase 5 budgets remain green; hero media ≤250KiB and total cold mobile transfer ≤900KiB.
- Required 390/768/1440 light/dark screenshots and motion/reduced-motion behavioral tests pass.
- Human approval exists for final headline, support/status path, imagery rights and sensitive PL/DE copy.

### Rollback

Public route-family PRs are independently revertible; Design System V2 remains intact.

## Phase 5B — Application shell and information architecture

### Objective

Make the authenticated app feel like the same Living Label product and establish one navigation/overlay contract.

### Scope

- Typed route manifest; Home, Discover, Scan and Saved primary destinations.
- App shell, desktop rail/header, mobile navigation, More/Profile/Explore groups, breadcrumbs, route announcements and role-gated Admin.
- Route-level loading/error boundaries and PageState adoption.
- Canonical Dialog, Sheet, Menu and Tabs adoption in global shell interactions.

### Acceptance

- Parent active states are stable across all breakpoints.
- Admin is absent for unauthorized users.
- Keyboard, focus restoration, skip link, 320px reflow, 200% zoom and EN/PL/DE labels pass.
- Shell/client bundle does not regress beyond the route budgets.
- Screenshots cover dashboard shell at 320/390/768/1024/1440, light/dark, new/returning/error.

### Rollback

Route manifest may feed old shell views during migration; new shell PR is independently revertible.

## Phase 5C.1 — Discovery: search, filters and categories

### Objective

Create a fast evidence-aware route from query/category to product decision.

### Scope

- `/app/search`, filter sheet/rail, active filters, autocomplete, saved-search entry points, categories index/detail and product-result cards.
- Split the 992-line search page and 548-line autocomplete by controller/state/presentation responsibilities.

### Acceptance

- Contains/may-contain/unknown filter semantics remain truthful.
- No interactive descendants inside product links.
- Combobox, Sheet and filter controls pass complete keyboard/screen-reader tests.
- Loading, no-query, empty, error, retry, degraded and pagination states share PageState rules.
- Meaningful product fixtures cover complete and unknown evidence at all three viewports.
- Search performance and route JS meet recorded budgets.

### Rollback

Search and categories are separate PRs; API contracts remain unchanged.

## Phase 5C.2 — Product decision, evidence, alternatives and compare

### Objective

Make TryVit’s strongest technical idea—the explainable, uncertain food decision—its strongest product experience.

### Scope

- Product and ingredient detail, score/confidence/provenance, nutrition, allergens, ingredient interpretation, alternatives, comparison tray/workspace and saved comparison handoff.
- Split the 1,174-line product page and 758-line comparison grid.

### Acceptance

- Above-fold identity, source, score/confidence and most consequential evidence have a stable reading order.
- All five display statuses and all three evidence bases render correctly without flattening legacy contains/may-contain provenance; the package-label disclaimer is visible and equivalent in EN/PL/DE.
- Inactive expensive tabs can load independently without hiding essential data.
- Tabs/tables/charts meet keyboard, accessible-name and non-color requirements.
- Alternatives explain comparison basis and confidence; no universal health claim.
- Product fixtures include explicit contains, may contain, derived, legacy, unknown and mixed evidence.
- Product/compare performance, visual and accessibility budgets pass.

### Rollback

Migrate summary/evidence, then detail tabs, then comparison in separate PRs behind compatibility facades.

## Phase 5D — Personal journeys

### Objective

Unify onboarding, home, saved content and settings without letting gamification dominate product truth.

### Scope

- Dashboard, onboarding, lists, watchlist, saved searches/comparisons, recipes, settings, account/privacy, notifications and achievements.

### Acceptance

- Onboarding language changes immediately and persists in the correct user/session scope.
- Every form uses inline errors plus linked summary; destructive actions use canonical Dialog.
- New/empty/retry/permission states have one hierarchy.
- List cards use sibling actions; sharing follows corrected public policy.
- Settings work at 320px and 200% zoom without clipped tab strips.
- Each route family ships as its own reversible PR with meaningful fixtures.

## Phase 5E — Scanner visual integration (readiness-gated)

### Entry gate

Do not start because the rest of the app looks polished. Start only when a checkpoint defines and meets minimum barcode lookup, ingredient evidence, allergen evidence and result usefulness thresholds for representative PL/DE samples.

### Objective and scope

Integrate scan, result, history, contribution and image-search routes into Living Label without changing scanner/data behavior unless separately authorized.

### Acceptance

- Permission, initialization, scan, manual entry, lookup, not found, offline, partial evidence, contribution and success states are all usable.
- Camera viewport is bounded and recovery action remains visible.
- Unknown evidence is explicit after a successful scan.
- Battery/main-thread/animation work stays within budgets; reduced motion and non-camera entry are first-class.
- No scanner metric is claimed without measured evidence.

## Phase 5F — Cohesion and launch gate

### Objective

Close remaining route, localization, accessibility, performance and regression gaps before public rollout.

### Scope

- Admin/experimental polish where valuable, all 54 route entries, all PageState variants, PWA/offline, metadata, visual catalog, legacy token/component removal and production rollout plan.

### Exit criteria

- 54/54 routes mapped and either migrated, intentionally retained or explicitly deferred.
- WCAG 2.2 AA automated/manual matrix complete at 320/390/768/1024/1280/1440 and 200% zoom.
- EN/PL/DE native/domain review complete for consequential copy.
- Critical local visual baselines are blocking and secret-free.
- Core Web Vitals field monitoring plan exists; lab budgets pass.
- Zero unauthorized legacy class growth and zero orphaned deprecated components.
- Production rollout, monitoring and rollback are separately authorized; this roadmap itself does not deploy.

## Exact next implementation prompt

Use the following only after the audit PR is reviewed, squash-merged, and the actual merged `main` SHA is verified. Replace `<VERIFIED_AUDIT_MAIN_SHA>` with that commit. It implements **Phase 5A.0a only**. Recommended execution: **GPT-5.6 Sol, Ultra effort**.

```text
Implement Phase 5A.0a of TryVit: Local Visual-Test Safety.

Start from the verified main SHA produced by merging the Phase 5 master experience audit:

<VERIFIED_AUDIT_MAIN_SHA>

Create and push a clean branch named:

codex/phase-5a0a-local-visual-safety

Objective:

Make every browser, screenshot and authenticated fixture workflow fail closed before it can contact or authenticate against a hosted Supabase project. Close the exact audit incident in which a process intended for local fixtures served a stale compiled client containing the inactive hosted Supabase URL.

This is one narrow infrastructure-safety PR. Do not implement the public-route policy, demo provider split, landing Server Component conversion, localization architecture, performance gates, visual baselines, Design System V2 or the Living Label redesign.

Read first:

- docs/PHASE5_MASTER_EXPERIENCE_AUDIT.md
- docs/PHASE5_DESIGN_SYSTEM_BLUEPRINT.md
- docs/PHASE5_IMPLEMENTATION_ROADMAP.md
- docs/phase5/route-component-inventory.json
- docs/ENVIRONMENT_STRATEGY.md
- docs/VIEWING_AND_TESTING.md
- frontend/playwright.config.ts
- frontend/e2e/visual-audit.spec.ts
- frontend/e2e/pr-screenshots.spec.ts
- frontend/e2e/helpers/**
- .github/workflows/pr-screenshots.yml
- every script that starts a browser server or provisions/deletes a test user

Constraints before action:

- Confirm the checkout is exactly <VERIFIED_AUDIT_MAIN_SHA>, clean and synchronized with main.
- Do not access, authenticate against, read authenticated data from, or write to either hosted Supabase project.
- Do not deploy or modify Vercel.
- Do not print any key, token or full credential-bearing URL.
- Do not change product UI, routing behavior, database code, APIs, scanner behavior, dependencies or lockfiles.
- Make no code change until the complete current fixture/server/browser path is documented and the exact gap is reproduced only with synthetic URLs or mocks—not a real hosted request.

1. Map the complete risk surface

Inventory every path that can:

- start the Next.js server for Playwright or screenshot capture;
- load NEXT_PUBLIC_SUPABASE_URL or a Supabase key;
- reuse .next output;
- create a Supabase browser/server/admin client;
- create, confirm, authenticate or delete a fixture user;
- invoke admin APIs;
- navigate a browser before configuration validation;
- receive hosted staging or production secrets in CI.

Document the call order for:

configuration load → build/dev server → browser/context creation → request interception → page navigation → user provisioning/authentication → cleanup.

Identify which helpers are public and backend-independent versus which genuinely require a local Supabase emulator.

2. Add one reusable loopback-origin guard

Create one small, testable safety module for browser/fixture infrastructure.

Requirements:

- Parse URLs with the platform URL parser.
- The application origin must always be loopback.
- A Supabase origin is required only for a helper that actually uses Supabase.
- Allowed hostnames are exactly:
  - localhost
  - 127.0.0.1
  - [::1] / ::1 as normalized by the URL parser
- Reject:
  - any .supabase.co host;
  - any Vercel or staging/production host;
  - localhost as a suffix or username, such as localhost.example.com or localhost@evil.example;
  - 0.0.0.0 and LAN/private-network hosts;
  - missing/invalid schemes;
  - credential-bearing URLs;
  - non-HTTP(S) URLs;
  - any unrecognized hostname.
- Fail before browser creation, page navigation, user provisioning, admin-client construction or network activity.
- Error messages may report only the rejected hostname/category. Never print keys, query strings, credentials or full secret-bearing URLs.

Do not duplicate this validation across specs.

3. Guard stale or mismatched compiled clients

Environment validation alone is insufficient because a reused .next build can contain a different public Supabase origin.

Implement a deterministic clean-build/server contract for fixture runs:

- resolve and validate the exact frontend workspace and disposable .next target before any cleanup;
- never delete outside the verified frontend build directory;
- ensure a fixture run cannot silently reuse a build produced for a different public Supabase origin;
- record a non-secret build-origin fingerprint or equivalent provenance check;
- fail clearly when build/runtime origins do not match;
- do not store a key, token or full credential in the fingerprint.

Do not rely only on searching process environment variables.

4. Add browser-level network enforcement

Install request blocking before the first page navigation for every fixture/browser context that can reach authenticated code.

Requirements:

- Abort and fail the test on every Supabase Auth, REST, Realtime, Storage or Functions request whose hostname is not loopback.
- Explicitly fail every request to .supabase.co.
- Detect a remote request even when the test-process configuration itself is local.
- Treat HTTP(S) and WebSocket egress as separate surfaces: use Playwright HTTP routing for requests and `routeWebSocket` for Realtime `ws:`/`wss:` connections before navigation.
- Configure these safety-fixture contexts with `serviceWorkers: 'block'` so a service worker cannot handle an outbound request before Playwright routing sees it. If an existing test must exercise a service worker, isolate it and add an equivalent lower-level egress assertion rather than weakening this fixture guard.
- Record only a redacted origin/category in failure output.
- Public demo screenshot helpers run without any Supabase URL or service-role key; they still fail any unexpected Supabase request.
- Do not make a real remote request to test the blocker. Use route interception, a synthetic page/request target, mocks or a local harness.

5. Harden fixture lifecycle and CI

- Apply the guard before any user create/auth/delete or admin-client operation.
- For Node-side provisioning, authentication, admin and cleanup HTTP calls, disable automatic redirect following with `redirect: 'manual'`, or validate every `Location` target with the same loopback guard before following it. A loopback first hop must never authorize a second hop to a hosted origin.
- Cleanup is local-only and runs only after the same guard succeeds.
- Remove hosted Supabase secrets from public screenshot jobs where they are unnecessary.
- Authenticated screenshot jobs must require the local emulator and fail if it is unavailable; do not fall back to a hosted project.
- Ensure failed preflight leaves no browser, server or local fixture process running.
- Keep Windows and Linux behavior deterministic.
- Do not weaken existing Playwright, security or repository checks.

6. Tests

Add focused tests for:

- localhost application URL accepted;
- 127.0.0.1 accepted;
- normalized IPv6 loopback accepted;
- .supabase.co rejected;
- Vercel and arbitrary public hosts rejected;
- localhost.example.com rejected;
- localhost@evil.example rejected;
- LAN/private IP and 0.0.0.0 rejected;
- credential-bearing, invalid-scheme and malformed URLs rejected;
- public helper succeeds without Supabase configuration;
- authenticated helper fails when local Supabase configuration is missing;
- no browser/user/admin action occurs after preflight failure;
- a synthetic stale-client request to a hosted Supabase origin is blocked before network transmission;
- local process configuration plus a synthetic remote browser request still fails;
- a synthetic `wss://example.supabase.co/realtime/v1` attempt is blocked through `routeWebSocket` without transmitting to the hosted origin;
- fixture contexts block service workers, or an isolated service-worker test proves outbound traffic cannot bypass the egress guard;
- a synthetic loopback response redirecting to a hosted origin is not followed by Node provisioning/auth/admin/cleanup code, and no second request is transmitted;
- build-origin mismatch fails without exposing secrets;
- cleanup target resolution cannot escape the exact frontend .next directory;
- failure cleanup leaves no child process running;
- equivalent Windows and Linux URL/path behavior.

7. Verification

Run only verification appropriate to this infrastructure-safety PR:

- focused guard and lifecycle unit tests;
- focused Playwright safety tests using mocks/local loopback only;
- a local-emulator authenticated fixture dry run if the emulator is available and the guard proves loopback first;
- a backend-free public screenshot dry run;
- complete frontend unit suite;
- TypeScript type-check;
- lint;
- production build;
- repository hygiene;
- documentation index/path checks for any changed docs;
- PR Gate;
- CodeQL;
- exact-head Main Gate and SonarCloud.

Do not run a remote migration or full database replay. Do not contact a hosted Supabase endpoint as a “negative test.”

8. Delivery

- Update only documentation required by actual fixture-safety behavior.
- Use focused Conventional Commits.
- Push codex/phase-5a0a-local-visual-safety.
- Open a draft PR.
- Do not mark it ready and do not merge it.

At completion report:

1. Final head SHA.
2. Complete fixture/server/browser call-order map.
3. Exact original safety gap.
4. Guard API and allowed/rejected origin rules.
5. Build-origin mismatch protection.
6. Browser HTTP, WebSocket and service-worker egress behavior.
7. Public versus authenticated fixture behavior.
8. Proof that negative tests used no real hosted request.
9. Windows and Linux path/URL results.
10. Focused, frontend, build and Playwright results.
11. PR Gate, CodeQL, Main Gate and SonarCloud results.
12. Working-tree state.
13. Confirmation that no hosted Supabase project was contacted, redirected to, authenticated against or modified.
14. Confirmation that no product UI, route behavior, database, API, scanner, dependency, Vercel configuration or deployment changed.
15. Draft PR URL.
16. Whether Phase 5A.0a is genuinely ready for final review.
17. Remaining prerequisites for Phase 5A.0b.

Do not begin Phase 5A.0b, Phase 5A.1 or any visual redesign.
```
