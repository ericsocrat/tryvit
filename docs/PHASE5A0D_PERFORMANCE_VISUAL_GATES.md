# Phase 5A.0d — Authoritative Performance and Visual Gates

> **Status:** Draft implementation evidence; authoritative Linux values are
> accepted only from the blocking Phase 5A.0d workflows
> **Scope:** Measurement, CI, and baseline infrastructure only
> **Visual redesign:** Not included
> **Hosted services:** Not accessed or modified

## Decision

Phase 5A.0d replaces assumptions with two explicit sources of truth:

1. cold-browser observations of the JavaScript files actually requested by a
   production build; and
2. five-run Lighthouse lab distributions plus immutable screenshots rendered
   on the pinned Linux CI class.

The Design System V2 targets remain targets. A current result below a target is
reported as debt; it is not renamed, normalized away, or made to pass by
changing the target. The first gate blocks regressions and invalid
measurements while preserving the prior Lighthouse floors. Later product work
must close the measured absolute debt in its own scoped PR.

## Inventory and original gaps

| Existing signal                               | What it actually measured                                                          | Phase 5A.0d finding                                                                                                                                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle Size Guard                             | Private Pages/App build-manifest entries on separate runners                       | The App Router manifest contract was obsolete and missing files were silently ignored. A `0 KB` result could pass despite the application shipping JavaScript. It was a faulty/unavailable measurement, never a valid zero. |
| Lighthouse Mobile                             | Public login, three runs, best-run behavior through LHCI assertions                | Useful historical CI signal, but not a representative route matrix or authoritative baseline distribution.                                                                                                                  |
| Lighthouse Desktop                            | A config named desktop with a desktop viewport                                     | The effective user agent and throttling remained mobile-derived. The historical login scores `0.66`, `0.69`, and `0.64` therefore demonstrate a defective measurement profile, not desktop product performance.             |
| Quality Gate                                  | Public and guarded local-authenticated Playwright journeys at two viewport classes | Authoritative for functional/accessibility assertions, not for Lighthouse scores, route JavaScript, or pixel baselines.                                                                                                     |
| PR Screenshots and retained audit screenshots | Review artifacts                                                                   | Illustrative evidence only. They are not renderer-pinned and cannot be used as pixel baselines.                                                                                                                             |
| Playwright visual specs                       | Dormant broad matrices with no committed snapshot PNGs                             | No authoritative visual regression baseline existed.                                                                                                                                                                        |
| Browser performance traces                    | No trace-capable Chrome DevTools integration in this environment                   | No trace-derived claim is made. Field Core Web Vitals and production-device behavior remain unavailable.                                                                                                                    |

The route asset implementation deliberately does not depend on private Next.js
manifest shapes. Next.js 16 client manifests can describe merged unions rather
than the exact cold route request, and are unsuitable as the sole route budget
authority.

## Measurement classes

| Class                  | Meaning in this phase                                                                                         | Authority                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Lighthouse lab         | Synthetic local production-build audit under the pinned profile                                               | Blocking only when provenance, five samples, exact route, no redirect, and variance checks all validate |
| Route JavaScript       | Independently gzip-compressed first-party `/_next/static/*.js` responses observed by a fresh browser          | Blocking for measurement validity and base/head regression                                              |
| Encoded transfer       | Browser Resource Timing total when every tracked script exposes a positive value                              | Reported as an observation; unavailable is `null`, never zero                                           |
| Visual baseline        | Viewport screenshot from the pinned Linux runner, browser, fixture, theme, motion, locale, and clock contract | Blocking after explicit candidate review and committed hash manifest                                    |
| Historical observation | Old scores or retained screenshots without the full contract                                                  | Context only                                                                                            |
| Field Core Web Vitals  | Real-user p75 LCP, INP, and CLS                                                                               | Not available; no field claim is made                                                                   |

Lighthouse cannot measure field INP. TBT is retained as a lab responsiveness
proxy and is never relabeled as INP.

## Reproducible protocol

### Source and runtime identity

Every machine-readable report binds:

- the exact Git commit;
- the guarded clean-build ID and provenance fingerprint;
- OS/platform classification;
- Node, npm, Next.js, Playwright, Chromium, Lighthouse, and zlib versions as
  applicable;
- the source Lighthouse configuration SHA-256;
- the browser profile, locale, timezone, viewport, device scale factor, color
  scheme, and reduced-motion setting; and
- a deterministic report or manifest checksum.

