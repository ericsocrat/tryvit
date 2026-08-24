export const PHASE5A2_GOLDEN_REFERENCES = [
  "landing",
  "authentication",
  "home",
  "search",
  "product",
  "scanner",
] as const;

export const PHASE5A2_GOLDEN_LOCALES = ["en", "pl", "de"] as const;
export const PHASE5A2_GOLDEN_THEMES = ["light", "dark"] as const;
export const PHASE5A2_GOLDEN_MOTION_MODES = ["full", "reduced"] as const;

// Async state dwell is semantic, not decorative motion. Full and reduced-motion
// journeys retain the same perceptible interval so polite live announcements cannot
// be replaced by the terminal state in the next rendered frame.
export const GOLDEN_ASYNC_STATE_DWELL_MS = 1_000;
export const GOLDEN_ASYNC_STATE_ASSERT_MS = 750;
export const GOLDEN_REDIRECT_DWELL_MS = 400;

export type GoldenReference = (typeof PHASE5A2_GOLDEN_REFERENCES)[number];
export type GoldenLocale = (typeof PHASE5A2_GOLDEN_LOCALES)[number];
export type GoldenTheme = (typeof PHASE5A2_GOLDEN_THEMES)[number];
export type GoldenMotionMode = (typeof PHASE5A2_GOLDEN_MOTION_MODES)[number];

export interface GoldenRouteState {
  readonly reference: GoldenReference;
  readonly locale: GoldenLocale;
  readonly theme: GoldenTheme;
  readonly motion: GoldenMotionMode;
  readonly state: string;
  readonly capture: boolean;
}

export const GOLDEN_REFERENCE_STATES = Object.freeze({
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
  home: [
    "returning",
    "new",
    "paused-partial",
    "empty-saved",
    "loading",
    "degraded",
    "service-error",
    "offline",
  ],
  search: [
    "no-query",
    "typing",
    "suggestions-loading",
    "suggestions",
    "results-loading",
    "results",
    "filters-active",
    "empty",
    "degraded",
    "service-error",
    "offline-cache",
  ],
  product: [
    "available",
    "loading",
    "partial",
    "unknown",
    "stale",
    "degraded",
    "service-error",
    "offline-cache",
  ],
  scanner: [
    "not-requested",
    "permission-request",
    "permission-denied",
    "camera-unavailable",
    "ready",
    "acquisition-assist",
    "recognized",
    "processing",
    "matched",
    "partial-match",
    "uncertain-match",
    "not-found",
    "offline",
    "interrupted",
    "resumed",
    "manual-entry",
    "invalid-barcode",
    "contribution-entry",
  ],
} as const satisfies Readonly<Record<GoldenReference, readonly string[]>>);

export const GOLDEN_DEFAULT_STATE = Object.freeze({
  landing: "ready",
  authentication: "sign-in",
  home: "returning",
  search: "results",
  product: "available",
  scanner: "not-requested",
} as const satisfies Readonly<Record<GoldenReference, string>>);

export const GOLDEN_LOCALE_TAG: Readonly<Record<GoldenLocale, string>> = Object.freeze({
  en: "en-US",
  pl: "pl-PL",
  de: "de-DE",
});

export type GoldenAuthenticationState = (typeof GOLDEN_REFERENCE_STATES.authentication)[number];
export type GoldenSearchState = (typeof GOLDEN_REFERENCE_STATES.search)[number];
export type GoldenScannerState = (typeof GOLDEN_REFERENCE_STATES.scanner)[number];

const GOLDEN_QUERY_KEYS = new Set(["locale", "theme", "motion", "state", "capture"]);

function isAllowed<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.some((candidate) => candidate === value);
}

function oneQueryValue(
  value: string | readonly string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function isGoldenReference(value: string): value is GoldenReference {
  return isAllowed(value, PHASE5A2_GOLDEN_REFERENCES);
}

export function resolveGoldenRouteState(
  reference: GoldenReference,
  query: Readonly<Record<string, string | readonly string[] | undefined>>,
): GoldenRouteState | null {
  if (
    Object.entries(query).some(
      ([key, value]) => !GOLDEN_QUERY_KEYS.has(key) || Array.isArray(value),
    )
  ) {
    return null;
  }

  const locale = oneQueryValue(query.locale) ?? "en";
  const theme = oneQueryValue(query.theme) ?? "light";
  const motion = oneQueryValue(query.motion) ?? "full";
  const state = oneQueryValue(query.state) ?? GOLDEN_DEFAULT_STATE[reference];
  const capture = oneQueryValue(query.capture);

  if (
    !isAllowed(locale, PHASE5A2_GOLDEN_LOCALES) ||
    !isAllowed(theme, PHASE5A2_GOLDEN_THEMES) ||
    !isAllowed(motion, PHASE5A2_GOLDEN_MOTION_MODES) ||
    !GOLDEN_REFERENCE_STATES[reference].some((candidate) => candidate === state) ||
    (capture !== undefined && capture !== "1")
  ) {
    return null;
  }

  return {
    reference,
    locale,
    theme,
    motion,
    state,
    capture: capture === "1",
  };
}

export function goldenReferenceHref(
  reference: GoldenReference,
  locale: GoldenLocale,
  theme: GoldenTheme,
  motion: GoldenMotionMode,
  state: string = GOLDEN_DEFAULT_STATE[reference],
): string {
  const query = new URLSearchParams({ locale, theme, motion, state });
  return `/dev/phase5a2/golden/${reference}?${query.toString()}`;
}
