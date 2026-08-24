# Integration cycle 1 — fresh-context review brief

This brief and the paths it names are the authorized review corpus. Do not read prior
scorecards, implementation history, rejection rationale, or another current reviewer's
output before submitting.

## Packet binding

- selected system: Folded Label Register;
- source/tree: `303b7bc156490ddf207df668d2d70ea5e0661cd3` / `19140d9fecff098c9deccf851e1348aff8241e01`;
- manifest SHA-256: `bf05a824e4b4e6d6cd68c8a0b9c525cbc4b1674eebe3cfd9faa220ae306e8364`;
- packet: 91 files / 7,397,136 bytes including the manifest;
- comparisons: `reviews/integration-cycle-1/final-evidence-comparison.md` and
  `reviews/integration-cycle-1/linux-renderer-comparison.md`;
- media: `evidence/` contains 68 PNGs and 12 complete WebMs;
- status: review-only, non-production, production migration prohibited.

Historical scores, including `initial/` and the pre-Linux final recheck under `final/`,
do not approve this renderer-corrected packet and must not be read before the bounded
Linux-renderer recheck is submitted.

## Required inspection

Decision reviewers must inspect every retained original-resolution PNG and all 12
recordings completely, including both 1440×900 typography boards and every changed
WebM. Verify the comparison and inspect `manifest.json`, `journeys.json`,
`performance.json`, `resilience.json`, and `font-assay.json`. Rescore Folded Label
Register and all six references using the 100-point rubric in `REVIEW_INSTRUCTIONS.md`.

The typography/localization lane should emphasize computed sizes, containment,
clipping/overlap, 12px metadata, Polish/German proofs, tabular figures, localized
actions and fixture names, forced colors, text spacing, reflow, and font-assay honesty.

The identity/whole-experience lane should emphasize originality, brand ownership,
identity containment and semantics, evidence hierarchy, state truth, dark/light
quality, interaction outcomes, reduced motion, accessibility, and non-production scope.

The non-taste QA lane does not score taste. It must independently reproduce provenance
and inspect all 68 PNGs and all 12 WebMs for clipping, overlap, truncation, unreadable
microtype, blank/uniform frames, stale state, localization errors, boundary crossings,
identity defects, decoding errors, and still/video/manifest disagreement.

Each lane must report exact defects or explicitly report none. Decision reviewers must
provide every per-category/per-reference score, anticipated disagreements, vetoes, and
required corrections. No lane may self-approve production adoption or migration.
