# Correction cycle 1 — fresh-context review brief

This brief is the only review framing supplied before independent scoring. Do not read
the implementation history, prior scorecards, rejection rationale, or another current
reviewer's output before submitting.

## Packet binding

- system: **Folded Label Register**;
- brand/expression owner: **Source Fold**;
- product/evidence-architecture owner: **Evidence Register**;
- source: `eaffa77e67d0bee5566966b9d17e021117e60058`;
- tree: `7019042ee0326c183e707af6ab403460824045d0`;
- manifest SHA-256:
  `e24b555304fb7319d426b892ea6c9bacb32e46d44bfea0bbf88f24a1ff44bc62`;
- packet: 85 files / 7,253,089 bytes including the manifest;
- status: review-only, non-production, production migration prohibited.

The previous packet and its scores are historical and superseded. They do not approve
this replacement and must not influence scoring.

## Evidence to inspect

Inspect original files, not only contact sheets:

- every retained PNG and all 12 retained WebMs;
- both original-resolution 1440×900 typography boards;
- `font-assay.json`, `performance.json`, `runtime.json`, `journeys.json`, and the
  manifest;
- the mechanical old/new comparison only to verify the 65 byte-identical claims and
  identify all 17 changed plus two added files.

Typography must show honest computed `48/30/22/26px` scales, complete English/Polish/
German/numeric proofs, no clipping/overlap/boundary crossing, meaningful control versus
candidate comparison, and intentional light/dark composition. The font candidate is
an assay with production adoption prohibited and an explicit later Eric decision.

## Scoring lanes A and B

Independently rescore the selected system and each of the six complete references:
landing, authentication, authenticated home, search/filters, product/evidence, and
scanner.

| Category | Points |
|---|---:|
| Brand distinction and art direction | 15 |
| Hierarchy and typography | 15 |
| Evidence truth and trust | 12 |
| System coherence | 12 |
| Responsive/mobile/reflow | 12 |
| Accessibility/input behavior | 10 |
| State completeness/recovery | 8 |
| Motion/microinteractions | 6 |
| Imagery/icon/brand craft | 6 |
| Dark/high-contrast quality | 4 |

Passage requires overall and each reference at least 88/100, every category at least
75%, no unresolved truthfulness/accessibility/privacy/performance veto, no severe
generic-template concern, and no averaging away a veto.

Record separate reasoning, identity/hierarchy/content/motion/accessibility/performance
concerns, disagreements anticipated, vetoes, and required corrections. Scores are not
Eric approval.

## Visual-artifact QA lane C

This lane does not score taste. Inspect every retained original-resolution PNG for:

- clipping, overlap, truncation, or boundary crossing;
- unreadable microtype or blank/uniform regions;
- incorrect localization or stale state;
- obvious identity rendering defects.

Also verify the changed/unchanged hash comparison and report every defect by exact path.
