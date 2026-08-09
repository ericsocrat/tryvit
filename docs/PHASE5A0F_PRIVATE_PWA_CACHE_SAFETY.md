# Phase 5A.0f — Private PWA Cache Safety

> **Last updated:** 2026-08-09
> **Status:** Implemented on the Phase 5A.0f draft branch; exact-head CI evidence pending
> **Owner issue:** —

## Scope

Phase 5A.0f closes the private-response boundary that blocked personalized
server rendering and broader Phase 5 visual-foundation work. It changes only
service-worker request classification, legacy runtime-cache migration, guarded
browser proof, and their documentation. It does not redesign the product,
change an API or database contract, modify dependencies, or access a hosted
Supabase or Vercel environment.

## Original defect

TryVit's worker appended Serwist's `defaultCache` after one product-RPC rule
and one public-image rule. The inherited rules cache successful responses by
URL in these relevant CacheStorage buckets:

| Request class             | Former strategy/cache               | Privacy consequence                                              |
| ------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| Same-origin `/api/**` GET | NetworkFirst / `apis`               | `/api/flags` can contain user and country-derived values         |
| App Router RSC prefetch   | NetworkFirst / `pages-rsc-prefetch` | Protected layout state can survive account changes               |
| App Router RSC            | NetworkFirst / `pages-rsc`          | User-specific server-component payload can be replayed           |
| HTML document             | NetworkFirst / `pages`              | A protected response can bypass a fresh proxy check offline      |
| Other same-origin GET     | NetworkFirst / `others`             | Unknown private fetches fail open into a generic cache           |
| Cross-origin GET          | NetworkFirst / `cross-origin`       | Supabase Auth `GET /auth/v1/user` can collide by URL across JWTs |

CacheStorage does not partition those keys by `Authorization`, user, or
Supabase session. `Cache-Control: private` is not an adequate runtime-strategy
boundary. Logout removed the Supabase session and cleared TanStack Query, but
neither action made an already cached private response unreachable.

The former `product-api-v3` rule did not provide the intended product/search
offline behavior: Serwist runtime routes default to GET, while every current
`supabase.rpc()` call is POST. Product and search RPC responses therefore fell
outside that route. Phase 5A.0f removes the dead rule rather than pretending
CacheStorage supports POST. The separate checked-in IndexedDB product cache is
unchanged.

The activation cleanup also used `!name.includes("v3")`. It deleted the live
Serwist precache and unrelated caches while preserving any unrelated name that
happened to contain `v3`. It was broad version cleanup, not a privacy policy.

Finally, `/offline` was declared as the document fallback but was absent from
the injected precache. The fallback could therefore fail precisely when the
network was unavailable.

## Corrected request policy

`frontend/src/lib/pwa-cache-policy.ts` is the pure source of truth. The worker
registers its `NetworkOnly` rule first, before the Open Food Facts image rule
and every Serwist default.

The following GET request classes are now NetworkOnly:

- every GET whose origin exactly equals the origin derived from
  `NEXT_PUBLIC_SUPABASE_URL`, including local loopback ports, except the
  narrowly reviewed anonymous public-object case described below;
- every same-origin `/api/**` route, keeping `/api/health` live and protecting
  the user-contextual `/api/flags` response;
- every token-gated shared-list/shared-comparison document, RSC response, and
  Open Graph response so revocation cannot be bypassed offline;
- document, RSC, RSC-prefetch, state-tree, and destination-less fetches whose
  authoritative route policy requires authentication;
- login/signup page data whose signed-in redirect requires a live session
  decision;
- auth callback and password-recovery page data, even though those routes must
  remain anonymously reachable.

No hostname wildcard or hosted project identifier is hard-coded. The build
inlines only the exact configured public Supabase origin and public key; it
never embeds a session token, service key, or secret. An absent or invalid
Supabase URL does not invent an external authority. Known Supabase API
namespaces remain deny-only NetworkOnly matches, so stale or partially
configured workers fail closed. A same-origin reverse-proxy setup does not
disable public application/static caching: only those API namespaces match.
Current browser-facing Supabase reads have no reviewed user-independent
CacheStorage contract, so both anonymous and authenticated GETs on a distinct
configured origin are excluded. Auth token exchange, Functions, and current
PostgREST RPCs are POST and remain ordinary network requests rather than cache
candidates. The sole reviewed exception is an exact configured-origin
`/storage/v1/object/public/**` GET with no signed query and no session bearer;
this preserves existing public product-photo behavior. Anonymous Supabase SDK
fallback credentials are accepted only when they equal the configured public
key, without decoding or logging either value.

The matcher reuses `getRoutePolicy()`. Unknown routes, malformed public-share
paths, and near matches therefore inherit the existing default-protected
classification instead of relying on duplicated `/app` prefixes.

## Public behavior retained

The policy deliberately leaves these existing behaviors intact:

- public page documents and RSC payloads remain eligible for Serwist's public
  runtime behavior;
- content-addressed scripts, styles, fonts, icons, and other static assets keep
  their existing cache rules;
- Open Food Facts product images retain `product-images-v3` CacheFirst
  behavior;
- public manifests, non-token metadata routes, and the production health-route
  response contract are unchanged;
