export const PHASE5A2_CANDIDATES = [
  "source-fold",
  "evidence-register",
  "open-core",
] as const;

export const PHASE5A2_SURFACES = [
  "identity",
  "landing",
  "home",
  "product",
  "scanner",
  "motion",
] as const;

export const PHASE5A2_LOCALES = ["en", "pl", "de"] as const;
export const PHASE5A2_THEMES = ["light", "dark"] as const;
export const PHASE5A2_MOTION_MODES = ["full", "reduced"] as const;

export type Phase5A2Candidate = (typeof PHASE5A2_CANDIDATES)[number];
export type Phase5A2Surface = (typeof PHASE5A2_SURFACES)[number];
export type Phase5A2Locale = (typeof PHASE5A2_LOCALES)[number];
export type Phase5A2Theme = (typeof PHASE5A2_THEMES)[number];
export type Phase5A2MotionMode = (typeof PHASE5A2_MOTION_MODES)[number];

export interface Phase5A2RouteState {
  readonly candidate: Phase5A2Candidate;
  readonly surface: Phase5A2Surface;
  readonly locale: Phase5A2Locale;
  readonly theme: Phase5A2Theme;
  readonly motion: Phase5A2MotionMode;
  readonly state: string;
  readonly capture: boolean;
}

const SURFACE_STATES: Readonly<Record<Phase5A2Surface, readonly string[]>> = {
  identity: ["canonical"],
  landing: ["settled"],
  home: ["returning", "new", "paused", "error"],
  product: ["overview", "evidence", "partial"],
  scanner: [
    "permission",
    "ready",
    "recognized",
    "processing",
    "matched",
    "partial",
    "not-found",
    "offline",
    "camera-unavailable",
    "manual",
  ],
  motion: ["start", "mid", "complete"],
};

const DEFAULT_SURFACE_STATE: Readonly<Record<Phase5A2Surface, string>> = {
  identity: "canonical",
  landing: "settled",
  home: "returning",
  product: "overview",
  scanner: "ready",
  motion: "complete",
};

const PHASE5A2_QUERY_KEYS = new Set(["locale", "theme", "motion", "state", "capture"]);

function isAllowed<T extends string>(value: string, values: readonly T[]): value is T {
  return values.some((candidate) => candidate === value);
}

export function isPhase5A2Candidate(value: string): value is Phase5A2Candidate {
  return isAllowed(value, PHASE5A2_CANDIDATES);
}

export function isPhase5A2Surface(value: string): value is Phase5A2Surface {
  return isAllowed(value, PHASE5A2_SURFACES);
}

function oneQueryValue(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function resolvePhase5A2RouteState(
  candidate: Phase5A2Candidate,
  surface: Phase5A2Surface,
  query: Readonly<Record<string, string | readonly string[] | undefined>>,
): Phase5A2RouteState | null {
  if (
    Object.entries(query).some(
      ([key, value]) => !PHASE5A2_QUERY_KEYS.has(key) || Array.isArray(value),
    )
  ) {
    return null;
  }
  const requestedLocale = oneQueryValue(query.locale) ?? "en";
  const requestedTheme = oneQueryValue(query.theme) ?? "light";
  const requestedMotion = oneQueryValue(query.motion) ?? "full";
  const requestedState = oneQueryValue(query.state) ?? DEFAULT_SURFACE_STATE[surface];
  const requestedCapture = oneQueryValue(query.capture);
  if (
    !isAllowed(requestedLocale, PHASE5A2_LOCALES) ||
    !isAllowed(requestedTheme, PHASE5A2_THEMES) ||
    !isAllowed(requestedMotion, PHASE5A2_MOTION_MODES) ||
    !SURFACE_STATES[surface].some((state) => state === requestedState) ||
    (requestedCapture !== undefined && requestedCapture !== "1")
  ) {
    return null;
  }
  return {
    candidate,
    surface,
    locale: requestedLocale,
    theme: requestedTheme,
    motion: requestedMotion,
    state: requestedState,
    capture: requestedCapture === "1",
  };
}

export function phase5A2ReviewHref(
  candidate: Phase5A2Candidate,
  surface: Phase5A2Surface,
  locale: Phase5A2Locale,
  theme: Phase5A2Theme,
  motion: Phase5A2MotionMode,
  state?: string,
): string {
  const query = new URLSearchParams({ locale, theme, motion });
  if (state) query.set("state", state);
  return `/dev/phase5a2/${candidate}/${surface}?${query.toString()}`;
}

export const PHASE5A2_LOCALE_TAG: Readonly<Record<Phase5A2Locale, string>> = {
  en: "en-US",
  pl: "pl-PL",
  de: "de-DE",
};