Authoritative measurements use `ubuntu-24.04`, Node `22.21.1`, the repository
lockfile, Playwright-managed Chromium, Lighthouse `12.6.1`, Supabase CLI
`2.111.0`, a clean production build, and loopback
`http://127.0.0.1:3000`. A tool or runner version change is environment drift
and requires a new reviewed candidate; it is not compared as if it were the
same renderer.

The existing Open Graph image modules fetch fixed Inter font URLs from
`fonts.gstatic.com` while Next.js builds those routes. The guarded proxy allows
only that hostname as a bounded **build-time** HTTPS exception; browser runs
remain loopback-contained and receive no such exception. Because the proxy does
not inspect or content-attest the TLS response, this phase does not claim that
the entire production build is byte-reproducible across time. It binds the
observed clean-build fingerprint, compares route JavaScript on one runner, and
requires two byte-identical screenshot passes. Vendoring that font would be a
separate product-asset change and is not hidden inside this measurement PR.

### Cache and run rules

- Route-JavaScript captures use a fresh browser page for every route, block
  service workers, and wait for a deterministic 750 ms tracked-script quiet
  period. Each local build is clean and guarded.
- Route bytes are read from the exact emitted file and independently compressed
  with gzip level 9. Missing attribution, an empty asset set, unexpected script
  origins, redirects, invalid transfer values, or zero-byte output fails.
- Base and head route measurements execute sequentially on the same Linux
  runner with the same measurement implementation and browser profile. This
  bootstrap uses the head harness only when the PR base is exactly the verified
  Phase 5A.0c SHA, which predates the harness. After merge, the reviewed PR-base
  harness is restored over both revisions so a PR cannot redefine its own
  comparator.
- Lighthouse uses five cold lab runs per route/profile. Reports retain all five
  values, median, minimum, maximum, range, and median absolute deviation.
- Lighthouse performance-score range above `0.10`, or timing MAD that is both
  at least `100 ms` and above 20% of its median, is inconclusive and fails
  rather than choosing a favorable run. The absolute floor prevents sub-
  millisecond desktop TBT noise from becoming a false percentage failure.
- Visual baselines use `en-US`, UTC, DPR 1, light theme, reduced motion, a fixed
  clock, viewport-only capture, and no masks. Generation and verification are
  separate commands.

### Baseline approval

For the one-time bootstrap, the PR workflow generates candidates only when it
proves that the exact base and head both lack a manifest; it uploads but never
commits them. If a base manifest exists and the head deletes it, the workflow
fails. After the initial files are committed, future candidate generation is
manual-only. Every candidate run renders the complete matrix twice from the
same source and requires byte-identical manifests before upload. Verification
reads the committed files before and after the browser run, cannot pass an
update flag, and fails on any hash, file-set, fixture, renderer, or environment
difference.

An intentional future redesign updates baselines in a dedicated visual PR with
before/after evidence and human review. A baseline update cannot be used in an
unrelated PR to hide drift. The 74 retained audit screenshots remain outside
this system.

## Representative route contract

| ID               | Route                            | Mode                | Boundary                     | Fixture                | Directional initial-JS target |
| ---------------- | -------------------------------- | ------------------- | ---------------------------- | ---------------------- | ----------------------------: |
| `landing`        | `/`                              | Public              | Server-led public            | None                   |                  180 KiB gzip |
| `login`          | `/auth/login`                    | Public              | Client auth entry            | None                   |               Not yet defined |
| `contact`        | `/contact`                       | Public              | Server-led public            | None                   |                  150 KiB gzip |
| `app-shell`      | `/app`                           | Local authenticated | Authenticated client surface | Deterministic new user |               Not yet defined |
| `product-detail` | `/app/product/:fixtureProductId` | Local authenticated | Authenticated client surface | Seeded local product   |               Not yet defined |

Public routes run without Supabase configuration or credentials. Authenticated
routes run only after the checked-in local Supabase origin passes the loopback
preflight and deterministic fixtures are seeded. No hosted fallback exists.

## Route-specific JavaScript accounting

The source of truth is the set of successful first-party Next.js static script
responses observed on each cold route. For every file the report records its
normalized emitted path, raw bytes, independent gzip bytes, SHA-256, and
Resource Timing bytes when reliable.

Within each runtime mode, an emitted path requested by more than one selected
route is `shared`; a path requested by one route is `route-owned`. Public and
authenticated builds remain separate runtime identities. Content-identical
files at different emitted paths are not silently merged.

