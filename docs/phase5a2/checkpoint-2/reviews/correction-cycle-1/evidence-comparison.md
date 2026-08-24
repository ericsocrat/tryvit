# Correction cycle 1 — reviewed-packet hash comparison

This comparison is mechanical evidence, not a review score.

## Bindings

- prior reviewed packet source/tree:
  `67c0c3f9e23b4fe1197e7b9da900f3d71716bdf8` /
  `3f3865a8b21c4f79ad8e77dc7ef3c135005d5b5e`;
- prior canonical-LF manifest SHA-256:
  `b286061aecd0637f29da76b11dbdac72955bdac57c66efbdaf4afbd1a30518c5`;
- replacement source/tree:
  `eaffa77e67d0bee5566966b9d17e021117e60058` /
  `7019042ee0326c183e707af6ab403460824045d0`;
- replacement manifest SHA-256:
  `e24b555304fb7319d426b892ea6c9bacb32e46d44bfea0bbf88f24a1ff44bc62`.

The prior manifest has 82 listed files and 6,863,115 listed bytes. The replacement has
84 listed files and 7,025,372 listed bytes. Including each manifest, packet totals are
83 files / 7,084,033 bytes and 85 files / 7,253,089 bytes respectively.

## Result

- unchanged byte-for-byte: **65**;
- changed: **17**;
- added: **2**;
- removed: **0**.

The unchanged set consists of 54 stills, six state contact sheets, four boards, and
`journeys.json`. For every unchanged entry, path, byte count, and SHA-256 are equal in
both manifests.

Canonical unchanged-set proof:

1. sort unchanged entries by path using ordinal order;
2. encode each as `path<TAB>bytes<TAB>sha256<LF>` in UTF-8;
3. concatenate all 65 records (7,399 bytes);
4. SHA-256:
   `12481227e60fead6aee11a80945f9107fbc41b9e44b3d481a025f7af2626cadc`.

Both complete manifests remain the authoritative per-file proof. The prior packet and
91/89 scorecards remain historical and superseded; they are not rewritten or reused.

## Changed and added files

