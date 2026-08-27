# Phase 5A.0d — Authoritative Performance and Visual Gates

> **Status:** Draft implementation evidence with reviewed Linux bootstrap
> screenshots committed; route-JavaScript and Lighthouse results are bound to
> exact source `aa84b2bd8a22b20e1625d33dede66238c507130f`
> **Scope:** Measurement, CI, and baseline infrastructure only
> **Visual redesign:** Not included
> **Hosted data/deployment services:** Not accessed by the measurement harness
> or modified by this implementation

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

| Class                  | Meaning in this phase                                                                                         | Authority                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Lighthouse lab         | Synthetic local production-build audit under the pinned profile                                               | Blocking only when provenance, five samples, exact route, no redirect, and variance checks all validate             |
| Route JavaScript       | Independently gzip-compressed first-party `/_next/static/*.js` responses observed by a fresh browser          | Blocking after the reviewed comparator exists on the exact PR base; initial bootstrap evidence is illustrative only |
| Encoded transfer       | Browser Resource Timing total when every tracked script exposes a positive value                              | Reported as an observation; unavailable is `null`, never zero                                                       |
| Visual baseline        | Viewport screenshot from the pinned Linux runner, browser, fixture, theme, motion, locale, and clock contract | Blocking after explicit candidate review and committed hash manifest                                                |
| Historical observation | Old scores or retained screenshots without the full contract                                                  | Context only                                                                                                        |
| Field Core Web Vitals  | Real-user p75 LCP, INP, and CLS                                                                               | Not available; no field claim is made                                                                               |

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
`http://127.0.0.1:3000`. A pinned tool/runtime, runner OS family, or architecture
change is environment drift and requires a new reviewed candidate; it is not
compared as if it were the same renderer. GitHub's hosted-runner
`imageVersion` build identifier is retained as an observation rather than an
identity blocker: phased fleet rollout can change that identifier while the
pinned runtime/browser contract and exact rendered PNG bytes remain identical.
Every comparison prints the manifest and actual image versions and records them
in the Actions summary. OS, architecture, pinned versions, deterministic
settings, and pixel equality remain blocking.

The existing Open Graph image modules request a fixed Inter font URL while
Next.js builds those routes. Phase 5A.0d pins that exact response as a test-only
font fixture (`344,068` bytes; SHA-256
`c1c6ba111e8d04d392b741d194ab548186ec3c006ed7cc134be0525402520339`).
A process-local Node preload fulfills only that exact URL from the checked-in
fixture during guarded builds and owned Next servers, and rejects every other
`fonts.gstatic.com` URL. The owned egress proxy
has no external CONNECT allowlist during build, server, Playwright, or
Lighthouse execution. Product font code and typography remain unchanged while
both the measurement build and owned runtime remain local-only and
content-attested. The adjacent
`inter-bold-c1c6ba11.OFL.txt` records the exact source, checksum, copyright, and
SIL Open Font License 1.1 redistribution terms.

### Cache and run rules

- Route-JavaScript captures use a fresh browser page for every route, block
  service workers, and wait for a deterministic 750 ms tracked-script quiet
  period. Each local build is clean and guarded.
- Route bytes are read from the exact emitted file and independently compressed
  with gzip level 9. Missing attribution, an empty asset set, unexpected script
  origins, redirects, invalid transfer values, or zero-byte output fails.
- Base and head route measurements execute sequentially on the same Linux
  runner with the same measurement implementation and browser profile. The
  exact Phase 5A.0c bootstrap predates that implementation, so its head-authored
  comparison is explicitly **illustrative and non-enforcing**. Once the reviewed
  harness exists on the exact PR base, that base harness is restored over both
  revisions and the `+10 KiB OR +5%` regression rule becomes blocking. A PR
  cannot redefine the comparator that judges it.
