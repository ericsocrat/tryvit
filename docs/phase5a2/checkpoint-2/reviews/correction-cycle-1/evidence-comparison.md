# Correction cycle 1 — reviewed-packet hash comparison

This comparison is mechanically generated evidence, not a review score.

## Bindings

- prior reviewed packet source/tree: `67c0c3f9e23b4fe1197e7b9da900f3d71716bdf8` / `3f3865a8b21c4f79ad8e77dc7ef3c135005d5b5e`;
- prior canonical-LF manifest SHA-256: `b286061aecd0637f29da76b11dbdac72955bdac57c66efbdaf4afbd1a30518c5`;
- replacement source/tree: `9fe14f14e00185cc1f1319d132e6853fa90e1723` / `5d8911cb326b0356e3a89a1a304dcea8c86b79bb`;
- replacement manifest SHA-256: `10662acdc566f445b6c30615c6c7ed87954c1ea689d48d3a5bab6fbe61d0cfd5`.

The prior manifest has 82 listed files and 6,863,115 listed bytes. The replacement has 90 listed files and 7,046,744 listed bytes. Including each manifest, packet totals are 83 files / 7,084,033 bytes and 91 files / 7,280,743 bytes respectively.

## Byte result

- unchanged byte-for-byte: **61**;
- changed: **21**;
- added: **8**;
- removed: **0**.

The unchanged set by kind is 3 board, 1 journeys, 6 state-contact-sheet, 51 still. For every unchanged entry, path, byte count, and SHA-256 are equal in both manifests.

Canonical unchanged-set proof: ordinal path order, UTF-8 records encoded as `path<TAB>bytes<TAB>sha256<LF>`, 6,931 bytes, SHA-256 `5303e1de223eb8535e1aa251ba1ad0c0cb1927ab5d14c4d0becb8a27f48bd197`.

Both complete manifests remain the authoritative per-file proof. The canonical prior manifest is retained beside this report as `prior-reviewed-manifest.json` so a reviewer can recompute every old-side claim without reading historical scorecards or implementation material. Historical scores are superseded and are not reused.

## Changed and added files

