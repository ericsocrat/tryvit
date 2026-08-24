# Correction cycle 1 — reviewed-packet hash comparison

This comparison is mechanically generated evidence, not a review score.

## Bindings

- prior reviewed packet source/tree: `67c0c3f9e23b4fe1197e7b9da900f3d71716bdf8` / `3f3865a8b21c4f79ad8e77dc7ef3c135005d5b5e`;
- prior canonical-LF manifest SHA-256: `b286061aecd0637f29da76b11dbdac72955bdac57c66efbdaf4afbd1a30518c5`;
- replacement source/tree: `fcc5d8cb9eae609863364a6a34541ce10eefcbc6` / `00c47531aa41a7de94dff9f18c1018d551405943`;
- replacement manifest SHA-256: `ac4102d46fc1bd59099bbaa6e08bff70bab11a3d4c4d39dd0ca874c199773fca`.

The prior manifest has 82 listed files and 6,863,115 listed bytes. The replacement has 90 listed files and 7,072,426 listed bytes. Including each manifest, packet totals are 83 files / 7,084,033 bytes and 91 files / 7,315,420 bytes respectively.

## Byte result

- unchanged byte-for-byte: **59**;
- changed: **23**;
- added: **8**;
- removed: **0**.

The unchanged set by kind is 3 board, 1 journeys, 6 state-contact-sheet, 49 still. For every unchanged entry, path, byte count, and SHA-256 are equal in both manifests.

Canonical unchanged-set proof: ordinal path order, UTF-8 records encoded as `path<TAB>bytes<TAB>sha256<LF>`, 6,709 bytes, SHA-256 `2b9faee5277e62bca3e28ebe3393643b45502d2d76a6b828f28b9f43d540e669`.

Both complete manifests remain the authoritative per-file proof. The canonical prior manifest is retained beside this report as `prior-reviewed-manifest.json` so a reviewer can recompute every old-side claim without reading historical scorecards or implementation material. Historical scores are superseded and are not reused.

## Changed and added files

