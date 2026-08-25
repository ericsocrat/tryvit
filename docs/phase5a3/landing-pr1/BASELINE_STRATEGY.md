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

A first manual workflow-dispatch candidate run, `32803841385`, used branch commit
`ce422e56576a8a057fd7c01a9ef2d6f51a06f547`. Both public and local-authenticated capture
passes, safety assertions, fixture teardowns, and first seven-image sealing succeeded.
The second seven-image set failed the required byte-identical `cmp`, so the workflow
correctly withheld both the candidate artifact and determinism artifact. The workflow
does not emit which file differs, and this implementation PR does not weaken that check.

Corrected exact-source run `32823920912` used commit
`f0674a59f4f0342c0d4f37e73c436ea8add526d5` (production source `1f7ad2c0`) and passed
the full two-pass byte comparison. Its first and second file ledgers are identical; the
manifest checksum is `9dea98b90ce3fe6c9b2812375a747d412fd8c322309ff420e7e7ccef81752d78`.
The workflow published candidate artifact `9554388580` and determinism artifact
`9554388909`. The three landing candidates are retained under
`evidence/linux-candidate/` and hashed in `evidence/linux-candidate.json`.

Review-only raw RGB diagnostics against the currently accepted landing baselines count
pixels with any channel delta above 0.2: 23.58% at 390×844, 18.06% at 768×1024, and
13.58% at 1440×900. These are not Playwright's perceptual result and cannot approve a
baseline. The authoritative PR comparator separately reported 56,731 differing pixels
(18%) at 390×844 before its serial suite stopped.

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

The existing route-JS comparator has an analogous governance problem: its trusted base
harness identifies `/` by the retired hero headline. A separately reviewed base-owned
harness update must replace that content-specific identity marker with a stable route
marker before authoritative base/head JS comparison can run.
