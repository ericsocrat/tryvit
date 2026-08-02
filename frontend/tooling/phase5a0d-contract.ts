/**
 * Phase 5A.0d measurement contract.
 *
 * This file is test/CI infrastructure. It is deliberately independent of the
 * application route registry so a measurement cannot silently expand its own
 * scope when product routes change.
 */

export const PHASE5A0D_SCHEMA_VERSION = 1 as const;

export const ROUTE_REGRESSION_LIMIT = Object.freeze({
  gzipBytes: 10 * 1024,
  percent: 5,
});

export const LIGHTHOUSE_RUN_COUNT = 5 as const;
export const PHASE5A0D_FIXED_TIME = "2026-07-15T12:00:00.000Z" as const;
export const VISUAL_MAX_DIFF_PIXEL_RATIO = 0.003 as const;

export interface MeasurementRoute {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly requiresLocalFixture: boolean;
  readonly boundary: "server-led-public" | "client-auth-entry" | "authenticated-client-surface";
  readonly initialJsTargetGzipBytes: number | null;
}

export const MEASUREMENT_ROUTES: readonly MeasurementRoute[] = Object.freeze([
  {
    id: "landing",
    label: "Landing",
    path: "/",
    requiresLocalFixture: false,
    boundary: "server-led-public",
    initialJsTargetGzipBytes: 180 * 1024,
  },
  {
    id: "login",
    label: "Login",
    path: "/auth/login",
    requiresLocalFixture: false,
    boundary: "client-auth-entry",
    initialJsTargetGzipBytes: null,
  },
  {
    id: "contact",
    label: "Contact",
    path: "/contact",
    requiresLocalFixture: false,
    boundary: "server-led-public",
    initialJsTargetGzipBytes: 150 * 1024,
  },
  {
    id: "app-shell",
    label: "Authenticated shell",
    path: "/app",
    requiresLocalFixture: true,
    boundary: "authenticated-client-surface",
    initialJsTargetGzipBytes: null,
  },
  {
    id: "product-detail",
    label: "Product detail",
    path: "/app/product/:fixtureProductId",
    requiresLocalFixture: true,
    boundary: "authenticated-client-surface",
    initialJsTargetGzipBytes: null,
  },
]);

export interface LighthouseRoute {
  readonly id: string;
  readonly path: string;
  readonly requiresLocalFixture: boolean;
  readonly seoApplicable: boolean;
}

const SEO_ROUTE_IDS = new Set(["landing", "contact"]);

export const LIGHTHOUSE_ROUTES: readonly LighthouseRoute[] = Object.freeze(
  MEASUREMENT_ROUTES.map((route) =>
    Object.freeze({
      id: route.id,
      path: route.path,
      requiresLocalFixture: route.requiresLocalFixture,
      seoApplicable: SEO_ROUTE_IDS.has(route.id),
    }),
  ),
);

export interface VisualBaselineCase {
  readonly id: string;
  readonly mode: "public" | "local-authenticated";
  readonly routeId: "landing" | "login" | "app-shell";
  readonly path: "/" | "/auth/login" | "/app";
  readonly width: 390 | 768 | 1440;
  readonly height: 844 | 1024 | 900;
  readonly filename: string;
  readonly fixtureState: "public-static" | "local-authenticated-new-user";
}