- Measurement jobs install from the lockfile with lifecycle scripts disabled,
  reinstall after Playwright browser setup, verify the exact checkout SHA and a
  clean tracked tree, and only then restore the SHA-attested verifier archive.
  Reviewed npm entry points replace the complete script map, so unreviewed
  `pre*` and `post*` hooks cannot shadow a trusted command.
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
proves that the exact verified Phase 5A.0c base and head both lack a manifest;
it uploads but never commits them. The seven PNGs are committed only after
their artifact hashes and rendered contents are reviewed. CI labels this
bootstrap `review-required`; it does not infer human approval from the presence
of a manifest. If a base manifest
exists, every manifest and `p5a0d-*.png` byte is immutable relative to that
exact base; deletion, replacement, or addition fails before browser execution.
Future candidate generation is manual-only. Every candidate run renders the
complete matrix twice from the same source and requires byte-identical
manifests before upload. Verification cannot pass an update flag and fails on
any hash, file-set, fixture, renderer, viewport, route, or environment
difference.

If `main` advances before the Phase 5A.0d draft merges, verification may retain
the reviewed bootstrap only when the new base is a proven descendant of the
verified Phase 5A.0c commit, every intervening tree change is confined to
`frontend/package.json` and `frontend/package-lock.json`, the head preserves
the exact current-main lockfile, and the approved Phase 5A.0d harness and
baseline bytes remain identical to reviewed commit
`2b097bbe9eb0b3501421f1250972c98ce24ce60b`. This synchronized path remains
review-required and non-authoritative. Any unrelated base change, harness
change, lifecycle-script change, lockfile mismatch, or baseline-byte drift
fails closed.

An intentional future redesign first generates manual candidates and receives
human before/after review. The current PR gate deliberately rejects baseline
changes relative to its base; accepting a reviewed redesign candidate requires
a separate, explicitly authorized baseline-update workflow change. A baseline
update cannot be smuggled into an unrelated product PR. The 74 retained audit
screenshots remain outside this system.

The reusable intentional-redesign lane is installed base-first and remains
separate from product work. Its read-only `pull_request_target` workflow checks
out only the exact pull-request base and treats the proposed manifest, PNGs,
approval comment, label event, workflow run, and artifacts as untrusted data.
Acceptance requires the dedicated
`phase5a0d-intentional-redesign-approved` label on a
`codex/phase5a0d-accept-*` branch plus a fresh repository-owner approval comment
bound to the final baseline-PR head, the approved implementation SHA/tree, the
successful deterministic candidate run, both artifact digests, and every PNG
path authorized for replacement. A commit after approval invalidates that
authorization because the recorded head no longer matches.

The candidate must contain the exact seven-case manifest and PNG set, and its
two retained passes and hash ledgers must be byte-identical. Only declared PNG
hash/byte fields, the approved implementation source commit, and the derived
manifest checksum may change. All unrelated PNGs and every route, viewport,
fixture, locale, theme, motion, clock, mask, threshold, renderer, and dependency
contract remain immutable. Path traversal, symlink/reparse input, extra files,
head-authored executable code, and policy changes in the baseline PR fail
closed.

An approval may separately identify an earlier reviewed visual-source commit
and a later synchronized implementation only when the visual source is an
ancestor of that implementation, every normal landing-render source blob is
unchanged, and complete deterministic candidate artifacts from both commits
contain seven byte-identical PNGs. The earlier artifact remains the accepted
visual and renderer provenance; the later artifact is equivalence evidence
only and cannot replace runner metadata. Both workflow runs, both candidate and
determinism artifact pairs, both source trees, and the exact authorized paths
must be present in the fresh owner approval. This does not weaken the ordinary
exact-head path and fails closed on any source, artifact, pixel, manifest,
settings, or ancestry mismatch.

Because a baseline-only PR still contains the pre-redesign product source, the
ordinary render comparator is not a truthful acceptance mechanism for that one
PR: old source is expected to differ from newly approved bytes. The trusted
artifact/provenance validator owns that bounded decision. Immediately after
the baseline-only merge, the approved implementation PR must synchronize main;
the ordinary immutable comparator then becomes authoritative and must pass
before the product PR may be considered mergeable. This creates no permission
to weaken or skip ordinary verification for any other pull request.

The renderer-attestation target likewise delegates only a baseline-only change
carrying the repository-owned intentional-redesign authorization label. That
delegation does not validate or accept the change: the independent intentional-
redesign target remains responsible for the fresh owner approval, exact head,
authorized paths, artifacts, provenance, and pixels. Removing the label, adding
attestation evidence, or mixing any product or workflow path into the baseline
change fails closed through the strict renderer-attestation path.

