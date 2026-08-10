export function createFontAssay(productionFamily: string) {
  return Object.freeze({
    production: Object.freeze({
      status: "pass",
      family: productionFamily,
      runtimeFontHost: false,
      preloadChanged: false,
      reason:
        "The deterministic system stack covers EN, PL, and DE without a font transfer or runtime host.",
    }),
    candidate: Object.freeze({
      family: "Manrope",
      status: "candidate-not-adopted",
      requiredCoverage: Object.freeze([
        "English",
        "Polish",
        "German",
        "Latin Extended",
      ]),
      maximumCheckedInBytes: 102400,
      measuredBytes: null,
      source: null,
      version: null,
      license: null,
      checksumSha256: null,
      reason:
        "No authoritative, redistributable, version-pinned WOFF2 with proven Latin Extended coverage and a verified checksum was supplied; adoption would require guessing.",
    }),
  });
}
