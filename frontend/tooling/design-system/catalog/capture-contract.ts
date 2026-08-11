export const CATALOG_SCENE_IDS = [
  "foundations",
  "actions-forms",
  "overlays-navigation",
  "evidence-page-states",
] as const;

export type CatalogSceneId = (typeof CATALOG_SCENE_IDS)[number];

export const CATALOG_INTERACTION_CAPTURE_IDS = [
  "actions-forms--combobox-open",
  "actions-forms--combobox-loading-open",
  "actions-forms--combobox-empty-open",
  "actions-forms--combobox-error-open",
  "overlays-navigation--dialog-open",
  "overlays-navigation--sheet-open",
  "overlays-navigation--menu-open",
  "overlays-navigation--tabs-keyboard-selected",
  "overlays-navigation--tooltip-focus-open",
] as const;

export type CatalogInteractionCaptureId =
  (typeof CATALOG_INTERACTION_CAPTURE_IDS)[number];

export const CATALOG_TEXT_SPACING_CAPTURE_ID = "catalog-shell--text-spacing" as const;
export const CATALOG_ZOOM_CAPTURE_ID = "catalog-shell--zoom-200" as const;
export type CatalogResilienceCaptureId =
  | typeof CATALOG_TEXT_SPACING_CAPTURE_ID
  | typeof CATALOG_ZOOM_CAPTURE_ID;
export type CatalogCaptureId =
  | CatalogSceneId
  | CatalogInteractionCaptureId
  | CatalogResilienceCaptureId;

export const CATALOG_CONTACT_SHEET_FILENAMES = [
  "contact-sheet.png",
  "interaction-contact-sheet.png",
] as const;

export type CatalogPointer = "fine" | "coarse";
export type CatalogHover = "hover" | "none";

export const CATALOG_CAPTURE_CONTEXTS = [
  {
    id: "en-light",
    locale: "en-US",
    themePreference: "light",
    colorScheme: "light",
    reducedMotion: "no-preference",
    forcedColors: "none",
    pointer: "fine",
    hover: "hover",
    contactSheetBackground: "#f7f3e8",
  },
  {
    id: "en-dark",
    locale: "en-US",
    themePreference: "dark",
    colorScheme: "dark",
    reducedMotion: "no-preference",
    forcedColors: "none",
    pointer: "fine",
    hover: "hover",
    contactSheetBackground: "#08170f",
  },
  {
    id: "en-system-dark",
    locale: "en-US",
    themePreference: "system",
    colorScheme: "dark",
    reducedMotion: "no-preference",
    forcedColors: "none",
    pointer: "fine",
    hover: "hover",
    contactSheetBackground: "#08170f",
  },
  {
    id: "en-forced-colors",
    locale: "en-US",
    themePreference: "system",
    colorScheme: "light",
    reducedMotion: "reduce",
    forcedColors: "active",
    pointer: "fine",
    hover: "hover",
    contactSheetBackground: "#ffffff",
  },
  {
    id: "pl-light-reduced",
    locale: "pl-PL",
    themePreference: "light",
    colorScheme: "light",
    reducedMotion: "reduce",
    forcedColors: "none",
    pointer: "coarse",
    hover: "none",
    contactSheetBackground: "#f7f3e8",
  },
  {
    id: "de-dark-reduced",
    locale: "de-DE",
    themePreference: "dark",
    colorScheme: "dark",
    reducedMotion: "reduce",
    forcedColors: "none",
    pointer: "fine",
    hover: "hover",
    contactSheetBackground: "#08170f",
  },
] as const satisfies readonly CatalogCaptureContext[];

export interface CatalogCaptureContext {
  readonly id: string;
  readonly locale: string;
  readonly themePreference: "light" | "dark" | "system";
  readonly colorScheme: "light" | "dark";
  readonly reducedMotion: "no-preference" | "reduce";
  readonly forcedColors: "none" | "active";
  readonly pointer: CatalogPointer;
  readonly hover: CatalogHover;
  readonly contactSheetBackground: string;
}

export const CATALOG_CAPTURE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const satisfies readonly CatalogCaptureViewport[];

export interface CatalogCaptureViewport {
  readonly width: number;
  readonly height: number;
}

export const CATALOG_CAPTURE_CASE_COUNT =
  CATALOG_CAPTURE_CONTEXTS.length * CATALOG_CAPTURE_VIEWPORTS.length;
export const CATALOG_SCENE_CAPTURE_COUNT =
  CATALOG_SCENE_IDS.length * CATALOG_CAPTURE_CASE_COUNT;
export const CATALOG_INTERACTION_CAPTURE_COUNT =
  CATALOG_INTERACTION_CAPTURE_IDS.length * CATALOG_CAPTURE_CASE_COUNT;
export const CATALOG_TEXT_SPACING_CAPTURE_COUNT = CATALOG_CAPTURE_CASE_COUNT;
export const CATALOG_ZOOM_CAPTURE_COUNT =
  CATALOG_CAPTURE_CONTEXTS.length *
  CATALOG_CAPTURE_VIEWPORTS.filter((viewport) => viewport.width === 768).length;
export const CATALOG_RESILIENCE_CAPTURE_COUNT =
  CATALOG_TEXT_SPACING_CAPTURE_COUNT + CATALOG_ZOOM_CAPTURE_COUNT;
export const CATALOG_CAPTURE_COUNT =
  CATALOG_SCENE_CAPTURE_COUNT +
  CATALOG_INTERACTION_CAPTURE_COUNT +
  CATALOG_RESILIENCE_CAPTURE_COUNT;