### Renderer/runtime attestation maintenance

The hosted Ubuntu image build identifier alone does not require renderer
metadata migration. Phase 5A.0d retained exact-source runs on image versions
`20260816.277.1` and `20260823.283.1`; all seven candidate PNGs were
byte-identical across the two runs. That evidence makes the build identifier
useful provenance, but not a better gate than the pinned renderer inputs and
the pixels themselves. The following maintenance lane remains applicable when
a blocking renderer/runtime field changes or when pixels change.

A runner OS/architecture or lockfile-pinned renderer change is not treated as
a product redesign. It still requires a separate maintenance sequence because
a pull request may not install the rule that authorizes its own manifest
change. The first maintenance PR installs the base-owned comparator and the
read-only `pull_request_target` evidence gate without changing the manifest or
any PNG. Only after that policy is on `main` may a second, metadata-only
attestation PR be opened.

The attestation PR is externally authorized by the exact
`phase5a0d-renderer-attestation-approved` label and the dedicated
`codex/phase-5a0d-renderer-runtime-attestation` branch. The trusted target
workflow checks out and executes only the exact PR base. It fetches the head as
data, never executes head code, and accepts exactly two changed paths: the
manifest and one machine-readable evidence record. Its candidate must come
from a successful manual run of this workflow on that exact base and must have
completed before acceptance.

The base-owned comparator rejects every PNG addition, deletion, symlink, path,
byte, or hash change and every case, route, mode, viewport, fixture, settings,
threshold, clock, locale, theme, fixture-checksum, schema, or kind change. The
head manifest must be byte-identical to the reviewed candidate manifest, while
the candidate's seven PNGs must be byte-identical to both the base manifest and
the base files. Only `sourceCommit`, runner identity, runtime versions, and the
derived manifest checksum may reflect the observed exact-base candidate. A
product PR cannot use this path because any additional changed file fails the
base-owned scope check.

A retained candidate from an approved source-equivalent implementation may be
used only through the separately installed v2 contract. That path requires a
fresh repository-owner comment bound to the final metadata-PR head and a later
owner-applied renderer-attestation label. The trusted base policy independently
binds the candidate source commit/tree, synchronized implementation PR/head/tree,
successful manual workflow run, candidate and determinism artifact IDs, digests,
sizes, and timestamps. It proves ancestry, byte-identical normal landing runtime
sources, identical package and lockfile inputs, two-pass determinism, and seven
candidate PNGs identical to committed baselines. The existing exact-main v1 path
remains unchanged; any source, pixel, runtime, settings, dependency, scope, path,
or authorization mismatch fails closed.

Manual generation retains two artifacts. The candidate artifact remains the
exact seven PNGs plus manifest intended for review. A separate compact
determinism artifact retains both pass manifests, both sorted eight-file hash
lists, source SHA, runner/runtime identity, generator archive hash, and package
and lockfile hashes. This makes two-pass equality independently auditable
without expanding the baseline payload.

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

### Authoritative Linux route-JavaScript evidence

The exact-head Linux run for
`aa84b2bd8a22b20e1625d33dede66238c507130f` measured identical base and head
values, so every bootstrap delta is zero:

| Route               | Total gzip | Shared gzip | Route-owned gzip | Head delta | Target status                               |
| ------------------- | ---------: | ----------: | ---------------: | ---------: | ------------------------------------------- |
| Landing             |  414.3 KiB |   414.0 KiB |          0.3 KiB |    0 bytes | Above 180 KiB target                        |
| Login               |  418.5 KiB |   410.8 KiB |          7.7 KiB |    0 bytes | No absolute target                          |
| Contact             |  416.6 KiB |   414.0 KiB |          2.6 KiB |    0 bytes | Above 150 KiB target                        |
| Authenticated shell |  760.7 KiB |   746.9 KiB |         13.8 KiB |    0 bytes | No absolute target; material shared-JS debt |
| Product detail      |  782.2 KiB |   746.9 KiB |         35.3 KiB |    0 bytes | No absolute target; material shared-JS debt |