The blocking regression rule is:

- fail an increase greater than `10 KiB`; **or**
- fail an increase greater than `5%`.

Reductions pass. An existing absolute-target miss remains visible as
`PASS regression; target debt` and never becomes `target met`.

### Local observation before authoritative Linux capture

The first Windows observation proved the former zero-byte result false:

| Route               | Chunks |      Gzip |    Shared | Route-owned | Target status                               |
| ------------------- | -----: | --------: | --------: | ----------: | ------------------------------------------- |
| Landing             |     18 | 414.3 KiB | 414.0 KiB |     0.3 KiB | Above 180 KiB target                        |
| Login               |     19 | 418.6 KiB | 410.8 KiB |     7.7 KiB | No absolute target                          |
| Contact             |     18 | 416.6 KiB | 414.0 KiB |     2.6 KiB | Above 150 KiB target                        |
| Authenticated shell |     35 | 760.8 KiB | 746.9 KiB |    13.8 KiB | No absolute target; material shared-JS debt |
| Product detail      |     36 | 782.2 KiB | 746.9 KiB |    35.3 KiB | No absolute target; material shared-JS debt |

These are useful reproducibility observations, not committed Linux baselines.
The authoritative report and checksum are produced by CI and retained with the
draft PR evidence. The Windows observation checksum is
`fdeb91d28ce7ab55635d94245a27369e5af284c5af6714baa0ddb7c8458cf586`.
The exact local Vercel Speed Insights script path is fulfilled with a reviewed,
inert JavaScript marker and reported separately as contained instrumentation.
Its exact URL, status, content type, and body must match the contract. It is
neither counted as a Next route chunk nor represented as a zero-byte success;
any near-match, failed request, or unexpected executable response fails.

## Lighthouse contract

The checked-in source configuration files remain byte-for-byte unchanged:

- Mobile: `29B7A7AC0DC3CE98633E1013F57486C878C33DD6271D9D7462E2F4804C32285E`
- Desktop: `E2C2279410348292CB9744AD8CD12B75E2459A00A7EABA84F9CA36BB5DB0CA9F`

The guarded launcher creates a temporary explicit contract because the source
desktop configuration was not an effective desktop profile. The correction
sets the form factor, viewport, device scale, installed-Chromium-matched user
agent, simulated throttling profile, exact route list, five runs, output
directory, and assertion matrix. The temporary file is outside the repository
and is removed after use.

Existing blocking floors are preserved:

- public route performance at least `0.75`;
- local-authenticated performance at least `0.85` mobile and `0.90` desktop;
- accessibility at least `0.95`;
- best practices at least `0.90`;
- SEO at least `0.95` for landing and contact; and
- CLS no greater than `0.10`.

The Living Label blueprint remains separately visible for landing: performance
`0.90` mobile / `0.95` desktop, LCP `2.5 s`, TBT `200 ms`, TTFB `800 ms`, CLS
median `0.05` and maximum `0.10`, and mobile transfer `900 KiB`. A miss is debt,
not permission to lower the target.

### Fresh local five-run observation

The corrected contract produced the following Windows observations from one
public build and one local-authenticated build. They are reproducibility
evidence; only the pinned Linux workflow is authoritative.

| Route/profile          | Performance |      LCP | CLS |    TBT | Transfer | Result                                  |
| ---------------------- | ----------: | -------: | --: | -----: | -------: | --------------------------------------- |
| Landing mobile         |        0.94 | 2,939 ms |   0 |  82 ms |  511 KiB | Public floor passes; blueprint LCP debt |
| Login mobile           |        0.93 | 3,087 ms |   0 | 102 ms |  501 KiB | Pass                                    |
| Contact mobile         |        0.91 | 3,471 ms |   0 |  83 ms |  509 KiB | Pass                                    |
| Landing desktop        |        0.99 |   840 ms |   0 |   2 ms |  511 KiB | Pass                                    |
| Login desktop          |        1.00 |   797 ms |   0 |   0 ms |  501 KiB | Pass                                    |
| Contact desktop        |        1.00 |   732 ms |   0 |   0 ms |  509 KiB | Pass                                    |
| App shell mobile       |        0.70 | 6,764 ms |   0 | 312 ms |  880 KiB | **Below preserved 0.85 floor**          |
| Product detail mobile  |        0.80 | 4,170 ms |   0 | 293 ms |  906 KiB | **Below preserved 0.85 floor**          |
| App shell desktop      |        0.99 |   916 ms |   0 |   0 ms |  924 KiB | Pass                                    |
| Product detail desktop |        0.99 | 1,037 ms |   0 |   0 ms |  940 KiB | Pass                                    |

