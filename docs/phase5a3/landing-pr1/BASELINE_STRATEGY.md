# Immutable visual-baseline strategy

The Phase 5A.0d comparator treats committed baselines as immutable relative to the
exact PR base. Its workflow explicitly directs intentional redesigns to a separately
authorized baseline-update process. The PR therefore does not change the baseline PNGs,
manifest, comparator thresholds, renderer attestation, or workflow policy.

The expected PR verification failure is preserved. On run `32803213265`, the first
390×844 landing comparison reported 56,731 differing pixels (18%) against
`p5a0d-landing-390x844-light-reduced.png`; the remaining serial baseline tests did not
run after that intentional mismatch. The workflow did not publish its compact diff
artifact because the current upload conditions were not reached.

A manual workflow-dispatch candidate run, `32803841385`, used exact branch commit
`ce422e56576a8a057fd7c01a9ef2d6f51a06f547`. Both public and local-authenticated capture
passes, safety assertions, fixture teardowns, and first seven-image sealing succeeded.
The second seven-image set failed the required byte-identical `cmp`, so the workflow
correctly withheld both the candidate artifact and determinism artifact. The workflow
does not emit which file differs, and this implementation PR does not weaken that check.

## Required acceptance sequence

1. Keep PR #1301 draft and unmerged while Eric reviews the source-bound stills,
   recordings, performance/baseline blockers, and independent reviews.
2. If Eric approves the visual direction and separately accepts the identity/legal
   risk, authorize a distinct baseline-update change whose scope is only the reviewed
   landing baseline bytes, manifest/provenance, and the minimal base-owned policy needed
   to accept them.
3. Preserve the old baseline and the candidate/diff evidence in review history. Bind
   replacement bytes to the exact approved implementation SHA and attested renderer.
4. Re-run the immutable comparator from the updated base. Do not lower thresholds,
   mask pixels, broaden tolerances, or allow this implementation PR to rewrite its own
   baseline.

Before step 2, diagnose the Linux two-pass determinism miss in a separately governed
baseline-candidate run and obtain an exact, byte-identical candidate artifact.

The existing route-JS comparator has an analogous governance problem: its trusted base
harness identifies `/` by the retired hero headline. A separately reviewed base-owned
harness update must replace that content-specific identity marker with a stable route
marker before authoritative base/head JS comparison can run.