The bootstrap is evidence-only because the base did not yet contain the
reviewed harness (`regressionEnforced=false`). After merge, the checked-in
comparison becomes the base-owned regression authority. The compact comparison
checksum is
`2c7732211381cc7e54e0c24163262b15e53c9b65f39be179a44c1dcc57b90ddd`;
the head-report checksum is
`a7485256acb4c60a6ebd051ee737e62dfce6d80d26c1aad6283ccac8cab840e1`,
and the retained GitHub artifact archive digest is
`19b6cf8de3cb17ae704b16699e811f9d8f22e9f98992d584ee7e9b1a61b0fbc6`.
These values come from GitHub run `30771067756`, artifact ID `8840638252`
(`route-js-phase5a0d-evidence`).
The landing and contact target misses remain explicit debt rather than being
absorbed into the zero-delta result.

## Lighthouse contract

The checked-in source configuration files remain byte-for-byte unchanged:

- Mobile: `29B7A7AC0DC3CE98633E1013F57486C878C33DD6271D9D7462E2F4804C32285E`
- Desktop: `E2C2279410348292CB9744AD8CD12B75E2459A00A7EABA84F9CA36BB5DB0CA9F`

Configuration identity canonicalizes only LF/CRLF representation to the
documented CRLF byte contract before hashing. Windows and Linux checkouts now
produce the same two identities without changing either configuration or any
threshold.

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

The Living Label blueprint remains separately visible. Landing has the
route-specific performance targets `0.90` mobile / `0.95` desktop and CLS median
target `0.05`; every selected route reports the general LCP `2.5 s`, TBT
`200 ms`, TTFB `800 ms`, CLS maximum `0.10`, and cold-mobile transfer `900 KiB`
directions. A miss is debt, not permission to lower the target.

### Fresh local five-run observation

The corrected contract produced the following Windows observations from one
public build and one local-authenticated build. They are reproducibility
evidence; only the pinned Linux workflow is authoritative.

| Route/profile          | Performance |      LCP | CLS |    TBT | Transfer | Result                                  |
| ---------------------- | ----------: | -------: | --: | -----: | -------: | --------------------------------------- |
| Landing mobile         |        0.94 | 2,939 ms |   0 |  82 ms |  511 KiB | Public floor passes; blueprint LCP debt |
| Login mobile           |        0.93 | 3,087 ms |   0 | 102 ms |  501 KiB | Public floor passes; blueprint LCP debt |
| Contact mobile         |        0.91 | 3,471 ms |   0 |  83 ms |  509 KiB | Public floor passes; blueprint LCP debt |
| Landing desktop        |        0.99 |   840 ms |   0 |   2 ms |  511 KiB | Pass                                    |
| Login desktop          |        1.00 |   797 ms |   0 |   0 ms |  501 KiB | Pass                                    |
| Contact desktop        |        1.00 |   732 ms |   0 |   0 ms |  509 KiB | Pass                                    |
| App shell mobile       |        0.70 | 6,764 ms |   0 | 312 ms |  880 KiB | **Below floor; LCP/TBT debt**           |
| Product detail mobile  |        0.80 | 4,170 ms |   0 | 293 ms |  906 KiB | **Below floor; LCP/TBT/transfer debt**  |
| App shell desktop      |        0.99 |   916 ms |   0 |   0 ms |  924 KiB | Pass                                    |
| Product detail desktop |        0.99 | 1,037 ms |   0 |   0 ms |  940 KiB | Pass                                    |

All accessibility, best-practices, SEO, and CLS floors passed. No distribution
was statistically inconclusive. The compact report checksum is
`6334e8159a56a08a259c75dab3921d4c87bc76a3b1137b5022e24328f23f52ab`.
The report is lab-only: it provides no field p75 or INP evidence.

### Authoritative exact-head Linux Lighthouse evidence

The pinned Linux workflow attested the literal source commit
`aa84b2bd8a22b20e1625d33dede66238c507130f` and completed all ten five-run
route/profile distributions. Medians and median absolute deviations (MAD) are:

