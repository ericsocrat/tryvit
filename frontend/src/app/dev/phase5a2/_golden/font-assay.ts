export const GOLDEN_FONT_ASSAY = Object.freeze({
  status: "comparison-ready-decision-pending",
  reviewOnly: true,
  productionAdoption: false,
  transferLimitBytes: 100 * 1024,
  transferBytes: 75_004,
  unicodeCoverage:
    "U+0020-007E,U+00A0-017F,U+2010-2027,U+2030-203A,U+20AC,U+2190-21FF,U+2260-2265",
  proof: Object.freeze({
    english: "Evidence should be readable before it is persuasive.",
    polish: "Wiarygodność danych nie ukrywa brakujących informacji.",
    german:
      "Verpackungsangaben, abgeleitete Einordnung und Datenverlässlichkeit bleiben unterscheidbar.",
    tabular: "003.20 · 072/100 · 2026-07-14 · 5901234123457",
  }),
  sources: Object.freeze({
    manrope: Object.freeze({
      repository: "https://github.com/aaronbell/manrope",
      commit: "6f81ebecdf65e4463b798cc07b16a4f8d5216917",
      version: "4.504",
      licensePath: "font-assay/licenses/MANROPE-OFL.txt",
      licenseBytes: 4_383,
      upstreamLicenseSha256: "e01b637272e0cbdfb240184dd98ea5cc671556d9894dae2668d92ab2c906787c",
      licenseSha256: "f612090fb72b6dca3e807e66fa0d2b5def163cef86f1a3209b5c897cba5ee4b7",
      reservedFontNames: Object.freeze([]),
      inputs: Object.freeze([
        Object.freeze({
          path: "fonts/webfonts/Manrope-Regular.woff2",
          bytes: 47_344,
          sha256: "4d459ffc3fdb884cd88587cc3e4170b16f4ebbbf2ad9ccf29cbcc0058d02433f",
        }),
        Object.freeze({
          path: "fonts/webfonts/Manrope-SemiBold.woff2",
          bytes: 47_868,
          sha256: "4b751c7594f0619ec9259c9f5564e0245944cdf0f564b1a3bec612eb98ea8ee1",
        }),
      ]),
    }),
    sourceSerif4: Object.freeze({
      repository: "https://github.com/adobe-fonts/source-serif",
      release: "4.005R",
      commit: "2823e993c53fca27c5c8749f529b56a5a7c77b6b",
      releaseAsset:
        "https://github.com/adobe-fonts/source-serif/releases/download/4.005R/source-serif-4.005_WOFF2.zip",
      releaseAssetBytes: 11_623_196,
      releaseAssetSha256: "af10e80dcd2296748b04cb9917db9f7ba0ae65101165fd2f0c16b9812d9abd28",
      licensePath: "font-assay/licenses/SOURCE-SERIF-4-OFL.md",
      licenseBytes: 4_491,
      upstreamLicenseSha256: "75784a295293a8992f5a8d99210566e0064a012e6dab6731305e3787f15896c7",
      licenseSha256: "c21d7293d87b6d7ab1d0229a2f55b77f33a7613a6a4e66f6693d68d7d8d09464",
      reservedFontNames: Object.freeze(["Source"]),
      input: Object.freeze({
        path: "TTF/SourceSerif4-Regular.ttf.woff2",
        bytes: 76_260,
        sha256: "6b053e98f0838afe81f3e784727be4583a7c13bb42f198dc5202ecffee0aaee0",
      }),
      derivedFamilyName: "TryVit Assay Serif",
      reservedNameDisposition:
        "The subset is renamed in its primary name records; Source remains only in required copyright and license attribution.",
    }),
  }),
  files: Object.freeze([
    Object.freeze({
      path: "font-assay/manrope-regular.woff2",
      family: "Manrope",
      weight: 400,
      bytes: 27_300,
      sha256: "aa08da8e2396fd24c9cca149bcc1ffb6601b62c7dd771e1346406ed444493d59",
    }),
    Object.freeze({
      path: "font-assay/manrope-semibold.woff2",
      family: "Manrope",
      weight: 600,
      bytes: 27_412,
      sha256: "8ba9a04089cdc0fd8ba4e95da82d3ee0bacb82ebc7f9f3100f78a7bad76c35ad",
    }),
    Object.freeze({
      path: "font-assay/tryvit-assay-serif-regular.woff2",
      family: "TryVit Assay Serif",
      weight: 400,
      bytes: 20_292,
      sha256: "89c4a0f8be9a0386cb2f17db9625d65072581229f31d96ef45fc66378cd2e850",
    }),
  ]),
  fallbackMetrics: Object.freeze({
    layoutReserve: Object.freeze({
      display: "147px",
      polish: "67px",
      german: "81px",
      tabular: "60px",
      basis: "Platform-independent specimen boxes reserve the maximum governed fallback line count while content-expanding tracks preserve text-spacing and reflow.",
    }),
    manropeRegular: Object.freeze({
      fallback: "Arial",
      sizeAdjust: "97.58%",
      ascentOverride: "109.24%",
      descentOverride: "30.74%",
      lineGapOverride: "0%",
      basis: "exact tabular-proof advance width and hhea metrics against Arial",
    }),
    manropeSemibold: Object.freeze({
      fallback: "Arial Bold",
      sizeAdjust: "98.84%",
      ascentOverride: "107.85%",
      descentOverride: "30.35%",
      lineGapOverride: "0%",
      basis: "exact English-proof advance width and hhea metrics against Arial Bold",
    }),
    sourceSerif4: Object.freeze({
      fallback: "Georgia",
      sizeAdjust: "102.12%",
      ascentOverride: "101.45%",
      descentOverride: "32.80%",
      lineGapOverride: "0%",
      basis: "mean Polish/German proof advance width and hhea metrics against Georgia",
    }),
  }),
  subsetting: Object.freeze({
    tool: "fonttools[woff] 4.59.1",
    brotli: "1.2.0",
    features: "kern,liga,clig,calt,locl,mark,mkmk,tnum",
    hinting: "retained",
    deterministicRerunRequired: false,
    deterministicRerunVerified: true,
  }),
});

export const GOLDEN_FONT_ASSAY_PACKET_FILES = Object.freeze([
  ...GOLDEN_FONT_ASSAY.files.map((file) => Object.freeze({ ...file, kind: "font" as const })),
  Object.freeze({
    path: GOLDEN_FONT_ASSAY.sources.manrope.licensePath,
    kind: "license" as const,
    bytes: GOLDEN_FONT_ASSAY.sources.manrope.licenseBytes,
    sha256: GOLDEN_FONT_ASSAY.sources.manrope.licenseSha256,
  }),
  Object.freeze({
    path: GOLDEN_FONT_ASSAY.sources.sourceSerif4.licensePath,
    kind: "license" as const,
    bytes: GOLDEN_FONT_ASSAY.sources.sourceSerif4.licenseBytes,
    sha256: GOLDEN_FONT_ASSAY.sources.sourceSerif4.licenseSha256,
  }),
]);

export const GOLDEN_TYPE_SCALE = Object.freeze({
  display: 48,
  polish: 30,
  german: 22,
  tabular: 26,
});
