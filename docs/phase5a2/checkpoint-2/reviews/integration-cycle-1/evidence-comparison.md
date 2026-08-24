# Integration cycle 1 — corrected-packet hash comparison

This is mechanically reproduced evidence, not a review score.

## Exact bindings

- prior corrected packet source/tree: `fcc5d8cb9eae609863364a6a34541ce10eefcbc6` / `00c47531aa41a7de94dff9f18c1018d551405943`;
- prior manifest SHA-256: `ac4102d46fc1bd59099bbaa6e08bff70bab11a3d4c4d39dd0ca874c199773fca`;
- integrated packet source/tree: `c5edd0f6e43ff86646617a026ffbd0db3e579ad1` / `3c56ce832a0d2c9ddea6d16006150400656f2b76`;
- integrated manifest SHA-256: `4ff5884a147bacb290a260fc64edc5f05821503641c8ff60aabacb841248f085`.

Both packets contain 90 manifest-listed files plus the manifest. The prior packet has
7,072,426 listed bytes and 7,315,420 total bytes. The integrated packet has 7,145,231
listed bytes and 7,388,236 total bytes. The new manifest is 243,005 bytes.

## Byte result

- unchanged byte-for-byte: **74**;
- changed: **16**;
- added: **0**;
- removed: **0**.

The unchanged set is eight boards, three font files, two licenses, one journey report,
six state contact sheets, and 54 stills. It includes every retained PNG, all WOFF2/OFL
bytes, and `journeys.json`. Canonical unchanged-set proof uses ordinal path order and
UTF-8 `path<TAB>bytes<TAB>sha256<LF>` records: 8,385 bytes, SHA-256
`f6c5c446d69fce6b7362b5ab43f78e99af61668f0ce21f9da9f0f90edf509e4b`.

## Changed files and reasons

