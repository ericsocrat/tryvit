# Phase 5A.0a — Local Visual-Test Safety

> **Last updated:** 2026-08-01
> **Status:** Active
> **Owner issue:** Frontend domain

## Scope

Phase 5A.0a secures TryVit's existing Playwright, screenshot, visual-audit,
quality, and Lighthouse infrastructure. It does not change routes, providers,
product behavior, or presentation. Its original public build compatibility
adapter was removed by Phase 5A.0c after public rendering became genuinely
Supabase-independent.

The safety boundary applies to every browser-facing command, including commands
that intend to visit only public pages. Non-browser hosted integration and data
integrity jobs remain outside this boundary.

## Original defect

The previous test configuration accepted any `BASE_URL` and enabled
authenticated setup whenever `SUPABASE_SERVICE_ROLE_KEY` happened to exist.
Local screenshot runners reused any process listening on port 3000, while
Lighthouse could reuse an arbitrary `.next` build. No pre-navigation scan or
browser HTTP/WebSocket route protected against a stale compiled client.

The defect was reproduced without network traffic by a focused regression test
that models the former configuration's ambient two-variable authentication
predicate with a synthetic hosted-looking Supabase origin and a canary key. It
proves that the former predicate selected authenticated behavior; it does not
load the deleted configuration or claim to reproduce a full Playwright project
registration. No browser, DNS lookup, or remote request was used.

## Risk-surface and call-order map

The browser boundary is enforced by the launcher, the owned loopback proxy, the
Playwright configuration, and the auto fixture. A raw Playwright invocation is
not a supported entry point: configuration loading fails unless the launcher
has supplied the verified contract, owned proxy, and (for authenticated work)
owned temporary storage-state directory.

The table below records the actual order for every browser-facing entry point.
`Guard context` means that service workers are blocked and HTTP and WebSocket
routes are installed before a page is created. `Final assert` means both the
context-owned violation state and the proxy's count-only violation state are
checked before results can be treated as safe.

