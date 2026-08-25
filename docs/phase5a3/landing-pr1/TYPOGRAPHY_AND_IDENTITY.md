# Typography and identity disposition

## Typography

Manrope and restrained Source Serif 4 remained the approved preferred direction, and
their Phase 5A.2 provenance/license records were preserved. The local route-only trial
transferred 75,004 raw WOFF2 bytes (78,310 bytes as Lighthouse resources), covered the
EN/PL/DE corpus, and did not leak into the authenticated route.

Adoption nevertheless failed the production performance condition:

- preload plus `font-display: swap`: five-run mobile median LCP 2561.1 ms, including
  retained 3450.4 and 3006.7 ms outliers;
- `font-display: optional`: observed LCP 2556.4 ms;
- system-font candidate: stable five-run median LCP 2557.1 ms.

Because every tested delivery strategy missed 2500 ms, all candidate WOFF2 files,
route font declarations, and copied license files were removed from production. The
landing uses a deterministic system sans stack with restrained `ui-serif`/Georgia
moments. `evidence/rejected-font-performance.json` retains the rejected measurements.

## Identity

The Source Fold mark is implemented as original code-native geometry: an asymmetric
folded label, square registration aperture, and rust reverse face. The TryVit wordmark
is path-only and the five domain glyphs share the approved grammar. No third-party logo,
illustration, icon set, or generated bitmap was adopted.

This implementation choice is an originality record, not proof of trademark
availability. The public similarity screen found a potentially relevant registered
`TRYVITE` EUTM and could not complete all desired registry/image searches. Formal legal
review is unresolved, and Eric must explicitly decide whether to accept that adoption
risk before merge.