All accessibility, best-practices, SEO, and CLS floors passed. No distribution
was statistically inconclusive. The compact report checksum is
`6334e8159a56a08a259c75dab3921d4c87bc76a3b1137b5022e24328f23f52ab`.
The report is lab-only: it provides no field p75 or INP evidence.

### Historical desktop login investigation

The old `0.66`, `0.69`, and `0.64` values are not normalized or discarded.
They were produced by a purported desktop setup that retained an inconsistent
mobile-derived effective environment and used three-run assertion behavior.
They establish why the correction was necessary, but cannot establish whether
the login route has desktop performance debt. Only the corrected five-run
median can answer that question. The corrected desktop login median is `1.00`
with a `0.99–1.00` observed range, so the historical condition was a
measurement-contract defect rather than reproducible desktop login debt.

## Visual baseline matrix

The initial matrix is deliberately seven viewport screenshots, not a broad
route catalog:

| Route/state                             | 390×844 | 768×1024 | 1440×900 |
| --------------------------------------- | :-----: | :------: | :------: |
| Landing, public                         |   Yes   |   Yes    |   Yes    |
| Login, public                           |   Yes   |    —     |   Yes    |
| App shell, local authenticated new user |   Yes   |    —     |   Yes    |

All seven use light mode and reduced motion. Dark mode is deferred because this
phase has no evidence that expanding the matrix is necessary or deterministic.
The threshold is at most `0.3%` differing pixels with a channel threshold of
`0.2`; no content is masked. Product, allergen, confidence, status, navigation,
or any other meaningful content may never be hidden to make a comparison pass.

The committed manifest records each filename, byte count, SHA-256, renderer
identity, fixed settings, a logical fixture-contract checksum, and an overall
checksum. The fixture contract contains only stable rendered state: anonymous
public pages plus a fresh local user with English/PL new-user preferences and
mandatory deletion after the run. It excludes credentials and generated user
or product IDs.

Because this workflow did not exist on the default branch before Phase 5A.0d,
the first pull-request run may generate candidates only when the manifest is
absent from both the exact pull-request base and exact pull-request head. A PR
that removes an existing base manifest fails deterministically and cannot enter
bootstrap mode. The bootstrap checks out the exact pull-request head, runs two
complete passes, and uploads candidates for explicit human review; it never
commits or updates snapshots in place. Once a reviewed manifest is committed,
pull-request generation skips and immutable verification becomes blocking. All
later candidate generation is manual through `workflow_dispatch`.

Before any snapshot update, the launcher proves that the baseline root and both
target spec directories are ordinary owned directories, not symlinks or reparse
points. Candidate upload is staged into a new owned runner-temporary directory
containing exactly seven manifest-listed PNGs plus the manifest. The two staged
eight-file sets must be byte-identical.

## Safety invariants

- Public measurement commands receive no Supabase URL, key, configuration, or
  credentials and fail any hosted/non-loopback Supabase request.
- Local authenticated measurement derives the emulator origin from checked-in
  configuration, accepts only loopback HTTP, creates a deterministic local
  user, and deletes it after the run.
- Fixture teardown and local-runtime shutdown run after browser or assertion
  failure. Artifacts upload only after the safety assertions and cleanup pass.
- Same-origin failures, including image-optimizer failures, are blocking. Every
  image visible in the captured viewport must complete and decode with non-zero
  intrinsic dimensions before a baseline can be generated or verified.
- A service-role key is never passed to Lighthouse/Chromium. LHCI HTML is not
  retained; local credentials are redacted from retained raw JSON before its
  checksum or parse, and sensitive values are scanned from changed artifact
  roots before upload. Only the credential-free compact report is uploaded.
- Neither Vercel nor either hosted Supabase project is queried or modified.
- The known production `/api/health` 503 state is unchanged and outside this
  local measurement contract.

## Exit interpretation

Phase 5A.0d makes future Design System V2 work reviewable: visual drift becomes
explicit, route regressions can no longer hide behind a false zero, and lab
performance has a reproducible distribution. It does not itself optimize or
redesign the product. Any current absolute performance debt remains a separate
scoped prerequisite or acceptance item for the route family that changes it.
