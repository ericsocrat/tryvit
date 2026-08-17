# Checkpoint 1 review instructions

> **Last updated:** 2026-08-17  
> **Status:** Executed for Checkpoint 1; reusable for a revision

## Independent reviewer protocol

1. Reviewers must not have implemented the candidates.
2. Use aliases A, B, and C until both scorecards are submitted.
3. Start with the seven files in `evidence/contact-sheets/`.
4. Review the six recordings and then the individual stills.
5. Do not inspect semantic filenames, source files, benchmark rationale, candidate names,
   or another reviewer's score before submission.
6. Record category scores, reasoning, generic-template concerns, usability concerns,
   disagreements, corrections, and any veto.
7. Submit before reading the primary-agent recommendation.

The full manifest reveals working names and source mappings. The rendered boards also
contain working names, so the completed reviews were blind to implementation rationale
and the other scorecard, but not fully blind to candidate naming. That limitation must
remain attached to the result.

## Required rubric

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
| **Total** | **100** |

A truthfulness, accessibility, privacy, performance, or severe-distinctiveness veto
cannot be averaged away. The final 88/100 Golden Reference exit threshold is not a
claim that Checkpoint 1 has completed Phase 5A.2; here the reviewers identify the
strongest credible path and required corrections.

## Evidence-reading order

- Identity: primary geometry and small/dark/monochrome/maskable studies.
- Landing: Polish compact first viewport.
- Home: long German desktop composition.
- Product: compact light overview and desktop dark evidence state.
- Scanner: compact dark matched state plus full scanner sequence.
- Motion: full-motion sequence and complete reduced-motion still.

The exact route, viewport, content locale, theme, motion, state, bytes, dimensions, and
hash for every file are in [evidence/manifest.json](evidence/manifest.json).

## Interaction checks

When the guarded local reference route is available, verify:

- keyboard access and visible focus;
- controlled Combobox and Tabs behavior;
- scanner recognition, processing, cancellation, result, retry, no-match, manual entry,
  and recovery;
- reflow at the documented widths and 200% zoom;
- text-spacing resilience;
- forced-color meaning;
- OS and query-driven reduced motion;
- repeated motion input and focus continuity.

The route is guarded and non-production. Do not infer real camera, service, production
data, native Safari, native Windows High Contrast, screen-reader, touch-hardware, or
native-language approval from this browser evidence.

## Eric review

After both independent reviews are frozen, Eric receives the candidate-name mapping,
manifest, [candidate packages](CANDIDATE_PACKAGES.md), validation limits, raw scorecards,
and synthesis. Eric may select, conditionally select, specify a hybrid precisely,
request revision, or reject all candidates.
