# Phase 5A.0b — Public Route and PWA Contract

## Purpose

Phase 5A.0b establishes one typed, proxy-level authority for TryVit's
public, authentication-entry, system/PWA, share, protected, admin, and API
route behavior. It is the intentionally narrow public/auth slice of the
broader route manifest planned for Phase 5B; it is not a second navigation or
design-system registry.

This phase makes anonymous reachability truthful while preserving the existing
fail-closed authenticated and admin boundaries. It does not redesign pages,
change providers, alter database behavior, or make hosted-service changes.

## Inventory and classification change

Before this phase, `frontend/src/proxy.ts` held a partial `PUBLIC_PATHS` set,
used broad string-prefix tests for `/auth/` and `/learn`, and constructed a
Supabase middleware client for every non-API request before deciding whether
the request was public. Shared pages, `/offline`, PWA resources, crawlers, and
metadata assets could therefore enter authentication logic. Existing browser
tests also incorrectly treated public sharing as protected, while the frontend
README incorrectly said that PWA support did not exist.

The authoritative policy now lives in
[`frontend/src/lib/route-policy.ts`](../frontend/src/lib/route-policy.ts).
Each explicit rule records its route class, matcher, permitted authentication
work, anonymous-access requirement, backend-unavailable behavior, and concrete
audit paths.

| Route area | Previous proxy behavior | Phase 5A.0b contract |
| --- | --- | --- |
| `/`, contact/privacy/terms/forbidden/offline | Only a partial exact set was public | Exact backend-independent public pages; no Supabase client or user lookup |
| `/learn` and articles | Broad string prefix could match `/learned` | Segment-boundary-safe public hierarchy; near matches remain protected |
| `/auth/login`, `/auth/signup` | Public only after a user lookup | Public signed-out entry routes; lookup is allowed solely for the documented signed-in redirect to `/app/search` |
| Password recovery and callback | Treated like generic `/auth/**` | Explicit recovery/callback classes; no proxy session lookup |
| Shared lists and comparisons | Fell through to protected behavior | Anonymous public-share routes; invalid or unavailable data can render a truthful degraded state |
| Shared and root metadata, manifest, worker, robots, sitemap, icons | Could fall through to authentication logic | Explicit public-system rules; no proxy Supabase client or user lookup |
| Vercel Speed Insights runtime | Fell through to login when Next handled it locally | Exact public-system policy rule. The platform-served runtime is disabled in checked-in QA mode, so local quality tests do not claim Vercel serves it. |
| `/app/**`, onboarding, unknown paths | Protected by default | Still fail closed and preserve full pathname/query redirect behavior |
| `/app/admin/**` | Broad prefix guard | Segment-boundary-safe admin class; authenticated non-admin users retain the 303 `/forbidden` response |
| `/api/**` | Rate-limited outside auth | Remains rate-limited without proxy authentication enforcement |

The policy's deterministic audit paths and
`frontend/tests/quality/routes.test.ts` consistency assertion prevent the
proxy and the pre-Phase-5B quality-route manifest from silently drifting apart.

## Proxy execution contract

For every backend-independent public page, public share, public system
resource, callback, and recovery route, proxy classification completes before
`createMiddlewareClient` or `supabase.auth.getUser()` can run. Focused spy
tests prove zero calls for those route classes. Login and signup are the only
anonymous routes permitted to look up a user, and only to retain the documented
signed-in redirect.

This phase deliberately did not make rendering genuinely Supabase-independent.
It ensured proxy behavior could not incorrectly block a public route before
Phase 5A.0c separated provider topology and landing rendering, then removed the
loopback-shaped public build adapter from the guarded visual-test contract.

## Public metadata fallback correction

The shared-list and shared-comparison Open Graph fallback cards are now fully
self-contained. Their prior font URL returned 404, and their emoji glyphs made
`ImageResponse` request remote emoji assets, preventing the fallback response
from completing under the existing fail-closed visual-safety proxy. The cards
now use the existing valid Inter source and a small inline `TV` mark. This is a
resilience correction for public metadata fallback responses, not a visual
redesign.

## PWA contract correction

`frontend/public/manifest.webmanifest` no longer forces portrait orientation.
Its Search and Lists shortcuts now use canonical routes:

- Search: `/app/search`
- Lists: `/app/lists`
- Scan: `/app/scan` (unchanged)

The manifest identity, colors, icons, scope, display behavior, service-worker
caching, offline fallback, and push behavior remain unchanged. The frontend
README now accurately describes the existing manifest, Serwist worker, install
support, and intentionally narrow caching behavior.

### Clean-build worker guarantee

TryVit's checked-in Serwist integration is webpack-based. Because Next.js 16
uses Turbopack by default, a plain `next build` can omit the ignored generated
`public/sw.js` file even while a stale local worker makes an ad-hoc browser run
appear healthy. The canonical frontend build and every tracked CI build now use
`next build --webpack`. The guarded visual-safety build removes only that known
generated worker before building and fails if the fresh webpack output does not
recreate it. This restores the existing worker contract; it does not change
caching rules, PWA UI, or Lighthouse thresholds.

The Phase 5A.0a browser contract continues to block service workers. In those
explicitly guarded builds only, Serwist generates `/sw.js` but does not inject
automatic registration, preventing a blocked-worker page error without changing
normal production registration.

## Verification boundary

Phase 5A.0b verifies its public matrix only through the Phase 5A.0a guarded
local visual-test infrastructure. Browser service workers remain blocked in
that context, and public browser traffic is contained to loopback plus the
already reviewed build-time font dependency. No hosted Supabase project,
Vercel configuration, production endpoint, migration, dependency, threshold,
or Phase 4 artifact is part of this contract.

The local authenticated runner additionally requires a healthy ephemeral
Supabase Auth admin key. Any local administrative-auth failure must fail closed
and be repaired as local runtime hygiene; it must never be replaced by a hosted
fallback. The CI workflow's clean Linux emulator remains the authoritative
authenticated verification environment.

## Deferred work

- Phase 5A.0c: genuine provider/public-rendering independence, locale and
  landing rendering boundaries, including removal of the temporary public build
  adapter.
- Phase 5A.0d: visual baselines and performance remediation. Historical
  desktop Lighthouse scores remain an entry condition, not a passing claim.
- Phase 5A.1 and later: Design System V2 and any visual redesign.
