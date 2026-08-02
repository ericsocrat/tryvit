# Phase 5A.0c — Demo Provider, Locale, and Server Rendering

> **Status:** Implemented on the Phase 5A.0c branch; draft-PR verification applies
> **Scope:** Architecture and correctness only
> **Visual redesign:** Not included
> **Hosted services:** Not accessed or modified

## Objective

Phase 5A.0c makes TryVit's public experience independent of Supabase in the
explicit demo/paused-data state. It also introduces a small request-locale
contract for EN, PL, and DE, and moves the landing narrative from one broad
client component to server-led rendering with small, explicitly owned
interactive islands.

The phase deliberately preserves the existing visual language. It does not
implement Living Label, Design System V2, performance baselines, Phase 5A.0d,
or any product redesign.

## Provider inventory and boundary

### Before

The root `Providers` component mounted on every route and owned:

- TanStack Query;
- the Supabase-backed flag provider and realtime subscription;
- achievement-event middleware;
- web-vitals reporting;
- tooltip context;
- route announcements;
- notifications.

As a result, the landing route created a Supabase client and requested
`/api/flags` even when public data was intentionally paused. The landing header
and body also performed two separate client-side auth probes. Public shared
lists relied on the root Query provider, while public comparisons created a
second local Query provider.

### After

| Boundary | Mounted behavior | Backend dependency |
| --- | --- | --- |
| Root `Providers` | language/document synchronization, tooltip context, route announcement, notifications | None |
| `/app` `AuthenticatedProviders` | TanStack Query, flags/realtime, achievement middleware, web-vitals reporting | Authenticated application backend |
| Auth and onboarding routes | root backend-neutral behavior only | Route-owned auth behavior only |
| Landing and editorial routes | root backend-neutral behavior only | None in demo mode |
| Anonymous share routes | guarded server read only when deployment readiness is explicitly live; deterministic unavailable state otherwise | None in demo mode |

This topology keeps product-detail hydration and every authenticated Query
consumer beneath `/app`, while public routes no longer inherit authenticated
application infrastructure.

Signed-in landing CTA personalization remains available only when readiness is
explicitly live. One live-only auth-state boundary shares a single client,
initial user lookup, and subscription across the header, hero, and closing CTA;
the action islands retain the existing Dashboard destination for signed-in
visitors and the sign-in/sign-up actions for signed-out visitors. That boundary
is not mounted in demo mode, so paused public rendering performs no auth probe.

Signed-in visits to public Learn routes no longer initialize achievement
tracking merely by mounting the public shell. Achievement behavior remains
owned by the authenticated application boundary.

## Request locale and `html[lang]`

The server locale source is the request `Accept-Language` header. The resolver:

- supports `en`, `pl`, and `de`;
- reduces regional tags such as `pl-PL` and `de-DE` to their supported primary
  language;
- honors quality weights and original order for equal weights;
- excludes `q=0` and malformed or out-of-range quality values;
- resolves wildcards and unsupported input to deterministic English.

The root layout resolves the value once per React server request and renders it
on `html[lang]`. A tiny dictionary-free root client context supplies that same
request value, so existing client-rendered public pages produce matching
localized copy during server rendering and first hydration rather than briefly
rendering English beneath a PL or DE document language. A dictionary-free
client synchronizer initializes the existing Zustand language state after
hydration, mirrors later language-preference updates back to
`document.documentElement.lang`, and does not mark authenticated preferences as
loaded. The existing `/app` preference hydrator therefore remains authoritative
after authentication.

The existing translation function and EN/PL/DE dictionaries remain the only
message system. No i18n dependency or parallel locale architecture was added.

## Landing server/client boundary

The landing page now resolves its locale on the server and renders:

- deployment/demo status;
- hero and model snapshot;
- feature narrative;
- how-it-works narrative;
- catalog-stat narrative;
- closing CTA;
- public header shell and footer shell.

`LandingSections` has no client directive, Supabase import, effect, state, or
auth session probe. Existing hard-coded English landing labels were moved into
the existing EN/PL/DE dictionaries so the server response is internally
consistent for each supported language.