| Route/profile          | Perf. | Range | A11y |   BP |  SEO | LCP ± MAD      | TBT ± MAD    | Result                                                |
| ---------------------- | ----: | ----: | ---: | ---: | ---: | -------------- | ------------ | ----------------------------------------------------- |
| Landing mobile         |  0.84 |  0.21 | 1.00 | 0.96 | 1.00 | 3,898 ± 271 ms | 413 ± 165 ms | **Gate fails: instability; performance/LCP/TBT debt** |
| Login mobile           |  0.87 |  0.12 | 1.00 | 0.96 | 1.00 | 3,860 ± 199 ms | 69 ± 10 ms   | **Gate fails: instability; LCP debt**                 |
| Contact mobile         |  0.86 |  0.16 | 1.00 | 0.96 | 1.00 | 3,891 ± 195 ms | 94 ± 5 ms    | **Gate fails: instability; LCP debt**                 |
| Landing desktop        |  0.99 |  0.01 | 1.00 | 0.96 | 1.00 | 840 ± 12 ms    | 3 ± 1 ms     | Pass                                                  |
| Login desktop          |  0.99 |  0.00 | 1.00 | 0.96 | 1.00 | 852 ± 8 ms     | 0 ± 0 ms     | Pass                                                  |
| Contact desktop        |  0.99 |  0.01 | 1.00 | 0.96 | 1.00 | 830 ± 43 ms    | 0 ± 0 ms     | Pass                                                  |
| App shell mobile       |  0.62 |  0.19 | 1.00 | 0.96 | 1.00 | 6,878 ± 67 ms  | 552 ± 103 ms | **Fails performance/instability; LCP/TBT debt**       |
| Product detail mobile  |  0.78 |  0.15 | 0.92 | 0.96 | 1.00 | 3,678 ± 375 ms | 422 ± 28 ms  | **Fails performance/a11y/instability; LCP/TBT debt**  |
| App shell desktop      |  0.99 |  0.02 | 1.00 | 0.96 | 0.92 | 919 ± 34 ms    | 47 ± 16 ms   | Pass under the applicable authenticated route floors  |
| Product detail desktop |  0.98 |  0.01 | 0.93 | 0.96 | 1.00 | 1,080 ± 74 ms  | 52 ± 18 ms   | **Below preserved 0.95 accessibility floor**          |

The remaining requested lab metrics are:

| Route/profile          |    CLS median / max |    TTFB ± MAD |  Transfer | Directional budget status           |
| ---------------------- | ------------------: | ------------: | --------: | ----------------------------------- |
| Landing mobile         |               0 / 0 | 16.4 ± 0.9 ms | 509.4 KiB | Performance, LCP, and TBT debt      |
| Login mobile           |               0 / 0 | 12.3 ± 0.8 ms | 499.9 KiB | LCP debt                            |
| Contact mobile         |               0 / 0 | 11.7 ± 0.5 ms | 504.8 KiB | LCP debt                            |
| Landing desktop        |               0 / 0 | 14.0 ± 0.9 ms | 509.2 KiB | Meets reported blueprint directions |
| Login desktop          |               0 / 0 | 12.0 ± 0.7 ms | 499.1 KiB | Meets reported blueprint directions |
| Contact desktop        |               0 / 0 | 10.4 ± 0.3 ms | 505.4 KiB | Meets reported blueprint directions |
| App shell mobile       |               0 / 0 | 85.4 ± 3.7 ms | 879.3 KiB | LCP and TBT debt                    |
| Product detail mobile  |               0 / 0 | 88.0 ± 2.3 ms | 904.8 KiB | LCP, TBT, and cold-transfer debt    |
| App shell desktop      |               0 / 0 | 80.8 ± 0.8 ms | 912.3 KiB | Meets reported blueprint directions |
| Product detail desktop | 0.000254 / 0.000254 | 85.3 ± 2.3 ms | 929.1 KiB | Meets reported blueprint directions |

