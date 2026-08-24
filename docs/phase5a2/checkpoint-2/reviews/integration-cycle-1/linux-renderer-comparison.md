# Linux-renderer correction — packet comparison

This is mechanical comparison evidence, not a review score.

- prior reviewed source/tree: `7e44b4b4dad5cb940f9b4f3cb7f7579aa4f1cf59` / `174cd4986085bb71946a1ed094b8093d996bd432`;
- prior manifest: `ef97f4fb04a0a283d90392639d7d90ca13e7e189da2e68aab0cbb336cb24d5d7`;
- renderer-corrected source/tree: `303b7bc156490ddf207df668d2d70ea5e0661cd3` / `19140d9fecff098c9deccf851e1348aff8241e01`;
- renderer-corrected manifest: `bf05a824e4b4e6d6cd68c8a0b9c525cbc4b1674eebe3cfd9faa220ae306e8364`.

Both packets contain 90 listed files. The corrected packet contains 7,150,882 listed
bytes and 7,397,136 bytes including its 246,254-byte manifest.

## Byte result

- unchanged: **72**;
- changed: **18**;
- added/removed: **0 / 0**.

The unchanged set is six boards, all 54 retained stills, six contact sheets,
`journeys.json`, three WOFF2 files, and two OFL files. Canonical ordinal-path proof:
8,164 bytes, SHA-256
`00cfa9cc3732add05fb48d9d9f2f3c9ffcacb85a265949637cb41e6fcb9577ab`.

## Changed paths and reasons

- `boards/typography--1440x900--{light,dark}.png` (2): regenerated after content-
  expanding reserved specimen boxes and compact governed-board chrome made the
  1440×900 composition portable across Windows and Ubuntu without hiding overflow.
- all 12 `motion/*.webm`: complete exact-source re-encodes; journey content,
  intermediate announcements, 1,000 ms semantic dwell, and terminal states are
  unchanged, while container bytes change by construction.
- `font-assay.json`: new exact source/tree plus explicit 147/67/81/60px cross-platform
  fallback layout reserves; transferred font bytes, hashes, type sizes, coverage,
  tabular width, CLS, and geometry delta remain unchanged/passing.
- `resilience.json` and `runtime.json`: exact source/tree rebinding only; retained
  resilience values and runtime identity are unchanged.
- `performance.json`: 30 new exact-source samples; all valid with zero TBT/CLS/long
  tasks/font/image bytes.

These groups account for every changed path. Complete per-file byte counts and hashes
are retained in the two manifests.