The public header's theme toggle is an always-available landing client island.
When readiness is explicitly live, the shared auth-state boundary and its
button-only consumers are the other client islands. Demo mode does not mount
that boundary. The theme toggle's server fallback preserves the previous icon
and accessible label behavior without passing functions or non-serializable
values across the boundary.

Metadata, JSON-LD, landmarks, focus behavior, classes, layout order, and
reduced-motion treatment remain unchanged by design.

## Paused-data and anonymous-share behavior

`getDeploymentReadiness()` remains the authority for public data availability.
When it reports demo/unavailable:

- `/` renders the existing truthful paused-data status entirely without
  Supabase;
- login, signup, and recovery forms render without constructing a Supabase
  client; account clients are created only in response to an explicit user
  action and surface a localized unavailable message if configuration remains
  absent;
- login and signup skip their live-only signed-in lookup, while protected and
  unknown routes still fail closed to login without constructing middleware
  clients;
- the landing makes no Auth, REST, Realtime, Storage, Functions, GraphQL, or
  `/api/flags` request;
- anonymous shared-list and shared-comparison pages return their existing
  localized service-paused presentation without claiming an untested token is
  invalid or expired and without attempting an RPC;
- their Open Graph routes render the existing fallback cards without attempting
  an RPC.

When readiness is explicitly live, share routes retain the existing anonymous
read-only RPCs, login/signup retain their signed-in redirect lookup, and
account actions retain their existing Supabase behavior. No API or RPC contract
was added or changed. Live share reads validate response shapes, distinguish a
documented invalid/revoked token from transport or contract unavailability, and
opt out of the Next.js data cache so share revocation is not delayed. A live
outage therefore never tells a visitor that a valid link expired.

## Public visual-safety contract

The Phase 5A.0a public compatibility adapter is removed. Public visual commands
now:

- do not inspect `supabase/config.toml`;
- do not discover or allowlist a Supabase origin;
- do not synthesize a placeholder anonymous key;
- pass empty public Supabase URL and key values to isolated child processes;
- reject and strip legacy public-adapter environment variables;
- record `supabaseOrigin: "none"` and `publicBuildAdapterId: "none"` in the
  backwards-compatible provenance schema.

The local-authenticated launcher remains unchanged in intent: it derives the
loopback emulator origin from checked-in configuration, verifies readiness,
keeps credentials out of logs and artifacts, and owns fixture/runtime cleanup.
There is still no hosted fallback.

## Verification contract

Focused and complete verification covers:

- weighted locale parsing and fallback;
- EN/PL/DE server content and `html[lang]`;
- document-language synchronization and authenticated preference handoff;
- root-provider isolation and authenticated-provider retention;
- server-rendered landing source boundaries;
- truthful demo-mode shared routes and Open Graph degradation;
- zero landing Supabase and `/api/flags` traffic;
- server HTML with and without JavaScript;
- hydration-console safety and reduced-motion visibility;
- Phase 5A.0a visual-safety and egress assertions;
- Phase 5A.0b route/proxy/PWA contracts;
- demo-mode auth-entry rendering and protected-route fail-closed behavior with
  zero middleware-client construction;
- frontend tests, type-check, lint, production build, guarded public and local
  authenticated Playwright, Quality Gate, unchanged Lighthouse thresholds,
  PR Gate, CodeQL, Main Gate, and SonarCloud.

## Remaining Phase 5A.0d entry conditions

Phase 5A.0c does not establish new performance or screenshot baselines. Before
visual redesign work begins, Phase 5A.0d still owns:

- authoritative landing and route performance measurements;
- mobile and desktop Lighthouse route policy and budgets;
- bundle and client-JavaScript budgets that recognize legitimate reductions;
- stable visual baselines across the agreed viewport/theme matrix;
- the already documented historical desktop `/auth/login` performance debt;
- a clean separation between performance-gate corrections and visual design.

The existing Lighthouse configuration files and thresholds remain unchanged in
this phase.