| Path | Status | Old bytes | New bytes | Old SHA-256 | New SHA-256 |
|---|---|---:|---:|---|---|
| `boards/compact-favicon--1440x900--light.png` | changed | 46,394 | 46,325 | `afb6aa198ef15d46e6e6e4f2606a390fb17a3283dca730bf3c2506f4fca580c4` | `fe4ea84e3192ce22f5a066c8da46e6a46bd0c77de4d193eda6e8888aeab98593` |
| `boards/identity--1440x900--light.png` | changed | 39,378 | 39,229 | `d1ef37e06fcee51fb3f5920e25e2df085b35674fa8e31e452f9de29838f28e2d` | `c1b036779f7d0a7f0687c98152102446dea8871b6f5f54e64ac75ea05f3fe000` |
| `boards/maskable--1440x900--light.png` | changed | 50,623 | 50,623 | `e017e8799c2d8b1a7c6658466066057219d90a539c7a3267a5cebaae5252f1c9` | `c63c55db9a5944271789a0e731d0e8394cdb50bac409fccbfc6eddb05023bb44` |
| `boards/typography--1440x900--dark.png` | added | — | 136,376 | — | `27b3efa4c2eb9a7eb4742dcf3a23bc1dd6685f24349034ab114155ca0e4dd7cf` |
| `boards/typography--1440x900--light.png` | changed | 94,205 | 134,115 | `022480819a3ec602cd23ce582cc97314afb1da24f82f4bd2da1b6627b72c0ef5` | `dd9e03a370bff5f3d3ddad4b6c39fcd1e3770576df7fd0a34eb62665c18555dd` |
| `font-assay.json` | added | — | 6,204 | — | `ee174dccdfe9ad903ebbd3104fed8fd1d4cb8079394786a5ed6675c177ca1e90` |
| `font-assay/licenses/MANROPE-OFL.txt` | added | — | 4,383 | — | `f612090fb72b6dca3e807e66fa0d2b5def163cef86f1a3209b5c897cba5ee4b7` |
| `font-assay/licenses/SOURCE-SERIF-4-OFL.md` | added | — | 4,491 | — | `c21d7293d87b6d7ab1d0229a2f55b77f33a7613a6a4e66f6693d68d7d8d09464` |
| `font-assay/manrope-regular.woff2` | added | — | 27,300 | — | `aa08da8e2396fd24c9cca149bcc1ffb6601b62c7dd771e1346406ed444493d59` |
| `font-assay/manrope-semibold.woff2` | added | — | 27,412 | — | `8ba9a04089cdc0fd8ba4e95da82d3ee0bacb82ebc7f9f3100f78a7bad76c35ad` |
| `font-assay/tryvit-assay-serif-regular.woff2` | added | — | 20,292 | — | `89c4a0f8be9a0386cb2f17db9625d65072581229f31d96ef45fc66378cd2e850` |
| `motion/authentication--normal--390x844--light.webm` | changed | 244,200 | 255,782 | `7019b244f07c0a1327db76b7cac01b3cd3ea356afa8bbaebbe8d16606238aacf` | `3a751b506d664a11eee2eb2c2b3d62dd3d6a3273438f17ce1d3f201200ea284c` |
| `motion/authentication--reduced--390x844--light.webm` | changed | 217,756 | 230,130 | `d3e5e03f23760c9d93e58a252c41f01ee08b5132829d9b6f95d4cc5bd851eb90` | `f47924868ba470320132f2465835144da4302d0fa293911034e38bd3cd9f50ed` |
| `motion/home--normal--390x844--light.webm` | changed | 205,140 | 202,509 | `0b04a105b91f8714aa738e9e2342f94b56541096cbbfaeaf67a21e7609cbcabc` | `0b04e28d2cf423051f5f9fe2ebf3dc1fcc5aefa328863db7a9c59a86c6a35f76` |
| `motion/home--reduced--390x844--light.webm` | changed | 200,555 | 197,379 | `878d1d4ee6e396defe0bce65784276268dd0a8dacbfc0a37a1444ed7537c2932` | `c09bb15e5eecf0f2cc09aa42a989185caf872dd43a6b15f90a79ae51e529a869` |
| `motion/landing--normal--1440x900--light.webm` | changed | 276,162 | 248,555 | `4d68e1c01f628ae10754b86f00ca2137c06608c3707012fd28883062c7db39c9` | `afe889d16f648ef327736be22917258fdc7396500fd0f788df22d65fa427a37f` |
| `motion/landing--reduced--1440x900--light.webm` | changed | 301,618 | 236,395 | `d8075bc0715636b1a2dbbe30150eb1bf253b7b539fd5d50972aa25f4b507230f` | `0b62a1dd8e1df0bc0ef92f7783baf68fc1e8bb1f8f4a8c61a38e15c042093623` |
| `motion/product--normal--390x844--light.webm` | changed | 222,523 | 219,459 | `dbaff3ae619f530a5555ccb763f2891564f2eccb789705910b54d3987a2b3156` | `d7e59f1951353659a3b690cb23eea3efde82fdbe42c03a9686789b1eb7fbf7fc` |
| `motion/product--reduced--390x844--light.webm` | changed | 187,747 | 186,849 | `621dac3f50b37362d7ca85a8d6073bfcd8b765d1a1b2c8d73fa52cf3a91488bc` | `5d0b88fb40da41f989de6f7b99e03be196fc13602ce443bb886195e8c9bc02db` |
| `motion/scanner--normal--390x844--dark.webm` | changed | 213,071 | 208,082 | `a315bd7bed5e64753cdd62c475209aba30541caa7394f84963d654ddfe2af9ef` | `5479c55d4f173ab10fe5706daa8696f9522e7e14ba958de63e6da7c7a0d47bbf` |
| `motion/scanner--reduced--390x844--dark.webm` | changed | 190,376 | 191,424 | `d0d3d17d77026bf1f9c24c8f8c8439d1adcef65b47a095b37fde5933f25ead4b` | `e0f7ee7fe5d859d6541a2a9d1c3d41e65795bb5677e0a2948eec388ddd84c4bc` |
| `motion/search--normal--390x844--light.webm` | changed | 206,161 | 208,923 | `d018a666fcc9aab7b027622adcfc0d3c474a82c3e43eb4aac148d98e1276bd0b` | `ef7fa9a3e4f055384e20f1fa9c3ba92dd3ca53517d6deb4fa9b5de97e687b10d` |
| `motion/search--reduced--390x844--light.webm` | changed | 154,465 | 156,479 | `915c39efd38c4d3d4a5eea83b2062be64e2205fda95b1748ffef5e655d8cadbc` | `ee78d0d3067c4af49ed48da505164434f21ff5dd048d4ef52f5051ada532fa40` |
| `performance.json` | changed | 114,277 | 114,220 | `575a0d40ce0060554c4fb1b8b50c5d2f8f28733459a6425557b982f0ab5025aa` | `d74dfd894276c2e356593ba4ba562160f225b28b129c776b0975ec201e9b72a6` |
| `resilience.json` | added | — | 3,666 | — | `6a6dd361b1a4aab432b95d59d191fcaa9f1483a6f337da1d042837b229ea4a43` |
| `runtime.json` | changed | 475 | 475 | `28f3387376808bd19d5262e6fa54f4deb36abe605f3ea21ad7468b87dfae93f0` | `2f5a4a8201af58abbb674f53ddfa74bed2d6abd2289b578ff56aa35486952903` |
| `stills/localized/landing--1440x900--dark--de.png` | changed | 96,543 | 88,853 | `bc49bdb8c12772a397201751ff12c69999ff1305325c09ff25df0d9bbce8a69f` | `dee13c58ea14ad397cfd90c1322290d2677e98e13b0d8d8c920c0232835097c6` |
| `stills/localized/product--1440x900--dark--de.png` | changed | 78,954 | 77,427 | `31bde417acff701ac3b1f8f308c69cfaa016ccac73be9abd37604c5255a7eae3` | `9fc2aeb46283e563fd798d17976eb76e8710600d6f7830d3e8a13c02a6bca49f` |
| `stills/localized/product--390x844--light--pl.png` | changed | 38,347 | 39,242 | `89b86ba229764f7f815568296f25ac8b5456590c1aefbb968b2a27d085c73b92` | `2ecdf72f2598571ca1d1a670ea4607d82974a301d5d9c362e1dd753b43ef4f4c` |

