import path from "node:path";

export const GOLDEN_REFERENCE_IDS = [
  "landing",
  "authentication",
  "home",
  "search",
  "product",
  "scanner",
] as const;

export type GoldenReferenceId = (typeof GOLDEN_REFERENCE_IDS)[number];

export const GOLDEN_CORE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

export const GOLDEN_CORE_THEMES = ["light", "dark"] as const;

export const GOLDEN_CORE_STILLS = GOLDEN_REFERENCE_IDS.flatMap((reference) =>
  GOLDEN_CORE_VIEWPORTS.flatMap((viewport) =>
    GOLDEN_CORE_THEMES.map((theme) => ({
      reference,
      ...viewport,
      locale: "en" as const,
      theme,
      motion: "reduced" as const,
      state: defaultGoldenState(reference),
    })),
  ),
);

export const GOLDEN_POLISH_MOBILE_STILLS = GOLDEN_REFERENCE_IDS.map((reference) => ({
  reference,
  width: 390 as const,
  height: 844 as const,
  locale: "pl" as const,
  theme: "light" as const,
  motion: "reduced" as const,
  state: defaultGoldenState(reference),
}));

export const GOLDEN_GERMAN_DESKTOP_STILLS = GOLDEN_REFERENCE_IDS.map((reference) => ({
  reference,
  width: 1440 as const,
  height: 900 as const,
  locale: "de" as const,
  theme: "dark" as const,
  motion: "reduced" as const,
  state: defaultGoldenState(reference),
}));

export const GOLDEN_FORCED_COLORS_STILLS = GOLDEN_REFERENCE_IDS.map((reference) => ({
  reference,
  width: 390 as const,
  height: 844 as const,
  locale: "en" as const,
  theme: "light" as const,
  motion: "reduced" as const,
  state: forcedColorsGoldenState(reference),
  forcedColors: true as const,
}));

export const GOLDEN_MOTION_RECORDINGS = GOLDEN_REFERENCE_IDS.flatMap((reference) => [
  {
    reference,
    mode: "normal" as const,
    width: reference === "landing" ? 1440 as const : 390 as const,
    height: reference === "landing" ? 900 as const : 844 as const,
    locale: "en" as const,
    theme: reference === "scanner" ? "dark" as const : "light" as const,
    motion: "full" as const,
    state: defaultGoldenState(reference),
  },
  {
    reference,
    mode: "reduced" as const,
    width: reference === "landing" ? 1440 as const : 390 as const,
    height: reference === "landing" ? 900 as const : 844 as const,
    locale: "en" as const,
    theme: reference === "scanner" ? "dark" as const : "light" as const,
    motion: "reduced" as const,
    state: defaultGoldenState(reference),
  },
]);

export const GOLDEN_ASSET_BOARDS = [
  "identity",
  "lockups",
  "compact-favicon",
  "maskable",
  "social-og",
  "typography",
  "domain-glyphs",
] as const;

export const GOLDEN_CORE_STILL_COUNT = 36;
export const GOLDEN_LOCALIZED_STILL_COUNT = 12;
export const GOLDEN_FORCED_COLORS_STILL_COUNT = 6;
export const GOLDEN_STATE_CONTACT_SHEET_COUNT = 6;
export const GOLDEN_MOTION_RECORDING_COUNT = 12;
export const GOLDEN_ASSET_BOARD_COUNT = 7;
export const GOLDEN_COMMITTED_BINARY_LIMIT_BYTES = 15 * 1024 * 1024;
export const GOLDEN_FONT_TRANSFER_LIMIT_BYTES = 100 * 1024;
export const GOLDEN_MAX_PNG_BYTES = 900 * 1024;
export const GOLDEN_MAX_VIDEO_BYTES = 3 * 1024 * 1024;
export const GOLDEN_VIDEO_FIRST_FRAME_TIMEOUT_MS = 5_000;
export const GOLDEN_VIDEO_MIN_DURATION_MS = 2_000;
export const GOLDEN_VIDEO_MAX_DURATION_MS = 30_000;

export function defaultGoldenState(reference: GoldenReferenceId): string {
  switch (reference) {
    case "landing": return "ready";
    case "authentication": return "sign-in";
    case "home": return "returning";
    case "search": return "results";
    case "product": return "available";
    case "scanner": return "not-requested";
  }
}

export function forcedColorsGoldenState(reference: GoldenReferenceId): string {
  switch (reference) {
    case "landing": return "data-paused";
    case "authentication": return "field-invalid";
    case "home": return "paused-partial";
    case "search": return "filters-active";
    case "product": return "unknown";
    case "scanner": return "uncertain-match";
  }
}

export function goldenRoute(
  capture: Readonly<{
    reference: GoldenReferenceId;
    locale: "en" | "pl" | "de";
    theme: "light" | "dark";
    motion: "full" | "reduced";
    state: string;
  }>,
): string {
  const query = new URLSearchParams({
    locale: capture.locale,
    theme: capture.theme,
    motion: capture.motion,
    state: capture.state,
    capture: "1",
  });
  return `/dev/phase5a2/golden/${capture.reference}?${query.toString()}`;
}

export function goldenEvidenceRoot(repositoryRoot: string): string {
  return path.join(repositoryRoot, "docs", "phase5a2", "checkpoint-2", "evidence");
}

if (GOLDEN_CORE_STILLS.length !== GOLDEN_CORE_STILL_COUNT) {
  throw new Error("[P5A2_GOLDEN] core-still-matrix-invalid");
}