The authoritative job is intentionally red because the app-shell mobile
performance and product-detail performance/accessibility debts are real. It is
not an infrastructure failure: exact-head/configuration attestation, all safety
assertions, credential redaction, fixture teardown, local-runtime shutdown,
and evidence staging/upload passed; report generation completed and then
returned nonzero for those debts. All five mobile performance ranges exceed the
`0.10` stability limit, and landing mobile TBT MAD exceeds its stability
boundary. These six instability failures are additive to the four category
floor failures: app-shell mobile performance, product-detail mobile performance
and accessibility, and product-detail desktop accessibility. The compact report
checksum is
`73cf07ed2c265403d5614987bfc6196bb02f9bf314a062a8a5dd5248f68c8605`;
the retained artifact archive digest is
`c99dfbc5722fbc698de89cdd6e47619581e3fa1583abaa3185a77540aa9d27ca`.
These values come from GitHub run `30771067758`, artifact ID `8840696455`.
That retained artifact predated the final correction that applies general
timing and cold-mobile transfer directions to every selected route; the raw
medians above already expose the additional product-detail transfer miss. The
final exact-head workflow regenerates the compact report under the corrected
classification without changing a threshold.
This remains lab evidence only; no field Core Web Vitals or INP claim is made.

### Historical desktop login investigation

The old `0.66`, `0.69`, and `0.64` values are not normalized or discarded.
They were produced by a purported desktop setup that retained an inconsistent
mobile-derived effective environment and used three-run assertion behavior.
They establish why the correction was necessary, but cannot establish whether
the login route has desktop performance debt. Only the corrected five-run
median can answer that question. The exact-head Linux desktop login median is
`0.99` with a `0.00` observed range, so the historical condition was a
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

The committed manifest records each route identity, path, viewport, fixture
state, filename, byte count, SHA-256, renderer identity, fixed settings, a
logical fixture-contract checksum, and an overall checksum. The fixture
contract contains only stable rendered state: anonymous public pages plus a
fresh local user with English/PL new-user preferences and mandatory deletion
after the run. It excludes credentials and generated user or product IDs.

Because this workflow did not exist on the default branch before Phase 5A.0d,
the first pull-request run may generate candidates only when the manifest is
absent from both the exact pull-request base and exact pull-request head. A PR
that removes an existing base manifest fails deterministically and cannot enter
bootstrap mode. The bootstrap checks out the exact pull-request head, runs two
complete passes, and uploads candidates for explicit human review; it never
commits or updates snapshots in place. Once a reviewed manifest is committed,
pull-request generation skips and the initial PR verifies the exact committed
bytes with a SHA-attested but still review-required head verifier. After merge,
the exact PR-base verifier becomes authoritative for later pull requests, so a
head revision cannot weaken the comparison that judges it. All later candidate
generation is manual through `workflow_dispatch`.

Before any snapshot update, the launcher proves that the baseline root and both
target spec directories are ordinary owned directories, not symlinks or reparse
points. Candidate upload is staged into a new owned runner-temporary directory
containing exactly seven manifest-listed PNGs plus the manifest. The two staged
eight-file sets must be byte-identical.

### Reviewed Linux visual baseline evidence

The exact-head Linux bootstrap ran the complete public and local-authenticated
capture twice, and the two staged eight-file sets were byte-identical. Each PNG
was independently downloaded, hash-validated against the manifest, and visually
reviewed at original resolution before commit:

GitHub run `30771067764` retained artifact ID `8840624978`, named
`phase5a0d-visual-baseline-candidates-aa84b2bd8a22b20e1625d33dede66238c507130f`.
The manifest preserves the exact renderer as Ubuntu 24 image
`20260720.247.2` x64, Node `v22.21.1`, npm `10.9.4`, Next.js `16.2.12`,
Playwright `1.62.0`, and Chromium `151.0.7922.34`.

| Route/state               | Viewport |   Bytes | PNG SHA-256                                                        |
| ------------------------- | -------- | ------: | ------------------------------------------------------------------ |
| Landing, public           | 390×844  |  85,157 | `e5704802156929b1ae99ed1ea8c9570091c9f3afe685ba1c5de544c20cd73c3e` |
| Landing, public           | 768×1024 | 139,834 | `abd72cef9693d7d87a44a64d7967b4c363739cef59a541c71f76828bbbfff790` |
| Landing, public           | 1440×900 | 178,825 | `0688d51c24ead7a8642569a68dd1d52189b8f460b7215ca340ed142224609efc` |
| Login, public             | 390×844  |  49,800 | `dcb24f7d21fbfcd9c2068982c35ce7abc866139fb628eb77e26bae40de4714b9` |
| Login, public             | 1440×900 | 266,772 | `f73f3d3dbb07b356938ec3222c03708e995b8121e665feb470682a0ee880ab66` |
| App shell, local new user | 390×844  |  47,056 | `19925c064157c05291ffe4a02b10b66f705268dec916dd26230972b667ad2fa5` |
| App shell, local new user | 1440×900 |  61,059 | `c1e40efd43128e66c4bb1f87921ffd554c7d2b94b156919f727946f226b8dc2b` |