| Entry point                                                                                                                                            | Classification                                | Actual guarded call order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Remaining status or risk                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run visual-safety:public -- …` (`smoke`, `visual-smoke`, public `screenshots`, public `pr-screenshots`, and the dedicated browser-safety project) | Backend-independent public                    | Reject proxy/preload/debug controls → require supported Node environment-proxy behavior → sanitize inherited environment → load explicit public contract → prove the app port and `.next` ownership → start the owned proxy → clean Supabase-empty build through that proxy → scan defined generated text/code assets → write/verify provenance → start and verify the owned Next server through the proxy → guarded manual-redirect readiness → write invocation proof/load Playwright config → guard context → create page → navigate/test/capture → close context → final proxy/provenance/artifact assert → stop owned server/proxy → remove owned temporary files                                                                                                                                   | Public mode performs no Supabase configuration discovery and supplies no Supabase URL, key, adapter, or adapter allowlist. Phase 5A.0d supersedes the original font-egress exception with a content-attested local test fixture and an empty external CONNECT allowlist. |
| `npm run visual-safety:local-authenticated -- …` launcher                                                                                              | Local-authenticated                           | Reject process controls and strip all ambient credentials → require supported Node environment-proxy behavior → discover and canonicalize the emulator origin from `supabase/config.toml` → guarded, no-redirect emulator readiness → query `supabase status -o env` and require its API origin to equal that verified origin → only then retain the returned local anon/service keys in memory → prove port/`.next` ownership → start the owned proxy → clean build/scan/provenance through the proxy → create an invocation-owned external storage-state directory → start/verify the owned server through the proxy → write invocation proof/load Playwright config → run the selected project sequence below → assert proxy/provenance/artifacts → stop owned resources → delete owned storage state | Missing emulator, CLI status, or local credentials blocks before browser/client/user creation. Ambient staging or production keys are ignored. There is no hosted fallback.                                                                                              |
| `auth-setup` and `functional-auth-setup`                                                                                                               | Local-authenticated                           | Launcher preflight/build/server sequence → create context and install automatic guard → create page → construct guarded local admin client → provision fixture → navigate/login → persist state only to the owned external directory → close page/context → mandatory fixture assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Dependent projects cannot start until setup succeeds.                                                                                                                                                                                                                    |
| Authenticated, functional, and authenticated visual projects                                                                                           | Local-authenticated                           | Successful setup dependency → load owned storage state → create context/install guard → create page → navigate/test → close page/context → mandatory fixture assertion → guarded global fixture deletion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Storage state is never written inside the repository or uploaded as evidence.                                                                                                                                                                                            |
| Authenticated PR/documentation screenshot routes                                                                                                       | Local-authenticated                           | Launcher preflight/build/server sequence → guarded Node helper provisions the local fixture in suite setup → each test creates a guarded context/page → UI login → navigate/capture → close context/assert → guarded local fixture deletion in suite teardown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Public mode filters these routes out and never calls the fixture helper.                                                                                                                                                                                                 |
| Authenticated quality routes                                                                                                                           | Local-authenticated                           | Successful guarded local runtime and QA catalog fixture → successful `auth-setup` dependency → load owned storage state → create context/install guard → create page → navigate/audit/capture → close context/assert → guarded global fixture deletion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | GitHub runs this only against its job-owned ephemeral emulator. Missing runtime, fixture, or cleanup remains blocking.                                                                                                                                                   |
| `RUN_PR_SCREENSHOTS.ps1 -Mode Public`                                                                                                                  | Backend-independent public                    | Discover changed files (or honor `-All`) → clear browser-facing sensitive variables → set explicit public mode → blocking preflight → prove and clear only the prior screenshot output → enter the public launcher order above → capture only public mapped routes → final assert → restore the caller environment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | The GitHub PR Screenshots job is public-only; it does not claim authenticated coverage.                                                                                                                                                                                  |
| `RUN_PR_SCREENSHOTS.ps1 -Mode LocalAuthenticated`                                                                                                      | Local-authenticated                           | Discover changed files (or honor `-All`) → remove ambient credentials and process-control variables → set explicit local-authenticated mode → blocking emulator preflight → prove and clear only the prior screenshot output → enter the authenticated launcher order above → derive credentials from the verified local runtime → capture authenticated mapped routes → local cleanup/final assert → restore the caller environment                                                                                                                                                                                                                                                                                                                                                                     | Requires a running verified local emulator whose status matches checked-in configuration.                                                                                                                                                                                |
| `RUN_SCREENSHOTS.ps1 -Mode Public`                                                                                                                     | Backend-independent public                    | Clear browser-facing sensitive variables → set explicit public mode → enter the public launcher order → capture public visual-audit routes → final assert → restore the caller environment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | It never reuses a developer server or an existing build.                                                                                                                                                                                                                 |
| `RUN_SCREENSHOTS.ps1 -Mode LocalAuthenticated`                                                                                                         | Local-authenticated                           | Remove ambient credentials and process-control variables → set explicit local-authenticated mode → enter the authenticated launcher order → derive credentials from the verified local runtime → provision/capture/clean up locally → final assert → restore the caller environment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Requires a running verified local emulator whose status matches checked-in configuration.                                                                                                                                                                                |
| PR Screenshots workflow                                                                                                                                | Backend-independent public                    | Checkout/change inventory → install tooling → blocking public preflight → public screenshot launcher → mandatory final assert → upload screenshots/comment only after the safety stage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Authenticated screenshots remain a separate local command and are not represented by this workflow.                                                                                                                                                                      |
| PR Gate and Main Gate browser jobs                                                                                                                     | Backend-independent public                    | Checkout/install/unit checks → blocking public preflight → public smoke launcher (which performs a fresh owned build/server sequence) → mandatory final assert → conditionally upload redacted reports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | No hosted browser configuration is supplied.                                                                                                                                                                                                                             |
| Quality Gate public audits                                                                                                                             | Backend-independent public                    | Checkout/install → select smoke/full → blocking public preflight → public mobile launcher → public desktop launcher → mandatory public final assert                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Public results exclude routes that require authentication. Lighthouse Mobile remains a separate guarded blocking workflow; desktop performance activation remains Phase 5A.0d.                                                                                           |
| Quality Gate authenticated audits                                                                                                                      | Local-authenticated                           | Install pinned CLI → start reduced ephemeral stack with output suppressed → guarded readiness/credential discovery → guarded deterministic QA fixture seed → authenticated mobile launcher → authenticated desktop launcher → mandatory final assert → guarded fixture teardown → unconditional no-backup runtime stop → conditional artifact upload                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Uses Postgres, Kong/API, GoTrue, and PostgREST only. Checked-in migrations and the empty configured seed run at startup; no product pipeline or hosted fallback runs.                                                                                                    |
| Nightly public browser suite                                                                                                                           | Backend-independent public                    | Non-browser build/unit stages → blocking public preflight → public smoke launcher, which discards/rebuilds browser assets under the owned contract → mandatory final assert → conditional report upload                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | The earlier unit-build output is not reused as browser evidence.                                                                                                                                                                                                         |
| Nightly authenticated browser suite                                                                                                                    | Local-authenticated                           | Install pinned CLI → start the same reduced ephemeral stack → guarded readiness and fixture seed → authenticated/functional launcher → mandatory final assert → guarded fixture teardown → unconditional no-backup runtime stop → conditional report upload                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | The fixture supplies the existing functional contract without Phase 4 enrichment or a full catalog. The separate hosted data-audit job remains unchanged and is not part of browser evidence.                                                                            |
| Lighthouse CI and `npm run visual-safety:public-lighthouse`                                                                                            | Backend-independent public                    | Sanitize environment/load public contract → require supported Node environment-proxy behavior → prove port/`.next` ownership → start owned proxy → clean build/scan/provenance through the proxy → start owned Next server through the proxy → create temporary Lighthouse config → run the requested public audit → final proxy/provenance assert → stop owned resources → remove temporary config                                                                                                                                                                                                                                                                                                                                                                                                      | The dedicated GitHub workflow enforces Mobile only. The unchanged Desktop configuration remains measured debt and a Phase 5A.0d entry condition; it is not claimed as passing.                                                                                           |
| QA database replay, API/data-integrity checks, hosted deployment integrations                                                                          | Non-browser hosted integration/data integrity | Their existing non-browser contracts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Inventory only; this PR does not broaden or rewrite them.                                                                                                                                                                                                                |
| Production application, routes, providers, database, scanner, and visual system                                                                        | Unrelated/out of scope                        | Unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Phase 5A.0a makes no product or visual change.                                                                                                                                                                                                                           |

Within any launcher row, failure prevents every later network-capable step. An
artifact upload is evidence only when its mandatory safety assertion succeeded.
Invocation proofs and authenticated-state owner markers are opened with
no-follow semantics where the platform supports them. The harness compares the
descriptor and path identities after opening and reads through that descriptor,
so a later path replacement cannot redirect the read.

## Modes

### Public

Public mode requires a loopback application origin and initializes without
Supabase configuration. The launcher removes inherited Supabase variables and
passes empty Supabase URL and anonymous-key values to isolated build, server,
Playwright, and Lighthouse child processes. It does not inspect
`supabase/config.toml`, discover a Supabase origin, synthesize a placeholder
credential, or add a Supabase adapter target to the owned-loopback allowlist.

Public commands never receive or use a service-role key and never provision or
delete a user.

### Local-authenticated

Local-authenticated mode requires:

- a loopback application origin;
- the loopback Supabase origin derived from `supabase/config.toml`;
- a readiness response that does not redirect;
- local fixture credentials returned by `supabase status -o env` only after
  readiness, with its reported API origin required to match the canonical
  checked-in local origin.

Ambient anon/service-role values are never treated as local credentials.
Missing or non-local configuration fails before client construction, page
creation, or fixture provisioning. There is no staging or production fallback.

### GitHub ephemeral runtime and fixture contract

Quality Gate and Nightly install the repository's pinned Supabase CLI action,
then start a Docker-backed runtime from checked-in `supabase/config.toml`.
Startup applies all checked-in migrations and the configured `seed.sql`; that
seed is intentionally empty. Only Postgres, Kong/API, GoTrue, and PostgREST are
kept. Realtime, Storage, image transformation, Studio, Mailpit, Edge Functions,
analytics, metadata, and the pooler are excluded because these browser suites
do not use them.

The CLI's startup/status output can contain local JWTs. Startup and teardown
output is therefore captured only in a temporary runner file that is deleted
without being printed or uploaded. The safety launcher then performs the
manual-redirect readiness check, compares the runtime origin to the API port
discovered from configuration, and only afterward reads local credentials from
`supabase status -o env` in memory.

The existing QA fixture seeder is invoked only through that guarded launcher.
It creates ten synthetic products: the original four quality fixtures plus six
minimal support products needed by the existing Nightly category, search,
comparison, country-isolation, and scanner journeys. This is not a catalog
pipeline or enrichment run. The fixture is soft-deprecated in an `always()`
cleanup, fixture users are deleted by Playwright teardown, and the whole local
volume is then removed with `supabase stop --no-backup`. A failure in startup,
readiness, seeding, browser coverage, safety assertion, fixture cleanup, or
runtime cleanup leaves the workflow red and prevents browser artifact upload.
GitHub's Ubuntu runner supplies Docker; the reduced image set plus migration
startup is expected to add several minutes. Quality Gate and Nightly retain
30-minute browser-job limits. The last hosted Nightly browser job completed in
about 16 minutes, leaving bounded headroom for the local runtime rather than
silently dropping authenticated coverage.

The historical hosted Nightly data-integrity job remains separately governed.
It is not dispatched for Phase 5A.0a closure verification because it may access
a hosted data environment and is not evidence for the browser runtime.

### Phase 5A.0d performance boundary

The pre-Phase 5A.0a base Quality Gate appeared green because its staging-backed
Playwright audits ran while both Lighthouse steps were skipped. It established
no performance baseline. PR #1246 then prematurely invoked the combined mobile
and desktop Lighthouse command inside Quality Gate. The unchanged desktop
configuration requires `/auth/login` performance of at least 0.75; the three
observed scores were 0.66, 0.69, and 0.64. Those results are real failing
evidence, not a pass.

Phase 5A.0a retains the separate guarded, blocking Lighthouse Mobile workflow
as its Lighthouse safety and performance check. It removes only the duplicate
Quality Gate activation of the broader performance contract. Both Lighthouse
configuration files and every threshold remain unchanged. Desktop activation,
baseline design, and remediation are explicit Phase 5A.0d entry work.

## Canonical origins

Configuration accepts origin-only HTTP(S) values using exactly `localhost`,
`127.0.0.1`, or bracketed canonical `::1`, with an optional valid port. It
rejects credentials, paths, queries, fragments, trailing-dot hosts, alternate
numeric IPv4 forms, mapped IPv6 aliases, bind-all/private/LAN/Docker hosts,
Vercel/public application origins, and all hosted Supabase origins.

The local Supabase API port is read from the checked-in `[api]` configuration;
it is never assumed to be 54321.

The owned build/server proxy depends on Node's built-in environment-proxy
support. The launcher accepts Node 22.21 or newer within the Node 22 line, Node
24.5 or newer within the Node 24 line, and Node 25 or newer. Node 23 and older
or unsupported patch versions fail before a build or server can start.

## Egress and artifact policy

Node fixture clients receive an injected guarded fetch and guarded Realtime
transport. Fetch validation occurs before each hop, redirects remain manual,
and a loopback response cannot cause a second request to a hosted target.

Every safety Playwright context blocks service workers and installs context-level
HTTP and WebSocket routing before page creation. Hosted Supabase origins and
non-loopback Supabase service paths are closed/aborted, recorded by category,
and asserted during teardown. Redacted summaries contain counts and categories
only. Lighthouse adds equivalent page request interception plus CDP
`Network.webSocketCreated` classification before navigation; the proxy blocks
the opaque handshake while the CDP event makes a hosted or custom-domain
Realtime attempt a mandatory recorded failure.

Chromium does not reliably expose every redirected second hop to Playwright's
route callback. The harness therefore also places an owned loopback proxy
beneath the browser. A synthetic loopback-to-hosted redirect is allowed to reach
the local proxy, which rejects the hosted second hop before DNS resolution or
remote transmission and writes the same blocking, redacted violation marker.
The proxy forwards HTTP or CONNECT traffic to a loopback target only when its
exact canonical origin and effective port belong to the invocation-owned app or,
for local-authenticated mode only, the verified local emulator contract. Other
loopback targets are blocked and recorded rather than used as a local-network
pivot.
Phase 5A.0d supersedes the original reviewed `fonts.gstatic.com:443` exception.
The exact Open Graph font response is now a checked-in, content-attested,
test-only fixture served by a process-local preload during guarded builds and
owned Next servers. The owned proxy has no
external CONNECT allowlist during guarded builds, servers, browser runs, or
Lighthouse runs. Product font code remains unchanged; every unexpected
non-loopback CONNECT attempt fails closed.

Generated text/code assets under `.next/static` and `.next/server` are scanned
before navigation for the defined `.cjs`, `.css`, `.html`, `.js`, `.json`,
`.map`, `.mjs`, `.rsc`, and `.txt` extensions. This is not a claim that opaque
binary formats are semantically decoded. Provenance contains only the
mode, canonical loopback origins, source revision, schema identifier,
build identifier, and generated-asset digest. It never contains or hashes a
credential. Trace, output-directory, and snapshot overrides are rejected.
Reporter overrides are restricted to the reviewed `list` and `html,list`
values; other reporter overrides fail. Child output is buffered before
emission; secret or hosted-origin content fails with a redacted error. Changed
reports, screenshots, logs, and workflow artifact roots are byte-scanned, and
trace archives fail closed rather than being treated as inspectable. Screenshot
checks prove absence of exact known credential bytes in the file; they do not
perform OCR or claim to detect a secret rendered only into compressed pixels.

Executable generated assets fail on every concrete hosted Supabase origin.
Source maps have one narrow, content-verified exception for documentation
examples embedded by the installed Supabase SDK: the file must parse as a
source map; each matching `sourcesContent` entry must identify a
`node_modules/@supabase/` source; every origin must be exactly one of
`https://example.supabase.co`, `https://myproject.supabase.co`,
`https://project-id.supabase.co`, `https://realtime.supabase.co`, or
`https://xyzcompany.supabase.co`; and the multiset of raw file matches must
equal the reviewed `sourcesContent` matches. Any application
source, known TryVit project reference, different hosted origin, executable
asset occurrence, or unmatched source-map occurrence fails the scan. This
exception does not weaken the runtime HTTP, redirect, WebSocket, service-worker,
or proxy guards.