export const VISUAL_BASELINE_CASES: readonly VisualBaselineCase[] = Object.freeze([
  {
    id: "landing-390x844",
    mode: "public",
    routeId: "landing",
    path: "/",
    width: 390,
    height: 844,
    filename: "p5a0d-landing-390x844-light-reduced.png",
    fixtureState: "public-static",
  },
  {
    id: "landing-768x1024",
    mode: "public",
    routeId: "landing",
    path: "/",
    width: 768,
    height: 1024,
    filename: "p5a0d-landing-768x1024-light-reduced.png",
    fixtureState: "public-static",
  },
  {
    id: "landing-1440x900",
    mode: "public",
    routeId: "landing",
    path: "/",
    width: 1440,
    height: 900,
    filename: "p5a0d-landing-1440x900-light-reduced.png",
    fixtureState: "public-static",
  },
  {
    id: "login-390x844",
    mode: "public",
    routeId: "login",
    path: "/auth/login",
    width: 390,
    height: 844,
    filename: "p5a0d-login-390x844-light-reduced.png",
    fixtureState: "public-static",
  },
  {
    id: "login-1440x900",
    mode: "public",
    routeId: "login",
    path: "/auth/login",
    width: 1440,
    height: 900,
    filename: "p5a0d-login-1440x900-light-reduced.png",
    fixtureState: "public-static",
  },
  {
    id: "app-shell-new-user-390x844",
    mode: "local-authenticated",
    routeId: "app-shell",
    path: "/app",
    width: 390,
    height: 844,
    filename: "p5a0d-app-shell-new-user-390x844-light-reduced.png",
    fixtureState: "local-authenticated-new-user",
  },
  {
    id: "app-shell-new-user-1440x900",
    mode: "local-authenticated",
    routeId: "app-shell",
    path: "/app",
    width: 1440,
    height: 900,
    filename: "p5a0d-app-shell-new-user-1440x900-light-reduced.png",
    fixtureState: "local-authenticated-new-user",
  },
]);

/**
 * Stable, non-secret state that the authoritative visual baselines depend on.
 * Database-generated identifiers and test credentials are deliberately absent:
 * they are runtime implementation details, not part of the rendered contract.
 */
export const VISUAL_FIXTURE_CONTRACT = Object.freeze({
  schemaVersion: 1,
  publicStatic: Object.freeze({
    authentication: "anonymous" as const,
    fixtureState: "public-static" as const,
  }),
  localAuthenticatedNewUser: Object.freeze({
    fixtureState: "local-authenticated-new-user" as const,
    lifecycle: "fresh-user-deleted-after-run" as const,
    preferences: Object.freeze({
      country: "PL" as const,
      preferredLanguage: "en" as const,
      onboardingCompleted: false,
      onboardingSkipped: true,
    }),
    requiredPageMarker: "new-user-welcome" as const,
  }),
});

