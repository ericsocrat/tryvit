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
    state: motionStartGoldenState(reference),
  },
  {
    reference,
    mode: "reduced" as const,
    width: reference === "landing" ? 1440 as const : 390 as const,
    height: reference === "landing" ? 900 as const : 844 as const,
    locale: "en" as const,
    theme: reference === "scanner" ? "dark" as const : "light" as const,
    motion: "reduced" as const,
    state: motionStartGoldenState(reference),
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

export const GOLDEN_REFERENCE_STATE_CONTRACT = Object.freeze({
  landing: ["ready", "data-paused", "demo-error", "offline"],
  authentication: [
    "sign-in",
    "registration",
    "recovery",
    "field-invalid",
    "invalid-credentials",
    "busy",
    "service-failure",
    "success",
    "redirecting",
    "recovery-sent",
  ],
  home: ["returning", "new", "paused-partial", "empty-saved", "loading", "degraded", "service-error", "offline"],
  search: ["no-query", "typing", "suggestions-loading", "suggestions", "results-loading", "results", "filters-active", "empty", "degraded", "service-error", "offline-cache"],
  product: ["available", "loading", "partial", "unknown", "stale", "degraded", "service-error", "offline-cache"],
  scanner: ["not-requested", "permission-request", "permission-denied", "camera-unavailable", "ready", "acquisition-assist", "recognized", "processing", "matched", "partial-match", "uncertain-match", "not-found", "offline", "interrupted", "resumed", "manual-entry", "invalid-barcode", "contribution-entry"],
} as const satisfies Readonly<Record<GoldenReferenceId, readonly string[]>>);

export const GOLDEN_STATE_CAPTURES = GOLDEN_REFERENCE_IDS.flatMap((reference) =>
  GOLDEN_REFERENCE_STATE_CONTRACT[reference].map((state) => ({
    reference,
    state,
    width: 390 as const,
    height: 844 as const,
    locale: "en" as const,
    theme: reference === "scanner" ? "dark" as const : "light" as const,
    motion: "reduced" as const,
  })),
);

export interface GoldenJourneyStep {
  readonly event: string;
  readonly expectedState: string;
  readonly expectedFocus?: string;
  readonly expectedAnnouncement?: string;
}

export interface GoldenJourneyContract {
  readonly reference: GoldenReferenceId;
  readonly viewport: Readonly<{ width: 390 | 1440; height: 844 | 900 }>;
  readonly locale: "en";
  readonly theme: "light" | "dark";
  readonly startState: string;
  readonly steps: readonly GoldenJourneyStep[];
  readonly terminal: Readonly<{
    reference: GoldenReferenceId;
    state: string;
    focus: string;
    announcement: string;
  }>;
}

export const GOLDEN_JOURNEYS = Object.freeze([
  {
    reference: "landing",
    viewport: { width: 1440, height: 900 },
    locale: "en",
    theme: "light",
    startState: "ready",
    steps: [
      { event: "keyboard-skip-to-reference", expectedState: "ready", expectedFocus: "#golden-main" },
      { event: "toggle-package-label", expectedState: "ready", expectedFocus: "button[aria-pressed='true']" },
      { event: "reset-package-label", expectedState: "ready", expectedFocus: "button[aria-pressed='false']" },
      { event: "repeat-package-label", expectedState: "ready", expectedFocus: "button[aria-pressed='true']" },
      { event: "change-theme-dark", expectedState: "ready" },
    ],
    terminal: { reference: "landing", state: "ready", focus: "button", announcement: "none" },
  },
  {
    reference: "authentication",
    viewport: { width: 390, height: 844 },
    locale: "en",
    theme: "light",
    startState: "sign-in",
    steps: [
      { event: "submit-empty", expectedState: "field-invalid", expectedFocus: "#golden-auth-email", expectedAnnouncement: "Correct the following fields" },
      { event: "submit-invalid-credentials", expectedState: "invalid-credentials", expectedFocus: "#golden-auth-email", expectedAnnouncement: "details do not match" },
      { event: "submit-review-fixture", expectedState: "busy", expectedAnnouncement: "Checking the local review details" },
      { event: "local-validation-complete", expectedState: "success", expectedFocus: "[data-golden-live-state='success']", expectedAnnouncement: "Local sign-in completed" },
      { event: "continue-home", expectedState: "redirecting", expectedAnnouncement: "Preparing the home reference" },
    ],
    terminal: { reference: "home", state: "returning", focus: "#golden-main", announcement: "none" },
  },
  {
    reference: "home",
    viewport: { width: 390, height: 844 },
    locale: "en",
    theme: "light",
    startState: "paused-partial",
    steps: [
      { event: "open-decision-menu", expectedState: "paused-partial", expectedFocus: "[role='menuitem']" },
      { event: "escape-menu", expectedState: "paused-partial", expectedFocus: "button[aria-haspopup='menu']" },
      { event: "resume-evidence", expectedState: "paused-partial", expectedAnnouncement: "Evidence review resumed" },
      { event: "open-partial-product", expectedState: "partial" },
    ],
    terminal: { reference: "product", state: "partial", focus: "#golden-main", announcement: "none" },
  },
  {
    reference: "search",
    viewport: { width: 390, height: 844 },
    locale: "en",
    theme: "light",
    startState: "no-query",
    steps: [
      { event: "type-oat", expectedState: "typing", expectedFocus: "input[name='golden-search']" },
      { event: "submit-query", expectedState: "results-loading", expectedAnnouncement: "Calculating the local result set" },
      { event: "results-settled", expectedState: "results", expectedAnnouncement: "3 synthetic records" },
      { event: "open-filter-sheet", expectedState: "results", expectedFocus: "[role='dialog']" },
      { event: "apply-partial-filter", expectedState: "filters-active", expectedAnnouncement: "2 synthetic records" },
    ],
    terminal: { reference: "search", state: "filters-active", focus: "button", announcement: "2 synthetic records" },
  },
  {
    reference: "product",
    viewport: { width: 390, height: 844 },
    locale: "en",
    theme: "light",
    startState: "unknown",
    steps: [
      { event: "activate-ingredients-tab", expectedState: "unknown", expectedFocus: "[role='tab'][aria-selected='true']" },
      { event: "open-provenance-dialog", expectedState: "unknown", expectedFocus: "[role='dialog']" },
      { event: "close-provenance-dialog", expectedState: "unknown", expectedFocus: "button" },
      { event: "open-comparison-menu", expectedState: "unknown", expectedFocus: "[role='menuitem']" },
    ],
    terminal: { reference: "product", state: "unknown", focus: "button[aria-haspopup='menu']", announcement: "none" },
  },
  {
    reference: "scanner",
    viewport: { width: 390, height: 844 },
    locale: "en",
    theme: "dark",
    startState: "not-requested",
    steps: [
      { event: "request-permission-simulation", expectedState: "permission-request", expectedAnnouncement: "No browser prompt is open" },
      { event: "grant-simulation", expectedState: "ready", expectedAnnouncement: "Scanner simulation ready" },
      { event: "show-acquisition-assist", expectedState: "acquisition-assist", expectedAnnouncement: "Move the package closer" },
      { event: "recognize-barcode", expectedState: "recognized", expectedAnnouncement: "Product identity is not matched yet" },
      { event: "start-local-lookup", expectedState: "processing", expectedAnnouncement: "local product lookup" },
      { event: "lookup-complete", expectedState: "matched", expectedAnnouncement: "North Grain Oat Drink matched" },
    ],
    terminal: { reference: "scanner", state: "matched", focus: "[role='status']", announcement: "North Grain Oat Drink matched" },
  },
] as const satisfies readonly GoldenJourneyContract[]);

export const GOLDEN_CORE_STILL_COUNT = 36;
export const GOLDEN_LOCALIZED_STILL_COUNT = 12;
export const GOLDEN_FORCED_COLORS_STILL_COUNT = 6;
export const GOLDEN_STATE_CONTACT_SHEET_COUNT = 6;
export const GOLDEN_STATE_CAPTURE_COUNT = 59;
export const GOLDEN_MOTION_RECORDING_COUNT = 12;
export const GOLDEN_ASSET_BOARD_COUNT = 7;
export const GOLDEN_COMMITTED_BINARY_LIMIT_BYTES = 15 * 1024 * 1024;
export const GOLDEN_FONT_TRANSFER_LIMIT_BYTES = 100 * 1024;
export const GOLDEN_MAX_PNG_BYTES = 900 * 1024;
export const GOLDEN_MAX_VIDEO_BYTES = 3 * 1024 * 1024;
export const GOLDEN_VIDEO_FIRST_FRAME_TIMEOUT_MS = 5_000;
export const GOLDEN_VIDEO_STATE_DWELL_MS = 360;
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

export function motionStartGoldenState(reference: GoldenReferenceId): string {
  switch (reference) {
    case "landing": return "ready";
    case "authentication": return "sign-in";
    case "home": return "paused-partial";
    case "search": return "no-query";
    case "product": return "unknown";
    case "scanner": return "not-requested";
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

export function goldenCandidateRoot(frontendRoot: string): string {
  return path.join(frontendRoot, "test-results", "phase5a2-golden-candidates");
}

export function coreStillRelativePath(capture: (typeof GOLDEN_CORE_STILLS)[number]): string {
  return path.posix.join(
    "stills",
    "core",
    `${capture.reference}--${capture.width}x${capture.height}--${capture.theme}.png`,
  );
}

export function localizedStillRelativePath(
  capture:
    | (typeof GOLDEN_POLISH_MOBILE_STILLS)[number]
    | (typeof GOLDEN_GERMAN_DESKTOP_STILLS)[number],
): string {
  return path.posix.join(
    "stills",
    "localized",
    `${capture.reference}--${capture.width}x${capture.height}--${capture.theme}--${capture.locale}.png`,
  );
}

export function forcedColorsStillRelativePath(
  capture: (typeof GOLDEN_FORCED_COLORS_STILLS)[number],
): string {
  return path.posix.join(
    "stills",
    "forced-colors",
    `${capture.reference}--390x844--${capture.state}.png`,
  );
}

export function stateStillRelativePath(capture: (typeof GOLDEN_STATE_CAPTURES)[number]): string {
  return path.posix.join(
    "states",
    capture.reference,
    `${capture.state}--390x844--${capture.theme}.png`,
  );
}

export function assetBoardRelativePath(board: (typeof GOLDEN_ASSET_BOARDS)[number]): string {
  return path.posix.join("boards", `${board}--1440x900--light.png`);
}

export function motionRecordingRelativePath(
  capture: (typeof GOLDEN_MOTION_RECORDINGS)[number],
): string {
  return path.posix.join(
    "motion",
    `${capture.reference}--${capture.mode}--${capture.width}x${capture.height}--${capture.theme}.webm`,
  );
}

export function motionTerminalStillRelativePath(
  capture: (typeof GOLDEN_MOTION_RECORDINGS)[number],
): string {
  return path.posix.join(
    "motion-terminal",
    `${capture.reference}--${capture.mode}--terminal.png`,
  );
}

export function stateContactSheetRelativePath(reference: GoldenReferenceId): string {
  return path.posix.join("contact-sheets", `${reference}--states.png`);
}

if (GOLDEN_CORE_STILLS.length !== GOLDEN_CORE_STILL_COUNT) {
  throw new Error("[P5A2_GOLDEN] core-still-matrix-invalid");
}
if (GOLDEN_STATE_CAPTURES.length !== GOLDEN_STATE_CAPTURE_COUNT) {
  throw new Error("[P5A2_GOLDEN] state-capture-matrix-invalid");
}
if (GOLDEN_JOURNEYS.length !== GOLDEN_REFERENCE_IDS.length) {
  throw new Error("[P5A2_GOLDEN] journey-matrix-invalid");
}