export const CATALOG_CONTACT_SHEET_COUNT =
  CATALOG_CONTACT_SHEET_FILENAMES.length * CATALOG_CAPTURE_CASE_COUNT;
export const CATALOG_PNG_COUNT = CATALOG_CAPTURE_COUNT + CATALOG_CONTACT_SHEET_COUNT;
export const CATALOG_EVIDENCE_RECORD_COUNT = CATALOG_CAPTURE_CASE_COUNT;
export const CATALOG_MANIFEST_ENTRY_COUNT = CATALOG_PNG_COUNT + 1;
export const CATALOG_CANDIDATE_FILE_COUNT = CATALOG_MANIFEST_ENTRY_COUNT + 1;

export const CATALOG_EVIDENCE_CHECK_IDS = [
  "axe-default",
  "axe-combobox-open",
  "axe-combobox-loading-open",
  "axe-combobox-empty-open",
  "axe-combobox-error-open",
  "axe-dialog-open",
  "axe-sheet-open",
  "axe-menu-open",
  "axe-tabs-selected",
  "axe-tooltip-open",
  "keyboard-button",
  "keyboard-fields",
  "switch-direction",
  "keyboard-combobox",
  "combobox-status-states",
  "keyboard-dialog",
  "keyboard-sheet",
  "keyboard-menu",
  "keyboard-tabs",
  "keyboard-tooltip",
  "portal-v2-scope",
  "focus-containment",
  "focus-restoration",
  "focus-not-obscured",
  "roving-focus",
  "outside-interaction",
  "nested-outside-non-cascade",
  "pointer-contract",
  "target-size",
  "overflow",
  "text-spacing",
  "reduced-motion",
  "forced-colors",
  "system-theme",
  "zoom-200",
] as const;

export type CatalogEvidenceCheckId = (typeof CATALOG_EVIDENCE_CHECK_IDS)[number];
export type CatalogEvidenceCheckResult = "pass" | "not-applicable";

export interface CatalogEvidenceRecord {
  readonly id: string;
  readonly contextId: string;
  readonly locale: string;
  readonly viewport: CatalogCaptureViewport;
  readonly pointer: CatalogPointer;
  readonly hover: CatalogHover;
  readonly checks: Readonly<Record<CatalogEvidenceCheckId, CatalogEvidenceCheckResult>>;
}

export interface CatalogEvidence {
  readonly schemaVersion: 1;
  readonly kind: "phase5a1b-canonical-primitives-interaction-evidence";
  readonly sourceSha: string;
  readonly sourceTreeSha: string;
  readonly pullRequestHeadSha: string;
  readonly records: readonly CatalogEvidenceRecord[];
}

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

export function getCatalogCaptureCaseId(
  context: Pick<CatalogCaptureContext, "id">,
  viewport: CatalogCaptureViewport,
): string {
  return `${context.id}-${viewport.width}x${viewport.height}`;
}

export function getCatalogCandidatePngRelativePaths(): readonly string[] {
  return CATALOG_CAPTURE_VIEWPORTS.flatMap((viewport) =>
    CATALOG_CAPTURE_CONTEXTS.flatMap((context) => {
      const directory = getCatalogCaptureCaseId(context, viewport);
      return [
        ...CATALOG_SCENE_IDS.map((scene) => `${directory}/${scene}.png`),
        ...CATALOG_INTERACTION_CAPTURE_IDS.map(
          (capture) => `${directory}/${capture}.png`,
        ),
        ...CATALOG_CONTACT_SHEET_FILENAMES.map(
          (filename) => `${directory}/${filename}`,
        ),
        `${directory}/${CATALOG_TEXT_SPACING_CAPTURE_ID}.png`,
        ...(viewport.width === 768
          ? [`${directory}/${CATALOG_ZOOM_CAPTURE_ID}.png`]
          : []),
      ];
    }),
  );
}

export function getCatalogCandidateRelativePaths(): readonly string[] {
  return [...getCatalogCandidatePngRelativePaths(), "evidence.json"];
}

export function getCatalogExpectedEvidenceResult(
  checkId: CatalogEvidenceCheckId,
  context: CatalogCaptureContext,
  viewport: CatalogCaptureViewport,
): CatalogEvidenceCheckResult {
  if (checkId === "reduced-motion") {
    return context.reducedMotion === "reduce" ? "pass" : "not-applicable";
  }
  if (checkId === "forced-colors") {
    return context.forcedColors === "active" ? "pass" : "not-applicable";
  }
  if (checkId === "switch-direction") {
    return context.forcedColors === "none" ? "pass" : "not-applicable";
  }
  if (checkId === "system-theme") {
    return context.themePreference === "system" ? "pass" : "not-applicable";
  }
  if (checkId === "zoom-200") {
    return viewport.width === 768 ? "pass" : "not-applicable";
  }
  return "pass";
}

export function getCatalogExpectedEvidenceRecords(): readonly CatalogEvidenceRecord[] {
  return CATALOG_CAPTURE_VIEWPORTS.flatMap((viewport) =>
    CATALOG_CAPTURE_CONTEXTS.map((context) => ({
      id: getCatalogCaptureCaseId(context, viewport),
      contextId: context.id,
      locale: context.locale,
      viewport: { width: viewport.width, height: viewport.height },
      pointer: context.pointer,
      hover: context.hover,
      checks: Object.fromEntries(
        CATALOG_EVIDENCE_CHECK_IDS.map((checkId) => [
          checkId,
          getCatalogExpectedEvidenceResult(checkId, context, viewport),
        ]),
      ) as Record<CatalogEvidenceCheckId, CatalogEvidenceCheckResult>,
    })),
  );
}