| Path | Status | Old bytes | New bytes | Old SHA-256 | New SHA-256 |
|---|---|---:|---:|---|---|
| `boards/compact-favicon--1440x900--light.png` | changed | 46,394 | 46,325 | `afb6aa198ef15d46e6e6e4f2606a390fb17a3283dca730bf3c2506f4fca580c4` | `fe4ea84e3192ce22f5a066c8da46e6a46bd0c77de4d193eda6e8888aeab98593` |
| `boards/identity--1440x900--light.png` | changed | 39,378 | 39,229 | `d1ef37e06fcee51fb3f5920e25e2df085b35674fa8e31e452f9de29838f28e2d` | `c1b036779f7d0a7f0687c98152102446dea8871b6f5f54e64ac75ea05f3fe000` |
| `boards/maskable--1440x900--light.png` | changed | 50,623 | 50,623 | `e017e8799c2d8b1a7c6658466066057219d90a539c7a3267a5cebaae5252f1c9` | `c63c55db9a5944271789a0e731d0e8394cdb50bac409fccbfc6eddb05023bb44` |
| `boards/typography--1440x900--dark.png` | added | — | 136,376 | — | `27b3efa4c2eb9a7eb4742dcf3a23bc1dd6685f24349034ab114155ca0e4dd7cf` |
| `boards/typography--1440x900--light.png` | changed | 94,205 | 134,115 | `022480819a3ec602cd23ce582cc97314afb1da24f82f4bd2da1b6627b72c0ef5` | `dd9e03a370bff5f3d3ddad4b6c39fcd1e3770576df7fd0a34eb62665c18555dd` |
| `font-assay.json` | added | — | 6,204 | — | `1060ffc216438a78eb403f27dc11218a162601a7a1f43956f378d4685e122a74` |
| `font-assay/licenses/MANROPE-OFL.txt` | added | — | 4,383 | — | `f612090fb72b6dca3e807e66fa0d2b5def163cef86f1a3209b5c897cba5ee4b7` |
| `font-assay/licenses/SOURCE-SERIF-4-OFL.md` | added | — | 4,491 | — | `c21d7293d87b6d7ab1d0229a2f55b77f33a7613a6a4e66f6693d68d7d8d09464` |
| `font-assay/manrope-regular.woff2` | added | — | 27,300 | — | `aa08da8e2396fd24c9cca149bcc1ffb6601b62c7dd771e1346406ed444493d59` |
| `font-assay/manrope-semibold.woff2` | added | — | 27,412 | — | `8ba9a04089cdc0fd8ba4e95da82d3ee0bacb82ebc7f9f3100f78a7bad76c35ad` |
| `font-assay/tryvit-assay-serif-regular.woff2` | added | — | 20,292 | — | `89c4a0f8be9a0386cb2f17db9625d65072581229f31d96ef45fc66378cd2e850` |
| `motion/authentication--normal--390x844--light.webm` | changed | 244,200 | 249,104 | `7019b244f07c0a1327db76b7cac01b3cd3ea356afa8bbaebbe8d16606238aacf` | `5d992100e09628cf4ddf6cc138639632e8b49dbe1d0bad55cdfba19b6fad983d` |
| `motion/authentication--reduced--390x844--light.webm` | changed | 217,756 | 215,747 | `d3e5e03f23760c9d93e58a252c41f01ee08b5132829d9b6f95d4cc5bd851eb90` | `de00b1a67451d39a28a0e95477c4096b4920123fb4c231481669b76c7a91dc8f` |
| `motion/home--normal--390x844--light.webm` | changed | 205,140 | 212,428 | `0b04a105b91f8714aa738e9e2342f94b56541096cbbfaeaf67a21e7609cbcabc` | `c36dab3152ce395e8fbe4166015eeb9345450486048e2e4dc582d50461c8993e` |
| `motion/home--reduced--390x844--light.webm` | changed | 200,555 | 195,490 | `878d1d4ee6e396defe0bce65784276268dd0a8dacbfc0a37a1444ed7537c2932` | `e2b8bcbfcc543b0d5bed498b2e138b792ff49c862e74b81aadaf3f2d75673fb5` |
| `motion/landing--normal--1440x900--light.webm` | changed | 276,162 | 260,244 | `4d68e1c01f628ae10754b86f00ca2137c06608c3707012fd28883062c7db39c9` | `b261d7d79c376becb46f3c721cc78c776bf2fcd6e5f844710b20580197f54a20` |
| `motion/landing--reduced--1440x900--light.webm` | changed | 301,618 | 252,729 | `d8075bc0715636b1a2dbbe30150eb1bf253b7b539fd5d50972aa25f4b507230f` | `5dfa649179176f5118070c63df226492dc4aaa30ad5608dd42b816fdd8f6cf05` |
| `motion/product--normal--390x844--light.webm` | changed | 222,523 | 220,508 | `dbaff3ae619f530a5555ccb763f2891564f2eccb789705910b54d3987a2b3156` | `94c4efbcb6cd6d44613e8e9b043fe035d0fe9bc6f2081b9384512229b0664806` |
| `motion/product--reduced--390x844--light.webm` | changed | 187,747 | 187,198 | `621dac3f50b37362d7ca85a8d6073bfcd8b765d1a1b2c8d73fa52cf3a91488bc` | `0ec4a681a58711d2c537d1cebf7bb1f3248e15f05f696e55b46f5682d9378548` |
| `motion/scanner--normal--390x844--dark.webm` | changed | 213,071 | 210,650 | `a315bd7bed5e64753cdd62c475209aba30541caa7394f84963d654ddfe2af9ef` | `0af1f20603f142fd1dc320cdd393397846cbc28b3876362ec7497fa8ee20906e` |
| `motion/scanner--reduced--390x844--dark.webm` | changed | 190,376 | 192,413 | `d0d3d17d77026bf1f9c24c8f8c8439d1adcef65b47a095b37fde5933f25ead4b` | `7780339926d975d1e1d735681e9e1d22d30cd08bba2384ef28e8083cb17da19d` |
| `motion/search--normal--390x844--light.webm` | changed | 206,161 | 208,876 | `d018a666fcc9aab7b027622adcfc0d3c474a82c3e43eb4aac148d98e1276bd0b` | `95f8f162c2c2aa331c021292efa80c3e96cc8f7b4171b98493c6c54c7e0dc852` |
| `motion/search--reduced--390x844--light.webm` | changed | 154,465 | 154,465 | `915c39efd38c4d3d4a5eea83b2062be64e2205fda95b1748ffef5e655d8cadbc` | `801c3c073dac295b7645883b69990273942befe69f3a3cd4c5d00464d9a9bcc4` |
| `performance.json` | changed | 114,277 | 114,215 | `575a0d40ce0060554c4fb1b8b50c5d2f8f28733459a6425557b982f0ab5025aa` | `128a23e1b10e6be25645acce7c39966bcd2666c13113550ea96fc7e885206b2c` |
| `resilience.json` | added | — | 12,058 | — | `8f308e5a17d13f3eb97841888a0f98f501158e7adfdd9ac6ad36a15085f56a8a` |
| `runtime.json` | changed | 475 | 475 | `28f3387376808bd19d5262e6fa54f4deb36abe605f3ea21ad7468b87dfae93f0` | `13ba4d23c937de0edfd43842e0b9fdde8ed7bf623f37475bd97fda052aff7245` |
| `stills/core/landing--1440x900--dark.png` | changed | 91,332 | 91,106 | `971dbaf9f5ff6cf976685ad227cd84999892119054389b579af4017f85e44cf1` | `dc07d98f4a54821a06a7aac13ef539bc82fdec840b4548b20afd64b5ee524015` |
| `stills/core/landing--768x1024--dark.png` | changed | 65,014 | 64,746 | `5a96cf372a817c33b891755eec434f49ab75717383f9e9648162a2ea5104037b` | `d36a241365868636cc03d01f6b4ecc71488b6529dacef79f854a227ebcced5ad` |
| `stills/localized/landing--1440x900--dark--de.png` | changed | 96,543 | 88,756 | `bc49bdb8c12772a397201751ff12c69999ff1305325c09ff25df0d9bbce8a69f` | `7aefc336597450cde5a0ac35c115efe7c996e7f0177b399e96248e5323bc0129` |
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
