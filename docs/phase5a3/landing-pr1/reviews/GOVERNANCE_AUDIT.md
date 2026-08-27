# Read-only governance audit

Audit source: corrected candidate head `f0674a59f4f0342c0d4f37e73c436ea8add526d5`.

The specialist found no safe unilateral fix for the three governance blockers inside
this landing-only implementation PR.

## Inherited structured data

`frontend/src/app/layout.tsx` unconditionally emits a `WebApplication` JSON-LD object on
every route, while `/` adds its truthful route-local `WebSite` object. Page metadata
cannot suppress a parent layout script, and the repository has no structured-data
registry, route suppression hook, or nested landing layout that can replace root `<head>`
content. A root-layout change would affect unrelated routes and conflicts with this PR's
scope. The crawler-visible instant-scan/science-driven-score wording therefore requires
a separately authorized root metadata/topology correction.

## Route JavaScript

The Route JavaScript Regression Guard intentionally archives the PR-base measurement
harness and restores it over both base and head. That trusted harness identifies `/` by
the retired exact H1. A head-side edit cannot change the judge, and rendering hidden or
misleading retired copy solely for CI would invalidate the measured route. The supported
sequence is a separate reviewed base-owned harness PR using a stable route marker, merge
to `main`, rebase this landing PR, and rerun base/head comparison.

## Visual candidate diagnostics

The manual workflow generates each pass with snapshot-update mode, then separately
hashes and compares the sealed seven-image sets. Successful capture/safety steps do not
imply byte equality. Run `32803841385` produced different first/second manifest
checksums, then failed at `cmp --silent` before the workflow copied or uploaded mismatch
diagnostics. Current policy correctly exposes neither candidate PNGs nor hash evidence
after a mismatch.

If diagnosis is authorized, use a separate workflow-policy PR that uploads hash-only
first/second manifests after safety and cleanup even when they differ, while continuing
to gate candidate PNG upload and acceptance on exact equality. Do not add masks, lower
thresholds, average retries, or bypass byte comparison.

## Fail-closed sequence

1. Keep PR #1301 draft.
2. Separately authorize and merge the root structured-data correction.
3. Separately authorize and merge the base-owned stable route-JS identity marker.
4. Rebase and run the authoritative route-JS comparison.
5. If needed, separately authorize hash-only mismatch diagnostics; rerun the exact
   corrected Linux candidate generator.
6. Only after a byte-identical candidate and Eric's visual approval, authorize the
   distinct baseline-update change.