| Path | Old bytes | New bytes | Old SHA-256 | New SHA-256 | Reason |
|---|---:|---:|---|---|---|
| `font-assay.json` | 6,204 | 6,204 | `1060ffc216438a78eb403f27dc11218a162601a7a1f43956f378d4685e122a74` | `b0eb14ecf21e4a2cb01ac813fee2aa7e6e9b7194e01922d42104916f33783f84` | Exact integrated source/tree binding only; the assay result and retained font bytes are unchanged. |
| `motion/authentication--normal--390x844--light.webm` | 249,104 | 259,334 | `5d992100e09628cf4ddf6cc138639632e8b49dbe1d0bad55cdfba19b6fad983d` | `01e5ef05fb021d9f68224dac6182788d7f11e5a116500e2e4de871b37625798a` | Complete exact-source recapture after dependency integration. |
| `motion/authentication--reduced--390x844--light.webm` | 215,747 | 220,539 | `de00b1a67451d39a28a0e95477c4096b4920123fb4c231481669b76c7a91dc8f` | `b5c7b6bee76c86da1458d03102d19a64d38f86ad289a040c37430630c98b04b3` | Complete exact-source recapture after dependency integration. |
| `motion/home--normal--390x844--light.webm` | 212,428 | 203,610 | `c36dab3152ce395e8fbe4166015eeb9345450486048e2e4dc582d50461c8993e` | `10115da7d1c1866a1390c17e4499822e7b8d25c4b4f5bfd98d1091c502e0112b` | Complete exact-source recapture after dependency integration. |
| `motion/home--reduced--390x844--light.webm` | 195,490 | 195,781 | `e2b8bcbfcc543b0d5bed498b2e138b792ff49c862e74b81aadaf3f2d75673fb5` | `bd4e7cd0b5a2f9eb6a2f136b71d08bc08a222a56e3cbf64d2363921fea8dc7b0` | Complete exact-source recapture after dependency integration. |
| `motion/landing--normal--1440x900--light.webm` | 260,244 | 267,639 | `b261d7d79c376becb46f3c721cc78c776bf2fcd6e5f844710b20580197f54a20` | `64ce3d7ba847ea2592bc94891ec5e6ab29aa6e1335e09faf30f9d8b1da223d1d` | Complete exact-source recapture after dependency integration. |
| `motion/landing--reduced--1440x900--light.webm` | 252,729 | 297,482 | `5dfa649179176f5118070c63df226492dc4aaa30ad5608dd42b816fdd8f6cf05` | `7bd26b4175a82acc02d728d0260b8f03e4bfcfd2185bc610c598a88b5f8003a7` | Complete exact-source recapture after dependency integration. |
| `motion/product--normal--390x844--light.webm` | 220,508 | 219,332 | `94c4efbcb6cd6d44613e8e9b043fe035d0fe9bc6f2081b9384512229b0664806` | `bdc8a13447bd595c1b9c84e519de975a0a0c045bc138e35ebc738d8b3a60ef4e` | Complete exact-source recapture after dependency integration. |
| `motion/product--reduced--390x844--light.webm` | 187,198 | 191,125 | `0ec4a681a58711d2c537d1cebf7bb1f3248e15f05f696e55b46f5682d9378548` | `dc62d04802fb901a8b331429ebad7970aef1b8ee9d9fd72cba1f55db2db88d28` | Complete exact-source recapture after dependency integration. |
| `motion/scanner--normal--390x844--dark.webm` | 210,650 | 210,874 | `0af1f20603f142fd1dc320cdd393397846cbc28b3876362ec7497fa8ee20906e` | `6cb114d471128134fe722408b5cc8c3c094d135ccba575e341cd400054c8e84b` | Complete exact-source recapture after dependency integration. |
| `motion/scanner--reduced--390x844--dark.webm` | 192,413 | 193,075 | `7780339926d975d1e1d735681e9e1d22d30cd08bba2384ef28e8083cb17da19d` | `c40aad5eb12d8d6282414ad9240b9e9c8aa68b83a5375b85df77cea22fd6ff28` | Complete exact-source recapture after dependency integration. |
| `motion/search--normal--390x844--light.webm` | 208,876 | 213,664 | `95f8f162c2c2aa331c021292efa80c3e96cc8f7b4171b98493c6c54c7e0dc852` | `09d7ddb16118ffa1f19833858095530679c961a7874b7baf82d4a073199a80ea` | Complete exact-source recapture after dependency integration. |
| `motion/search--reduced--390x844--light.webm` | 154,465 | 160,191 | `801c3c073dac295b7645883b69990273942befe69f3a3cd4c5d00464d9a9bcc4` | `a720fa209a33a4cd46e62009d8ddbbfa6d38088b455f6be3b3bcc0f3a4d59101` | Complete exact-source recapture after dependency integration. |
| `performance.json` | 114,215 | 114,226 | `128a23e1b10e6be25645acce7c39966bcd2666c13113550ea96fc7e885206b2c` | `effa2a0b0e97f018d673dd37f5aee32a97811a01e8d570954176077d5ba9d082` | Thirty new exact-source lab samples and new source/tree binding. |
| `resilience.json` | 12,058 | 12,058 | `8f308e5a17d13f3eb97841888a0f98f501158e7adfdd9ac6ad36a15085f56a8a` | `86c7bd9edfc41d16db4a4f94287982df16915b5b8cfc0aeeafcb98d792e73a75` | Exact integrated source/tree binding only; all retained measurements are unchanged. |
| `runtime.json` | 475 | 475 | `13ba4d23c937de0edfd43842e0b9fdde8ed7bf623f37475bd97fda052aff7245` | `eea857a245cfca031967b1d2f816f63bb1ebef3f2fa6993e37b114bed6954519` | Exact integrated source/tree binding only; Node, Playwright, Chromium and platform values are unchanged. |

## Runtime, dependency and performance identity

The retained runtime remains Windows x64, Node `v24.11.1`, Playwright `1.62.1`, and
Chromium `151.0.7922.34`. The dependency integration changes the exact Git blobs for
`frontend/package.json` / `frontend/package-lock.json` from
`891893600985d06dd05f3072e92e0fe88bafa78e` / `d384bda47c417ed1e74d9492b756a2c37d8fc2d3`
to `1e515ec68bbffe59624eb9422a1b8955adda692d` /
`a535e18b89ec0dc6a1282823d8b117b46a2f9013`. The intended updates are user-event
14.6.5, Vite React 6.1.0, Vitest/coverage 4.1.11, resolvers 5.9.1, lucide-react 1.33.0,
and web-vitals 6.1.1.

Both packets contain 30 valid attempts, zero failures, zero TBT/CLS/long tasks, and
zero Golden-route font/image bytes. JS gzip changes from 203,097 to 203,096 bytes;
CSS remains 47,919 bytes. New LCP medians are 108/96/92/96/100/96 ms for landing,
authentication, home, search, product and scanner. The 75,004-byte font assay and all
three WOFF2 hashes remain unchanged. Production `/app` debt is not altered or solved.

The manifest itself changes by construction and is excluded from the 90-file comparison.
