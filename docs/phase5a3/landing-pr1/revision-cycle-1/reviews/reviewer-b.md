# Independent final review B

Disposition: **REJECT** the exact candidate. Reviewer advice only; no self-approval.

The reviewer did not read existing review files, reviewer scores, git history,
`performance-trials.json`, or implementation rationale before scoring.

## Findings

### P1 — mobile LCP exceeds both hard budgets

Final mobile LCP is `2779.0`, `2410.1`, `2835.2`, `2310.6`, and `2299.2 ms`. Median
`2410.1 ms` exceeds `2400 ms`, and two samples exceed `2500 ms`. The H1 is consistently
LCP; simulated element-render delay is approximately 1845–2374 ms. A source fix and
complete new source-bound cohort are required.

### P2 — deterministic Linux output diverges from final container stills

The 1440×900 Linux candidate uses a materially heavier/wider system-font rendering and
loses the desktop CTAs below the first-fold boundary, while the final container still
shows both. At 390×844, the final still begins the package specimen while the Linux
candidate leaves it below the fold. Two-pass CI determinism proves one renderer, not
cross-environment metric robustness. Worst-case system-font hierarchy/spacing needs a
source correction or an approved metric-stable legal fallback.

### P3 — desktop identity remains repeated

At 768 and 1440, the header and hero repeat the full TryVit lockup and the same
Poland/Germany descriptor. Mobile appropriately collapses the header to the mark, but
desktop reads as two mastheads and spends vertical space that would help retain actions.

## Evidence that passed

- Exact source/tree and declared artifact bytes/hashes inspected.
- Route-JS passes at 182,296 bytes, −67,749 bytes from main, inside unchanged limits.
- Both complete videos, nine checkpoints, full footer, terminal focus, zero CLS, and no
  attributable long task/shift verified.
- VP8 368×800, 25 fps, 154/70 decoded frames, 6.16/2.80 seconds; first/final frames are
  nonblank and untruncated.
- 320 reflow, forced colors, no-JS light/dark, PL text spacing, DE dark, and EN states
  remain legible without observed horizontal clipping.
- Native disclosure works without JavaScript; skip/title/locale/demo/provider/live-auth
  contracts have direct evidence.
- Linux landing candidates and determinism manifests/hash lists agree byte-for-byte.
- Code/secret alerts are zero; immutable baselines remain unchanged.

## Human gates and limitations

Baseline acceptance, qualified PL/DE, legal clearance, branded Safari, screen-reader,
camera, and physical-device review remain open. Automated Axe/keyboard/localization and
license checks do not close them.

All 13 final stills, three Linux landing candidates, both videos, ten raw LHRs,
performance/motion/runtime/manifest/Route-JS/determinism artifacts, predecessor media,
source, and focused contracts were inspected. The reviewer reported 53 permitted
manifest entries; primary independent verification and Reviewer A recorded 54, with no
hash or byte mismatch. This count discrepancy does not change the disposition.
