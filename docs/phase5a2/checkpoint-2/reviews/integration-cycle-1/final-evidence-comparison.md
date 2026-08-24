# Integration cycle 1 — final corrected-packet comparison

This mechanically reproduced comparison is not a review score.

## Bindings

- prior local corrected packet: source/tree `fcc5d8cb9eae609863364a6a34541ce10eefcbc6` / `00c47531aa41a7de94dff9f18c1018d551405943`, manifest `ac4102d46fc1bd59099bbaa6e08bff70bab11a3d4c4d39dd0ca874c199773fca`;
- initial integrated review packet: source/tree `c5edd0f6e43ff86646617a026ffbd0db3e579ad1` / `3c56ce832a0d2c9ddea6d16006150400656f2b76`, manifest `4ff5884a147bacb290a260fc64edc5f05821503641c8ff60aabacb841248f085`;
- final renderer-corrected packet: source/tree `303b7bc156490ddf207df668d2d70ea5e0661cd3` / `19140d9fecff098c9deccf851e1348aff8241e01`, manifest `bf05a824e4b4e6d6cd68c8a0b9c525cbc4b1674eebe3cfd9faa220ae306e8364`.

All three packets contain 90 listed files plus the manifest. The final packet contains
7,150,882 listed bytes and 7,397,136 total bytes; its manifest is 246,254 bytes.

## Byte result

Against either the prior corrected packet or the initial integrated review packet:

- unchanged byte-for-byte: **11**;
- changed: **79**;
- added: **0**;
- removed: **0**.

The unchanged set is the six non-typography identity/glyph boards, all three WOFF2 font
files, and both OFL license files. Canonical ordinal-path proof uses UTF-8
`path<TAB>bytes<TAB>sha256<LF>` records: 1,202 bytes, SHA-256
`beec7caeb8a70bb98cbe36005e2fa1342e8d30bb2f6f16cfc7b7f7b78c962c06`.

The complete old and new manifests are the per-file byte/hash proof. The old manifests
are independently available at commits `c5edd0f6e43ff86646617a026ffbd0db3e579ad1`
and `34ebb578369869136f445d5198d4bfc6abe9584d`; the final manifest is retained in
`evidence/manifest.json`.

## Every changed path and reason

- `contact-sheets/{authentication,home,landing,product,scanner,search}--states.png`
  (6 files): regenerated from the complete corrected 59-state matrix.
- `stills/core/{landing,authentication,home,search,product,scanner}--{390x844,768x1024,1440x900}--{light,dark}.png`
  (36 files): full exact-source recapture after owner-lockup, score hierarchy, and
  zero-scroll capture corrections.
- `stills/localized/{landing,authentication,home,search,product,scanner}--390x844--light--pl.png`
  and matching `1440x900--dark--de.png` paths (12 files): full PL/DE recapture after
  fixture-name and owner-label consistency corrections.
- `stills/forced-colors/{landing,authentication,home,search,product,scanner}--*.png`
  (6 files): regenerated forced-color states after the same semantic/layout changes.
- `motion/{landing,authentication,home,search,product,scanner}--{normal,reduced}--*.webm`
  (12 files): complete exact-source recapture; Authentication/Search/Scanner now retain
  1,000 ms semantic async dwell in both modes and record intermediate live messages.
- `journeys.json`: new source binding plus retained intermediate semantic-announcement
  evidence for both modes of the three async journeys.
- `resilience.json`: new source binding plus six live-surface owner/mark/glyph semantic
  records with zero invalid marks/glyphs, zero product-record master marks, and zero
  mobile owner boundary violations.
- `font-assay.json` and `runtime.json`: exact final source/tree rebinding only; runtime,
  font bytes, computed sizes, hashes, licenses, coverage, and fallback results remain
  unchanged.
- `performance.json`: 30 new exact-source samples after the final source correction.

The two typography boards are additionally changed for cross-renderer layout reserves;
these groups account for all 79 changed paths exactly.

## Runtime, font, and performance result

Runtime remains Windows x64, Node `v24.11.1`, Playwright `1.62.1`, and Chromium
`151.0.7922.34`. The guarded assay remains 75,004 bytes (27,300 + 27,412 + 20,292),
below the 102,400-byte limit, with zero fallback CLS/geometry delta and computed
control/candidate sizes `48/30/22/26`.

The final 30 performance attempts are valid with zero failures, TBT, CLS, long tasks,
font bytes, or image bytes. All six routes report 204,115 B JS gzip and 48,084 B CSS
gzip. LCP medians are 96/100/116/96/112/108 ms for landing/authentication/home/search/
product/scanner. These remain guarded local lab results; production `/app` debt is
unchanged and production migration remains prohibited.