export interface NumericSummary {
  readonly values: readonly number[];
  readonly median: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly range: number;
  readonly rangePercentOfMedian: number;
  readonly medianAbsoluteDeviation: number;
  readonly madPercentOfMedian: number;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error("[P5_MEASUREMENT] median-requires-values");
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("[P5_MEASUREMENT] median-requires-finite-values");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

export function summarizeNumbers(values: readonly number[]): NumericSummary {
  const normalized = [...values].sort((left, right) => left - right);
  const middle = median(normalized);
  const minimum = normalized[0];
  const maximum = normalized.at(-1) as number;
  const range = maximum - minimum;
  const medianAbsoluteDeviation = median(normalized.map((value) => Math.abs(value - middle)));
  return Object.freeze({
    values: Object.freeze(normalized),
    median: middle,
    minimum,
    maximum,
    range,
    rangePercentOfMedian: middle === 0 ? (range === 0 ? 0 : Infinity) : (range / middle) * 100,
    medianAbsoluteDeviation,
    madPercentOfMedian:
      middle === 0
        ? medianAbsoluteDeviation === 0
          ? 0
          : Infinity
        : (medianAbsoluteDeviation / middle) * 100,
  });
}

export interface RegressionResult {
  readonly deltaBytes: number;
  readonly deltaPercent: number;
  readonly exceedsAbsoluteLimit: boolean;
  readonly exceedsPercentLimit: boolean;
  readonly failed: boolean;
}

export function calculateRegression(baselineBytes: number, currentBytes: number): RegressionResult {
  if (
    !Number.isSafeInteger(baselineBytes) ||
    !Number.isSafeInteger(currentBytes) ||
    baselineBytes <= 0 ||
    currentBytes <= 0
  ) {
    throw new Error("[P5_BUNDLE] positive-byte-measurements-required");
  }
  const deltaBytes = currentBytes - baselineBytes;
  const deltaPercent = (deltaBytes / baselineBytes) * 100;
  const exceedsAbsoluteLimit = deltaBytes > ROUTE_REGRESSION_LIMIT.gzipBytes;
  const exceedsPercentLimit = deltaPercent > ROUTE_REGRESSION_LIMIT.percent;
  return Object.freeze({
    deltaBytes,
    deltaPercent,
    exceedsAbsoluteLimit,
    exceedsPercentLimit,
    failed: exceedsAbsoluteLimit || exceedsPercentLimit,
  });
}

export function resolveFixturePath(
  pathTemplate: string,
  fixtureProductId: string | undefined,
): string {
  if (!pathTemplate.includes(":fixtureProductId")) return pathTemplate;
  if (!fixtureProductId || !/^[1-9][0-9]*$/u.test(fixtureProductId)) {
    throw new Error("[P5_FIXTURE] positive-product-id-required");
  }
  return pathTemplate.replace(":fixtureProductId", fixtureProductId);
}

export function assertRepresentativeRouteContract(): void {
  const ids = new Set<string>();
  for (const route of MEASUREMENT_ROUTES) {
    if (ids.has(route.id)) {
      throw new Error("[P5_ROUTE_MATRIX] duplicate-route-identity");
    }
    ids.add(route.id);
  }
  const required = ["landing", "login", "contact", "app-shell", "product-detail"];
  if (required.some((id) => !ids.has(id)) || ids.size !== required.length) {
    throw new Error("[P5_ROUTE_MATRIX] representative-route-drift");
  }
  const paths = new Set(MEASUREMENT_ROUTES.map((route) => route.path));
  if (
    paths.size !== MEASUREMENT_ROUTES.length ||
    MEASUREMENT_ROUTES.some(
      (route) =>
        !route.path.startsWith("/") ||
        route.path.includes("//") ||
        (route.initialJsTargetGzipBytes !== null &&
          (!Number.isSafeInteger(route.initialJsTargetGzipBytes) ||
            route.initialJsTargetGzipBytes <= 0)) ||
        (route.boundary === "authenticated-client-surface") !== route.requiresLocalFixture,
    ) ||
    MEASUREMENT_ROUTES.filter((route) => route.path.includes(":fixtureProductId"))
      .map((route) => route.id)
      .join(",") !== "product-detail" ||
    JSON.stringify(
      LIGHTHOUSE_ROUTES.map(({ id, path, requiresLocalFixture }) => ({
        id,
        path,
        requiresLocalFixture,
      })),
    ) !==
      JSON.stringify(
        MEASUREMENT_ROUTES.map(({ id, path, requiresLocalFixture }) => ({
          id,
          path,
          requiresLocalFixture,
        })),
      )
  ) {
    throw new Error("[P5_ROUTE_MATRIX] representative-route-contract-invalid");
  }
}

export function assertVisualBaselineContract(): void {
  const expectedIds = [
    "landing-390x844",
    "landing-768x1024",
    "landing-1440x900",
    "login-390x844",
    "login-1440x900",
    "app-shell-new-user-390x844",
    "app-shell-new-user-1440x900",
  ];
  const ids = VISUAL_BASELINE_CASES.map((candidate) => candidate.id);
  const filenames = VISUAL_BASELINE_CASES.map((candidate) => candidate.filename);
  if (
    JSON.stringify(ids) !== JSON.stringify(expectedIds) ||
    new Set(filenames).size !== filenames.length ||
    VISUAL_BASELINE_CASES.some(
      (candidate) =>
        candidate.filename !== `p5a0d-${candidate.id}-light-reduced.png` ||
        (candidate.mode === "local-authenticated") !==
          (candidate.fixtureState === "local-authenticated-new-user") ||
        (candidate.routeId === "app-shell") !== (candidate.mode === "local-authenticated"),
    )
  ) {
    throw new Error("[P5_VISUAL] baseline-contract-invalid");
  }
}
