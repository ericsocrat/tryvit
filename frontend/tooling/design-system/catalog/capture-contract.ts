export const CATALOG_SCENE_IDS = [
  "foundations",
  "actions-forms",
  "overlays-navigation",
  "evidence-page-states",
] as const;

export type CatalogSceneId = (typeof CATALOG_SCENE_IDS)[number];

export const CATALOG_CAPTURE_CONTEXTS = [
  { id: "en-light", locale: "en-US", themePreference: "light", colorScheme: "light", reducedMotion: "no-preference", forcedColors: "none", contactSheetBackground: "#f7f3e8" },
  { id: "en-dark", locale: "en-US", themePreference: "dark", colorScheme: "dark", reducedMotion: "no-preference", forcedColors: "none", contactSheetBackground: "#08170f" },
  { id: "en-system-dark", locale: "en-US", themePreference: "system", colorScheme: "dark", reducedMotion: "no-preference", forcedColors: "none", contactSheetBackground: "#08170f" },
  { id: "en-forced-colors", locale: "en-US", themePreference: "system", colorScheme: "light", reducedMotion: "reduce", forcedColors: "active", contactSheetBackground: "#ffffff" },
  { id: "pl-light-reduced", locale: "pl-PL", themePreference: "light", colorScheme: "light", reducedMotion: "reduce", forcedColors: "none", contactSheetBackground: "#f7f3e8" },
  { id: "de-dark-reduced", locale: "de-DE", themePreference: "dark", colorScheme: "dark", reducedMotion: "reduce", forcedColors: "none", contactSheetBackground: "#08170f" },
] as const;

export const CATALOG_CAPTURE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

export const CATALOG_CAPTURE_COUNT =
  CATALOG_SCENE_IDS.length * CATALOG_CAPTURE_CONTEXTS.length * CATALOG_CAPTURE_VIEWPORTS.length;

export type CatalogSourceState =
  | "clean"
  | "next-build-generated"
  | "dirty-development-worktree";

export function parseCatalogSourceStatus(rawStatus: string): {
  readonly status: string;
  readonly state: CatalogSourceState;
} {
  const status = rawStatus.replace(/(?:\r?\n)+$/u, "");
  const lines = status ? status.split(/\r?\n/u) : [];
  const state = lines.length === 0
    ? "clean"
    : lines.every((line) => /^ M frontend\/next-env\.d\.ts$/u.test(line))
      ? "next-build-generated"
      : "dirty-development-worktree";
  return { status, state };
}

export function getCatalogCandidateRelativePaths(): readonly string[] {
  return CATALOG_CAPTURE_VIEWPORTS.flatMap((viewport) =>
    CATALOG_CAPTURE_CONTEXTS.flatMap((context) => {
      const directory = `${context.id}-${viewport.width}x${viewport.height}`;
      return [
        ...CATALOG_SCENE_IDS.map((scene) => `${directory}/${scene}.png`),
        `${directory}/contact-sheet.png`,
      ];
    }),
  );
}