The asset rule treats a concrete origin such as
`https://project.supabase.co` and a known TryVit project reference as a
forbidden endpoint. It does not treat the SDK's non-origin wildcard text
`*.supabase.co` as an endpoint by itself. This is a deliberate narrowing of the
prompt's literal `.supabase.co` wording; runtime guards still reject every
matching hosted hostname, and any concrete executable origin still fails.

The installed Supabase bundle also exposes one internal
`shared/tracing/dist/*/validate.js` source path without its package prefix. That
single path is accepted only when its complete source-content SHA-256 equals
the content embedded in the installed
`@supabase/supabase-js/dist/index.{mjs,cjs}.map` and its hosted-looking strings
are still members of the reviewed list above. A same-named or edited source is
rejected.

## Commands

Run browser work through the safety launchers rather than invoking `next`,
Playwright, or Lighthouse directly:

```text
cd frontend
npm run visual-safety:public -- --project=smoke
npm run visual-safety:local-authenticated -- --project=authenticated
npm run visual-safety:public-lighthouse
```

From the repository root, screenshot capture uses an explicit mode:

```powershell
.\RUN_PR_SCREENSHOTS.ps1 -Mode Public
.\RUN_SCREENSHOTS.ps1 -Mode Public
# Requires a verified running local emulator; credentials come from its status:
.\RUN_SCREENSHOTS.ps1 -Mode LocalAuthenticated
```

The local-authenticated command is expected to fail closed when the emulator or
local fixture credentials are unavailable. A blocked authenticated run must not
be reported as passed or replaced with hosted access.

At Phase 5A.0a completion, Quality Gate and Nightly provision their own reduced
ephemeral Supabase runtimes and deterministic local fixtures before claiming
authenticated coverage. Their guarded preflights, browser safety assertions,
fixture cleanup, and no-backup runtime teardown are all blocking. Public
quality and public Lighthouse results remain valid only for their public route
scope and are never reported as authenticated equivalents. Desktop Lighthouse
is neither run nor claimed by Quality Gate; its recorded failure remains an
explicit Phase 5A.0d prerequisite.

## Deferred work

- Phase 5A.0b owns public-route and PWA policy.
- Phase 5A.0c removed the loopback-shaped public build adapter after establishing
  genuine Supabase-independent public rendering. Local-authenticated emulator
  discovery and fixture behavior remain unchanged.
- Phase 5A.0d owns authoritative visual baselines and performance gates.
- Design System V2, Living Label, and all visual redesign remain outside this
  infrastructure PR.
