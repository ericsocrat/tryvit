# Correction cycle 1 — reviewed-packet hash comparison

This comparison is mechanically generated evidence, not a review score.

## Bindings

- prior reviewed packet source/tree: `67c0c3f9e23b4fe1197e7b9da900f3d71716bdf8` / `3f3865a8b21c4f79ad8e77dc7ef3c135005d5b5e`;
- prior canonical-LF manifest SHA-256: `b286061aecd0637f29da76b11dbdac72955bdac57c66efbdaf4afbd1a30518c5`;
- replacement source/tree: `14620a61c702838565eca2916b98af5cd4a572c1` / `de3a00e15099b5f1ca0b5ee521017f195a93b04c`;
- replacement manifest SHA-256: `164244174aa7a276389084ff3887b8b6de88d03c50dd9da784f540124eb8f2a1`.

The prior manifest has 82 listed files and 6,863,115 listed bytes. The replacement has 84 listed files and 6,960,774 listed bytes. Including each manifest, packet totals are 83 files / 7,084,033 bytes and 85 files / 7,188,422 bytes respectively.

## Byte result

- unchanged byte-for-byte: **62**;
- changed: **20**;
- added: **2**;
- removed: **0**.

The unchanged set by kind is 4 board, 1 journeys, 6 state-contact-sheet, 51 still. For every unchanged entry, path, byte count, and SHA-256 are equal in both manifests.

Canonical unchanged-set proof: ordinal path order, UTF-8 records encoded as `path<TAB>bytes<TAB>sha256<LF>`, 7,039 bytes, SHA-256 `2ca68f2929cd5f0d801531a707187384eeae85f2d63abe09a7eb95103aed13f7`.

Both complete manifests remain the authoritative per-file proof. Historical scorecards are superseded and are not reused.

## Changed and added files

| Path | Status | Old bytes | New bytes | Old SHA-256 | New SHA-256 |
|---|---|---:|---:|---|---|
| `boards/compact-favicon--1440x900--light.png` | changed | 46,394 | 46,325 | `afb6aa198ef15d46e6e6e4f2606a390fb17a3283dca730bf3c2506f4fca580c4` | `fe4ea84e3192ce22f5a066c8da46e6a46bd0c77de4d193eda6e8888aeab98593` |
| `boards/maskable--1440x900--light.png` | changed | 50,623 | 50,623 | `e017e8799c2d8b1a7c6658466066057219d90a539c7a3267a5cebaae5252f1c9` | `c63c55db9a5944271789a0e731d0e8394cdb50bac409fccbfc6eddb05023bb44` |
| `boards/typography--1440x900--dark.png` | added | — | 136,376 | — | `27b3efa4c2eb9a7eb4742dcf3a23bc1dd6685f24349034ab114155ca0e4dd7cf` |
| `boards/typography--1440x900--light.png` | changed | 94,205 | 134,115 | `022480819a3ec602cd23ce582cc97314afb1da24f82f4bd2da1b6627b72c0ef5` | `dd9e03a370bff5f3d3ddad4b6c39fcd1e3770576df7fd0a34eb62665c18555dd` |
| `font-assay.json` | added | — | 5,371 | — | `3f994c6f4d780d93696b67608e9aaadfd8cb8e67c5d69068744531537ca27591` |
| `motion/authentication--normal--390x844--light.webm` | changed | 244,200 | 258,411 | `7019b244f07c0a1327db76b7cac01b3cd3ea356afa8bbaebbe8d16606238aacf` | `093cfe68edce80423641ef91f2533d663362b5988136b213af95f025cf32a828` |
| `motion/authentication--reduced--390x844--light.webm` | changed | 217,756 | 218,046 | `d3e5e03f23760c9d93e58a252c41f01ee08b5132829d9b6f95d4cc5bd851eb90` | `1734eb6efe07ada36ab551ba00e267fb87a54b6c164b745baaf485a96b1535d5` |
| `motion/home--normal--390x844--light.webm` | changed | 205,140 | 203,021 | `0b04a105b91f8714aa738e9e2342f94b56541096cbbfaeaf67a21e7609cbcabc` | `c608a8e7638e9f71dc9a2bfd33efd192cc0450fb2d16624ae7ae6816a6b04d4e` |
| `motion/home--reduced--390x844--light.webm` | changed | 200,555 | 195,781 | `878d1d4ee6e396defe0bce65784276268dd0a8dacbfc0a37a1444ed7537c2932` | `85189b730dd22d862acf27e8f799d3aa567bd16fa2091845411e27afdcbc56be` |
| `motion/landing--normal--1440x900--light.webm` | changed | 276,162 | 255,873 | `4d68e1c01f628ae10754b86f00ca2137c06608c3707012fd28883062c7db39c9` | `1ea5b65071d3e0c86a67d05d03bfc2a81b2961586155fe972ddb81b3bbe01604` |
| `motion/landing--reduced--1440x900--light.webm` | changed | 301,618 | 232,748 | `d8075bc0715636b1a2dbbe30150eb1bf253b7b539fd5d50972aa25f4b507230f` | `3c228b66868ec63bbf929c875e14a5193a84b7e17a117b70f82021575bccd778` |
| `motion/product--normal--390x844--light.webm` | changed | 222,523 | 222,969 | `dbaff3ae619f530a5555ccb763f2891564f2eccb789705910b54d3987a2b3156` | `1278ecfacd54519da4e773cbc46746ae9d750da55d267885147d5129fe7eedde` |
| `motion/product--reduced--390x844--light.webm` | changed | 187,747 | 191,125 | `621dac3f50b37362d7ca85a8d6073bfcd8b765d1a1b2c8d73fa52cf3a91488bc` | `f5a612f39c3ca5ac89677ad2cc9a0a9a78d2681360115aaabcd6fe13bd86647d` |
| `motion/scanner--normal--390x844--dark.webm` | changed | 213,071 | 211,124 | `a315bd7bed5e64753cdd62c475209aba30541caa7394f84963d654ddfe2af9ef` | `3189748bf45227436ec49e8b22143ab5732a7d6530e89b6b99f20c9076dd18bd` |
| `motion/scanner--reduced--390x844--dark.webm` | changed | 190,376 | 192,413 | `d0d3d17d77026bf1f9c24c8f8c8439d1adcef65b47a095b37fde5933f25ead4b` | `e0e194fea78a7a8efcdf4cda63899810077eda7f46afd21e6758524d017886ff` |
| `motion/search--normal--390x844--light.webm` | changed | 206,161 | 206,233 | `d018a666fcc9aab7b027622adcfc0d3c474a82c3e43eb4aac148d98e1276bd0b` | `1f33fc76924ab8524f774675edd6e673a01b3fa76924ed14d8c0a77793a4da72` |
| `motion/search--reduced--390x844--light.webm` | changed | 154,465 | 156,479 | `915c39efd38c4d3d4a5eea83b2062be64e2205fda95b1748ffef5e655d8cadbc` | `907f1dfbdf9740696aeae01115a6c9dda9ce229a9508d8d5f6deea3d58365b48` |
| `performance.json` | changed | 114,277 | 114,221 | `575a0d40ce0060554c4fb1b8b50c5d2f8f28733459a6425557b982f0ab5025aa` | `435090b49fbb4acde8eae29be516a0bf184811347be99408cc49bfda9a566459` |
| `runtime.json` | changed | 475 | 475 | `28f3387376808bd19d5262e6fa54f4deb36abe605f3ea21ad7468b87dfae93f0` | `90f8ac1012588bff70b8c3ce6ed067350bf01db87975de722ec32a5f0629745e` |
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