| Path | Status | Old bytes | New bytes | Old SHA-256 | New SHA-256 |
|---|---|---:|---:|---|---|
| `boards/compact-favicon--1440x900--light.png` | changed | 46,394 | 46,325 | `afb6aa198ef15d46e6e6e4f2606a390fb17a3283dca730bf3c2506f4fca580c4` | `fe4ea84e3192ce22f5a066c8da46e6a46bd0c77de4d193eda6e8888aeab98593` |
| `boards/maskable--1440x900--light.png` | changed | 50,623 | 50,623 | `e017e8799c2d8b1a7c6658466066057219d90a539c7a3267a5cebaae5252f1c9` | `c63c55db9a5944271789a0e731d0e8394cdb50bac409fccbfc6eddb05023bb44` |
| `boards/typography--1440x900--dark.png` | added | — | 136,136 | — | `cee472feb1606e72713b8c5fdbc816e50e8a6dbeb9221dabc97c9058f3130edc` |
| `boards/typography--1440x900--light.png` | changed | 94,205 | 133,771 | `022480819a3ec602cd23ce582cc97314afb1da24f82f4bd2da1b6627b72c0ef5` | `185f8e3311aed069501f4b51c69bc2030ca901978e435b8b2993cbfc43743338` |
| `font-assay.json` | added | — | 5,371 | — | `6ddfc322d33f01376556df96b0f17492d15f294f9329b5ced2ae24d0ae163592` |
| `motion/authentication--normal--390x844--light.webm` | changed | 244,200 | 256,172 | `7019b244f07c0a1327db76b7cac01b3cd3ea356afa8bbaebbe8d16606238aacf` | `de4d70f64873c34b7025c7a27cb3c733b39f43669866da5543fed314d92e9a36` |
| `motion/authentication--reduced--390x844--light.webm` | changed | 217,756 | 219,922 | `d3e5e03f23760c9d93e58a252c41f01ee08b5132829d9b6f95d4cc5bd851eb90` | `0725caf7f5bd00d1191ce5e1797cd559fa77e0005139b3090964111dd07086ee` |
| `motion/home--normal--390x844--light.webm` | changed | 205,140 | 201,322 | `0b04a105b91f8714aa738e9e2342f94b56541096cbbfaeaf67a21e7609cbcabc` | `a848c4cff08a38334696d8848fa507e7d420102f90ca34a977b96cbf051e9fb8` |
| `motion/home--reduced--390x844--light.webm` | changed | 200,555 | 196,072 | `878d1d4ee6e396defe0bce65784276268dd0a8dacbfc0a37a1444ed7537c2932` | `2ae163c500b1d6561a0985329a7abc55d3c4c926da8f0ab51a1dfbcda9d718ea` |
| `motion/landing--normal--1440x900--light.webm` | changed | 276,162 | 258,360 | `4d68e1c01f628ae10754b86f00ca2137c06608c3707012fd28883062c7db39c9` | `c6a4401abe0374ae00a571df1353c2d1834c338a9b1274dcac90ea1ba63603ce` |
| `motion/landing--reduced--1440x900--light.webm` | changed | 301,618 | 301,978 | `d8075bc0715636b1a2dbbe30150eb1bf253b7b539fd5d50972aa25f4b507230f` | `de4ceba4562c11d2652a46248b578ee382b38bc8df6d62f47a03581ad2286e67` |
| `motion/product--normal--390x844--light.webm` | changed | 222,523 | 222,214 | `dbaff3ae619f530a5555ccb763f2891564f2eccb789705910b54d3987a2b3156` | `e93217536d8e06c4b5280037df264109327654a1b5bf7f6c783674fe70b00165` |
| `motion/product--reduced--390x844--light.webm` | changed | 187,747 | 179,061 | `621dac3f50b37362d7ca85a8d6073bfcd8b765d1a1b2c8d73fa52cf3a91488bc` | `f8cedc9484c35247699a670a63cc7f2b43c8f7dc5a8f25a8bdda0523182e634a` |
| `motion/scanner--normal--390x844--dark.webm` | changed | 213,071 | 209,720 | `a315bd7bed5e64753cdd62c475209aba30541caa7394f84963d654ddfe2af9ef` | `63445bd8c4cbb10d23d5c1106837f1e805b1df5b0ea8007a60398203a128a360` |
| `motion/scanner--reduced--390x844--dark.webm` | changed | 190,376 | 195,827 | `d0d3d17d77026bf1f9c24c8f8c8439d1adcef65b47a095b37fde5933f25ead4b` | `662ea3601b1641744fbc66b777adcb487de6adf733c91664c73dc567c9bde853` |
| `motion/search--normal--390x844--light.webm` | changed | 206,161 | 205,950 | `d018a666fcc9aab7b027622adcfc0d3c474a82c3e43eb4aac148d98e1276bd0b` | `337eda9df34ddae8fd461858b72b6defb57482601bc6efb158ee61fa2f1cddc5` |
| `motion/search--reduced--390x844--light.webm` | changed | 154,465 | 154,442 | `915c39efd38c4d3d4a5eea83b2062be64e2205fda95b1748ffef5e655d8cadbc` | `d20516a25ff7cde3138cea31614a8d3023e10c64866d07232177d7d009afb0d8` |
| `performance.json` | changed | 114,277 | 114,264 | `575a0d40ce0060554c4fb1b8b50c5d2f8f28733459a6425557b982f0ab5025aa` | `35e3ab7c1fb5af66ad6505bbcde0d0040dc36db49843be1545d4d5831d6d05f6` |
| `runtime.json` | changed | 475 | 475 | `28f3387376808bd19d5262e6fa54f4deb36abe605f3ea21ad7468b87dfae93f0` | `abfa46928aea219d6c386391eca9bde1cda630479b8c94649fa7fe0a50a21839` |

The manifest itself changes by construction and is excluded from the listed-file
comparison counts.