- offline product persistence in `tryvit-offline` IndexedDB is unchanged.

The injected build manifest now adds `/offline` exactly once with a
deterministic build-derived revision. Serwist's own outdated-precache cleanup is
enabled.

## Legacy cache migration

Activation deletes only names with evidence of possible private content:

- `apis`;
- `cross-origin`;
- `next-data`;
- `others`;
- `pages`;
- `pages-rsc`;
- `pages-rsc-prefetch`;
- `static-data-assets`;
- every obsolete/dead `product-api-*` cache.

`static-data-assets` is deliberately included in this one-time whole-cache
migration because older extension-based rules could place private JSON there.
Public JSON may incur one cold refetch after upgrade; static scripts, styles,
fonts, images, and the active precache are not broadly deleted.

Obsolete `product-images-*` versions are also removed, while the current
`product-images-v3`, current Serwist precache, static caches, unrelated
CacheStorage, and IndexedDB survive. The exclusion policy—not logout or purge—is
the durable security boundary; migration only makes entries created by older
workers unreachable immediately after upgrade.

Retained type-specific caches are scanned by request key during activation.
Entries from the exact configured external Supabase origin, or from a known
private API namespace, are removed while unrelated entries in the same cache
survive. This covers legacy private Storage objects that an extension-based
Serwist rule may have classified before the generic cross-origin rule.

## Logout and account-switch proof

The dedicated `private-pwa-cache` Playwright project is the only guarded
project permitted to enable service workers. It runs against the ephemeral
loopback Supabase runtime and two scoped fixture users. All other browser,
visual, screenshot, and Lighthouse projects continue to block service workers.

The proof uses one browser context so the worker and CacheStorage survive the
account transition. It:

1. seeds synthetic private sentinels into the former private-bearing cache names;
2. installs the freshly generated worker and proves activation removes them;
3. verifies authenticated user-A requests do not enter CacheStorage;
4. signs out user A through the real account UI and loads user B into the same
   browser context without replacing its worker or CacheStorage;
5. goes offline and proves protected document/RSC, Supabase Auth, and
   PostgREST GETs never replay user-A content;
6. proves the public `/offline` fallback remains available;
7. restores the network in a mandatory `finally` block, then unregisters
   workers, deletes test caches, and clears browser storage in a blocking
   `afterEach` teardown with an independent timeout budget.

Credentials and response bodies are never written to logs or artifacts. The
existing browser egress guard is installed before worker registration, fixture
users are removed by global teardown, and the ephemeral runtime is removed
without backup by the workflow.

## Verification status

Completed local verification:

- focused cache-policy and visual-safety contract tests: 108 passed;
- complete frontend suite: 377 files passed, 1 skipped; 6,426 tests passed,
  19 skipped;
- TypeScript type-check and lint: passed;
- clean production build and fresh `/sw.js` generation: passed;
- guarded-loopback proxy lifecycle diagnostic: exact root-scoped `/sw.js`
  activation, exact active controller, legacy migration, unrelated public-cache
  preservation, and zero egress violations passed;
- generated worker SHA-256:
  `78a411b4357fbf3d82b84a3b95b12e5729dccb359decf63738ff5b078a189488`;
- generated-worker inspection: no runtime `process.env`, no product-RPC runtime
  route (only its legacy cache-name migration remains), no broad
  `includes("v3")` cleanup, and the offline fallback present.

The dedicated browser proof was attempted twice against newly created local
Windows Supabase runtimes. Both attempts stopped before the PWA test at the
same guarded Auth admin fixture operation (`VS_FIXTURE_ADMIN:fixture.list-users`),
including a serial one-worker attempt. Each runtime was stopped and its local
volumes removed without backup. No automatic retry policy, hosted fallback, or
weakened guard was introduced. The exact-head Linux Quality Gate is therefore
the required authoritative browser result; this document does not claim a
local browser pass.

Exact-head PR verification must include:

- focused policy, route-policy, auth, manifest, and worker tests;
- the dedicated guarded service-worker/account-switch project;
- complete frontend tests, type-check, lint, and a clean production build;
- inspection of the freshly generated `/sw.js` for rule order, offline
  precache, and removal of broad cleanup/dead RPC caching.

The draft PR is not ready for final review until exact-head PR Gate, Quality
Gate, immutable visual baselines, route-JavaScript guard, five-run Lighthouse,
CodeQL, Main Gate, and SonarCloud all finish. Results and artifact checksums
belong here only after those exact-head runs exist.

## Residual boundaries

- The precached offline page reflects the locale of the worker-install request.
  A language-neutral or client-selected offline shell is a future UX decision;
  Phase 5A.0f does not change product copy or locale architecture.
- Next's in-memory router cache in an already open tab is not CacheStorage and
  cannot be erased by a worker activation. Normal logout navigation and session
  enforcement remain responsible for that live process.
- Future browser GET endpoints must not assume that being anonymous makes a
  payload user-independent. Any public Supabase cache allowlist requires a new
  reviewed provenance and response-shape contract.

Phase 5A.1 is safe to begin only after the exact-head browser and CI evidence
confirms this contract. Personalized server-prefetch work still requires its
own response/data review; this phase removes the known cross-account
CacheStorage blocker, not every future privacy question.
