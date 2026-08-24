# Checkpoint 2 bounded typography assay

> **Status:** comparison ready; Eric decision pending
> **Production adoption:** prohibited

The system UI stack remains the current control. The guarded typography board now
compares that control with a non-production candidate using Manrope for display and
tabular data plus a restrained serif for Polish and German reading proofs. This is an
assay, not a final typography decision.

## Truthful rendered scale

Both columns render the same explicit computed hierarchy:

- Display: `48px`, two deliberately composed lines;
- Polish: `30px`, complete diacritics and two composed lines;
- German: `22px`, the complete long sentence and two composed lines;
- tabular figures: `26px`, two composed lines with `tnum` enabled.

The board uses content-aware minimum tracks rather than four unconditional `136px`
rows. Browser contracts check computed sizes against labels, article containment,
sibling intersections, text clipping, document/board overflow, the full Polish and
German proofs, 200%-equivalent reflow, and WCAG text spacing in both light and dark.

## Official sources and licensing

### Manrope

- upstream: <https://github.com/aaronbell/manrope>;
- exact commit: `6f81ebecdf65e4463b798cc07b16a4f8d5216917`;
- upstream version: `4.504`;
- upstream WOFF2 inputs:
  - Regular: 47,344 bytes, SHA-256
    `4d459ffc3fdb884cd88587cc3e4170b16f4ebbbf2ad9ccf29cbcc0058d02433f`;
  - SemiBold: 47,868 bytes, SHA-256
    `4b751c7594f0619ec9259c9f5564e0245944cdf0f564b1a3bec612eb98ea8ee1`;
- license: checked-in SIL OFL 1.1, line-trailing-space-normalized SHA-256
  `f612090fb72b6dca3e807e66fa0d2b5def163cef86f1a3209b5c897cba5ee4b7`;
- exact upstream license SHA-256:
  `e01b637272e0cbdfb240184dd98ea5cc671556d9894dae2668d92ab2c906787c`;
- reserved font names declared after the copyright statement: none.

### Source Serif 4 input and renamed assay derivative

- upstream: <https://github.com/adobe-fonts/source-serif>;
- exact release/tag: [`4.005R`](https://github.com/adobe-fonts/source-serif/releases/tag/4.005R);
- exact commit: `2823e993c53fca27c5c8749f529b56a5a7c77b6b`;
- official WOFF2 release archive: 11,623,196 bytes, SHA-256
  `af10e80dcd2296748b04cb9917db9f7ba0ae65101165fd2f0c16b9812d9abd28`;
- selected upstream TTF-flavored Regular WOFF2: 76,260 bytes, SHA-256
  `6b053e98f0838afe81f3e784727be4583a7c13bb42f198dc5202ecffee0aaee0`;
- license: checked-in SIL OFL 1.1, line-trailing-space-normalized SHA-256
  `c21d7293d87b6d7ab1d0229a2f55b77f33a7613a6a4e66f6693d68d7d8d09464`;
- exact upstream license SHA-256:
  `75784a295293a8992f5a8d99210566e0064a012e6dab6731305e3787f15896c7`;
- reserved font name: `Source`.

Because subsetting modifies the font, its primary family, full-name, unique-ID,
PostScript, typographic-family, and variation-prefix records are renamed to
`TryVit Assay Serif`. `Source` remains only where required for copyright and license
attribution. No production family name is proposed.

## Exact guarded assets

The deterministic subset uses `fonttools[woff] 4.59.1`, Brotli `1.2.0`, retained
hinting, and features `kern,liga,clig,calt,locl,mark,mkmk,tnum` over:

`U+0020-007E,U+00A0-017F,U+2010-2027,U+2030-203A,U+20AC,U+2190-21FF,U+2260-2265`

| Guarded file | Bytes | SHA-256 |
|---|---:|---|
| `manrope-regular.woff2` | 27,300 | `aa08da8e2396fd24c9cca149bcc1ffb6601b62c7dd771e1346406ed444493d59` |
| `manrope-semibold.woff2` | 27,412 | `8ba9a04089cdc0fd8ba4e95da82d3ee0bacb82ebc7f9f3100f78a7bad76c35ad` |
| `tryvit-assay-serif-regular.woff2` | 20,292 | `89c4a0f8be9a0386cb2f17db9625d65072581229f31d96ef45fc66378cd2e850` |
| **Total** | **75,004** | below the 102,400-byte limit |

The three outputs reproduced byte-identically in an independent second subset run.
They are referenced only by the guarded Golden CSS and are not package dependencies,
root preloads, public font files, or production font adoption.

## Coverage, fallback and layout evidence

The browser checks exercise the exact English, Polish, German, and numeric proof text
against both candidate families. Polish diacritics and the complete German sentence
pass. Manrope `tnum` produces a measured digit-width range of `0px`.

Fallback faces use explicit Arial/Arial Bold and Georgia sources with per-proof
`size-adjust`, `ascent-override`, `descent-override`, and zero line-gap values. The
pre-commit guarded measurement recorded `0` fallback CLS and `0px` top/height delta
for all four candidate specimens. Exact-source evidence is regenerated after the
source commit and remains authoritative.

## Later decision for Eric

After this Golden gate, Eric must explicitly choose one of:

1. retain the system UI stack; or
2. authorize a separate production typography-adoption gate for the candidate,
   including legal, native-language, assistive-technology, real-device, field
   performance, global fallback, preload, and migration review.

This checkpoint makes neither choice automatically.
