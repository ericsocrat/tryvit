export const CATALOG_SCENE_IDS = [
  "foundations",
  "actions-forms",
  "overlays-navigation",
  "evidence-page-states",
] as const;

export type CatalogSceneId = (typeof CATALOG_SCENE_IDS)[number];

export const CATALOG_CAPTURE_CONTEXTS = [
  { id: "en-light", locale: "en-US", colorScheme: "light", reducedMotion: "no-preference", forcedColors: "none" },
  { id: "en-dark", locale: "en-US", colorScheme: "dark", reducedMotion: "no-preference", forcedColors: "none" },
  { id: "en-light-reduced", locale: "en-US", colorScheme: "light", reducedMotion: "reduce", forcedColors: "none" },
  { id: "en-forced-colors", locale: "en-US", colorScheme: "light", reducedMotion: "reduce", forcedColors: "active" },
  { id: "pl-light-reduced", locale: "pl-PL", colorScheme: "light", reducedMotion: "reduce", forcedColors: "none" },
  { id: "de-light-reduced", locale: "de-DE", colorScheme: "light", reducedMotion: "reduce", forcedColors: "none" },
] as const;

export const CATALOG_CAPTURE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

export const CATALOG_CAPTURE_COUNT =
  CATALOG_SCENE_IDS.length * CATALOG_CAPTURE_CONTEXTS.length * CATALOG_CAPTURE_VIEWPORTS.length;
