# Correction cycle 1 — reviewed-packet hash comparison

This comparison is mechanical evidence, not a review score.

## Bindings

- prior reviewed packet source/tree:
  `67c0c3f9e23b4fe1197e7b9da900f3d71716bdf8` /
  `3f3865a8b21c4f79ad8e77dc7ef3c135005d5b5e`;
- prior canonical-LF manifest SHA-256:
  `b286061aecd0637f29da76b11dbdac72955bdac57c66efbdaf4afbd1a30518c5`;
- replacement source/tree:
  `4d29d5007511a438e14e002b3a0df122007b8de5` /
  `d1875fccb9b9b0d4f45ff8191bf8cbcee21ce38f`;
- replacement manifest SHA-256:
  `85309352e63b40d5e735d260c68d35668f0582ec0d0e10f8b10f85ece1ca7cf8`.

The prior manifest has 82 listed files and 6,863,115 listed bytes. The replacement has
84 listed files and 6,969,839 listed bytes. Including each manifest, packet totals are
83 files / 7,084,033 bytes and 85 files / 7,197,539 bytes respectively.

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
| `boards/typography--1440x900--dark.png` | added | — | 136,376 | — | `27b3efa4c2eb9a7eb4742dcf3a23bc1dd6685f24349034ab114155ca0e4dd7cf` |
| `boards/typography--1440x900--light.png` | changed | 94,205 | 134,115 | `022480819a3ec602cd23ce582cc97314afb1da24f82f4bd2da1b6627b72c0ef5` | `dd9e03a370bff5f3d3ddad4b6c39fcd1e3770576df7fd0a34eb62665c18555dd` |
| `font-assay.json` | added | — | 5,371 | — | `2c6df89fc3ea94212004df40ae4701b4cee7e70d10acc63ca8de6186e7cbac34` |
| `motion/authentication--normal--390x844--light.webm` | changed | 244,200 | 257,809 | `7019b244f07c0a1327db76b7cac01b3cd3ea356afa8bbaebbe8d16606238aacf` | `6ea63a4f5aa8623429844b6753bf5f287cac7c0eca87af63c41deb4e245c6f55` |
| `motion/authentication--reduced--390x844--light.webm` | changed | 217,756 | 216,132 | `d3e5e03f23760c9d93e58a252c41f01ee08b5132829d9b6f95d4cc5bd851eb90` | `e644e0a831f61cdd7d9929ed1caa3fc99056f68a748a960db6ea9a3abfb2ae3d` |
| `motion/home--normal--390x844--light.webm` | changed | 205,140 | 204,877 | `0b04a105b91f8714aa738e9e2342f94b56541096cbbfaeaf67a21e7609cbcabc` | `de1050219b5ad7cc667dd0c41b7117f63c60ab6d7d57740b662886b82e33f049` |
| `motion/home--reduced--390x844--light.webm` | changed | 200,555 | 198,049 | `878d1d4ee6e396defe0bce65784276268dd0a8dacbfc0a37a1444ed7537c2932` | `302465556be52b97f75b8b09cd3043f73c5e18584a352056e80b1a3b7fffeb96` |
| `motion/landing--normal--1440x900--light.webm` | changed | 276,162 | 264,024 | `4d68e1c01f628ae10754b86f00ca2137c06608c3707012fd28883062c7db39c9` | `0ce9359f50ce7c5292f74700cda80711f3285b63d232b703de6c82b56fa97b8e` |
| `motion/landing--reduced--1440x900--light.webm` | changed | 301,618 | 234,470 | `d8075bc0715636b1a2dbbe30150eb1bf253b7b539fd5d50972aa25f4b507230f` | `5b2933f76dc5e21151d0a4c7e0a85acafc481caee7285b93ea2e35b8c1648a4a` |
| `motion/product--normal--390x844--light.webm` | changed | 222,523 | 224,249 | `dbaff3ae619f530a5555ccb763f2891564f2eccb789705910b54d3987a2b3156` | `b251b814bdeb1f95716ba28c75175dad157660aac2c3b2a60746ee81ef845b6c` |
| `motion/product--reduced--390x844--light.webm` | changed | 187,747 | 179,455 | `621dac3f50b37362d7ca85a8d6073bfcd8b765d1a1b2c8d73fa52cf3a91488bc` | `d0194fe0eef33e520f7e16404998bcee283c52de16ad8b3423d206d405d44b48` |
| `motion/scanner--normal--390x844--dark.webm` | changed | 213,071 | 203,623 | `a315bd7bed5e64753cdd62c475209aba30541caa7394f84963d654ddfe2af9ef` | `1bca3c2a136aeb9d0d443178f2f5d641f685f41378365d11dab0f402c05206a6` |
| `motion/scanner--reduced--390x844--dark.webm` | changed | 190,376 | 193,075 | `d0d3d17d77026bf1f9c24c8f8c8439d1adcef65b47a095b37fde5933f25ead4b` | `57c8180ffc68de382b1d7196512466604bc6dae5119b691ff877a96af13e6370` |
| `motion/search--normal--390x844--light.webm` | changed | 206,161 | 208,986 | `d018a666fcc9aab7b027622adcfc0d3c474a82c3e43eb4aac148d98e1276bd0b` | `4d8e06e67cd3525eedc71a53da1cf73fa394bbfc2e8ce06c26ca68e7d57de98e` |
| `motion/search--reduced--390x844--light.webm` | changed | 154,465 | 160,191 | `915c39efd38c4d3d4a5eea83b2062be64e2205fda95b1748ffef5e655d8cadbc` | `3816139f6f3ec8d66548563a4c8fefa03ce2268b9a81a3333e392ecee21319aa` |
| `performance.json` | changed | 114,277 | 114,247 | `575a0d40ce0060554c4fb1b8b50c5d2f8f28733459a6425557b982f0ab5025aa` | `d2e62cb8de21eff6c49d7611573883281f2f51fc6a8cbf6b398e6d641834e6f5` |
| `runtime.json` | changed | 475 | 475 | `28f3387376808bd19d5262e6fa54f4deb36abe605f3ea21ad7468b87dfae93f0` | `3a533320dfb8c091c690e07f75efbd85ae1f572aad26a2cc75dc96bf76e378f7` |

The manifest itself changes by construction and is excluded from the listed-file
comparison counts.