The reviewed images contain no broken image, clipping, overflow, credential,
local identifier, hosted data, or content mask. They preserve the existing
design as a regression reference; they do not endorse it as Design System V2.
The manifest semantic checksum is
`12a00dc37191191b788964d1c599d103aa0fedb1c15fa8cc36ad80d746953716`,
its file SHA-256 is
`8c17917c60a3b46f087cc5d5cd3a80b34355015ed9e8de0a58e98826f11bdf9c`,
and the uploaded artifact archive digest is
`94d28b9e39470d950b5eac30d31cd741d8d76b1dc210079ba929eafd448dd985`.
The deterministic fixture-contract checksum is
`12b5fb3bf42f9d969f4bdf248cc142df1c8515b30f793c533c01f82243eea580`.

After the dependency-only synchronization with current `main`, the tracked
package manifests retain the current-main dependency graph (including
`@playwright/test` 1.62.1). Immutable pixel verification deliberately installs
the exact manifest-producing dependency graph from `aa84b2bd…` in the ephemeral
runner only, verifies Playwright 1.62.0 and Chromium 151, then restores and
attests the current tracked manifests before running the sealed verifier. This
keeps the seven reviewed PNGs and their hashes authoritative without pretending
that a different renderer is byte-comparable. Candidate generation,
Lighthouse, and route-JavaScript accounting continue to exercise the actual
current-main dependencies. The ephemeral runtime commit is derived directly
from the immutable manifest's validated `sourceCommit` and must exist in the
fetched repository. Immutable verification is also enabled for the authorized
Phase 5A.0e stacked-PR base so that the separate remediation PR cannot bypass
the visual contract while Phase 5A.0d remains unmerged.

## Safety invariants

- Public measurement commands receive no Supabase URL, key, configuration, or
  credentials and fail any hosted/non-loopback Supabase request.
- Local authenticated measurement derives the emulator origin from checked-in
  configuration, accepts only loopback HTTP input, derives only the exact
  same-host/port `ws:` Realtime source, creates a deterministic local user, and
  deletes it after the run. Both checked-in lifecycle wrappers start local
  Realtime for the existing feature-flag subscription and retain no hosted
  fallback.
- Fixture teardown and local-runtime shutdown run after browser or assertion
  failure. Artifacts upload only after the safety assertions and cleanup pass.
- Same-origin failures, including image-optimizer failures, are blocking. Every
  image visible in the captured viewport must complete and decode with non-zero
  intrinsic dimensions before a baseline can be generated or verified.
- A service-role key is never passed to Lighthouse/Chromium. LHCI HTML is not
  retained; local credentials are redacted from retained raw JSON before its
  checksum or parse, and sensitive values are scanned from changed artifact
  roots before upload. Only the credential-free compact report is uploaded.
- The measurement harness does not query Vercel or either hosted Supabase
  project. It has no hosted fallback, login, link, preview, push, or migration
  path.
- The known production `/api/health` 503 state is unchanged and outside this
  local measurement contract.

## Exit interpretation

Phase 5A.0d makes future Design System V2 work reviewable: visual drift becomes
explicit, route regressions can no longer hide behind a false zero, and lab
performance has a reproducible distribution. It does not itself optimize or
redesign the product. Broad Phase 5A.1 visual implementation should not begin
while the authoritative Lighthouse check is red: authenticated-mobile
performance and product-detail accessibility require a separate scoped
remediation first. The reviewed visual foundation itself is ready; the measured
product debt, not measurement trust, is the remaining entry blocker.