## Byte-identical files with corrected metadata

The rejected fresh-review packet was bound to source/tree `4d29d5007511a438e14e002b3a0df122007b8de5` / `d1875fccb9b9b0d4f45ff8191bf8cbcee21ce38f`, manifest `85309352e63b40d5e735d260c68d35668f0582ec0d0e10f8b10f85ece1ca7cf8`. These 10 raw terminal stills retain identical media bytes while their manifest metadata changes from captured start state to observed terminal reference/state/theme. Motion mode and locale remain source-bound.

| Path | Prior reference / state / theme | Replacement reference / state / theme |
|---|---|---|
| `motion-terminal/landing--normal--terminal.png` | landing / ready / light | landing / ready / dark |
| `motion-terminal/landing--reduced--terminal.png` | landing / ready / light | landing / ready / dark |
| `motion-terminal/authentication--normal--terminal.png` | authentication / sign-in / light | home / returning / light |
| `motion-terminal/authentication--reduced--terminal.png` | authentication / sign-in / light | home / returning / light |
| `motion-terminal/home--normal--terminal.png` | home / paused-partial / light | product / partial / light |
| `motion-terminal/home--reduced--terminal.png` | home / paused-partial / light | product / partial / light |
| `motion-terminal/search--normal--terminal.png` | search / no-query / light | search / filters-active / light |
| `motion-terminal/search--reduced--terminal.png` | search / no-query / light | search / filters-active / light |
| `motion-terminal/scanner--normal--terminal.png` | scanner / not-requested / dark | scanner / matched / dark |
| `motion-terminal/scanner--reduced--terminal.png` | scanner / not-requested / dark | scanner / matched / dark |

The manifest itself changes by construction and is excluded from the listed-file comparison counts.
