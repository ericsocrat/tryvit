# Integration cycle 1 — retained local attempt record

The exact-source Golden matrix from `c5edd0f6e43ff86646617a026ffbd0db3e579ad1`
passed 113/113 with retries disabled, and candidate verification passed. The wrapper's
first staging call then stopped fail-closed with
`[P5A2_GOLDEN] evidence-destination-exists` because the local invocation omitted CI's
explicit `PHASE5A2_GOLDEN_REPLACE_EVIDENCE=true` authorization.

No test, visual, accessibility, content, motion, font, provenance, or performance
assertion failed, and no partial destination replaced the reviewed packet. The 113-test
matrix was not rerun. The already verified candidate directory was staged once with
the missing replacement authorization plus the same exact source/tree, after which the
staged verifier passed 91 files / 7,388,236 bytes with manifest SHA-256
`4ff5884a147bacb290a260fc64edc5f05821503641c8ff60aabacb841248f085`.

An earlier attempt to remove only generated `.next` output before the ordinary
flags-off build was rejected by the local command policy before execution. The
repository's standard build then passed without that optional cleanup. No failure was
hidden or retried unchanged.

The first packet-commit invocation was issued from `frontend/` with a repository-root
pathspec, so Git rejected the path before staging or committing anything. The command
was corrected by running the same bounded add/commit from the repository root.

## Review-driven packet history

- initial integrated review packet: source `c5edd0f6…`, manifest `4ff5884a…`; initial
  decision reviews returned conditional PASS/HOLD and required correction;
- source `a26fac2e…`: 113/116 passed; German landing boundary and case-sensitive
  semantic-announcement assertions failed, so no packet staged;
- pre-auth owner packet: source `d640605b…`, manifest `b01f84fe…`, retained at commit
  `919392b6…` before direct mobile ownership was added;
- duplicated-owner packet: source `919392b6…`, manifest `ad736880…`, retained at
  `6eba2ac9…` after primary visual inspection found repeated TryVit wording;
- clipped-auth-owner packet: source `bd9426a2…`, manifest `5e4e41b3…`, retained at
  `8ebb82f9…` after primary inspection found a negative mobile top boundary;
- scroll-offset packet: source `57a562e3…`, manifest `f7204eed…`, retained at
  `60dad6cc…` after Axe was shown to leave a core capture scroll offset;
- final packet: source `7e44b4b4…`, manifest `ef97f4fb…`; 116/116 and both candidate
  and staged verifiers pass with zero-scroll capture asserted immediately before every
  screenshot.

The first final-review commit invocation repeated the earlier frontend-relative
pathspec mistake; Git rejected it before staging or committing. The bounded commit was
then issued from the repository root.

Exact-head Golden CI run `32719711323` stopped in `design-system:check` before local
Supabase or browser execution because the generated live inventory omitted the final
Authentication form's direct `GoldenIdentity` edge. CI computed the same 437 production
modules and zero violations, but correctly rejected two stale graph edges/fingerprints.
The inventory was regenerated and committed before any replacement run.

Corrected exact-head Golden CI run `32720182906` passed source contracts, Supabase,
build, 111/116 browser checks, raw-artifact upload, and no-backup teardown, then failed
on Linux-only assay geometry: the typography board exceeded 900px during fallback,
German landing boundary included hidden review chrome, and unresolved platform-local
Arial/Georgia fallbacks shifted candidate specimen tops. Raw artifact `9517695043` was
retained. The correction reserves cross-platform specimen boxes, compacts the governed
typography canvas without hiding overflow, and binds the German assertion to the actual
`capture=1` artifact canvas. No threshold, proof string, type size, font byte, or
Lighthouse limit was reduced.

The first Linux-review documentation commit was again invoked from `frontend/` with
repository-root pathspecs; Git rejected it without staging. The commit was issued from
the repository root and no content was lost.
