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
