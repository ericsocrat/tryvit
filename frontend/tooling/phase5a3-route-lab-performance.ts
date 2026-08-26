export const PHASE5A3_ROUTE_LAB_POLICY = Object.freeze({
  sampleCountPerProfile: 5,
  mobileLcpMedianMaximumMs: 2_400,
  mobileLcpP75MaximumMs: 2_500,
  tbtMaximumMs: 200,
  clsMaximum: 0.05,
  ttfbMaximumMs: 800,
  mobilePerformanceMedianMinimum: 0.9,
  desktopPerformanceMedianMinimum: 0.95,
  routeJsAbsoluteGrowthBytes: 10 * 1024,
  routeJsRelativeGrowthPercent: 5,
  routeJsRegressionOperator: "or",
  deterministicLabReleaseGate: true,
  fieldCoreWebVitalsClaim: false,
} as const);

export type LabOutlierClassificationKind =
  | "route-owned-regression"
  | "shared-runtime-lab-simulation"
  | "environmental-lab-variance"
  | "known-non-route-owned";

export interface RouteLabSample {
  readonly id: string;
  readonly performance: number;
  readonly lcpMs: number;
  readonly tbtMs: number;
  readonly cls: number;
  readonly ttfbMs: number;
}

export interface LabOutlierClassification {
  readonly sampleId: string;
  readonly kind: LabOutlierClassificationKind;
  readonly evidence: string;
}

export interface RouteLabProcessAttestation {
  readonly retainedEveryValidSample: boolean;
  readonly removedSampleCount: number;
  readonly thresholdsFrozenBeforeMeasurement: boolean;
  readonly selectiveRerun: boolean;
}

export interface RouteMigrationLabGateInput {
  readonly mobile: readonly RouteLabSample[];
  readonly desktop: readonly RouteLabSample[];
  readonly outlierClassifications: readonly LabOutlierClassification[];
  readonly process: RouteLabProcessAttestation;
  readonly routeJsPassed: boolean;
}

export interface RouteMigrationLabGateEvaluation {
  readonly passed: boolean;
  readonly blockingFailures: readonly string[];
  readonly metrics: Readonly<{
    mobilePerformanceMedian: number;
    desktopPerformanceMedian: number;
    mobileLcpMedianMs: number;
    mobileLcpP75Ms: number;
    tbtMaximumMs: number;
    clsMaximum: number;
    ttfbMaximumMs: number;
  }>;
  readonly visibleMobileLcpOutliers: readonly Readonly<{
    sample: RouteLabSample;
    classification: LabOutlierClassification | null;
  }>[];
}

function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`[P5A3_ROUTE_LAB] invalid-${label}`);
  }
  return value;
}

function validateSamples(samples: readonly RouteLabSample[], profile: "mobile" | "desktop"): void {
  if (samples.length !== PHASE5A3_ROUTE_LAB_POLICY.sampleCountPerProfile) {
    throw new Error(`[P5A3_ROUTE_LAB] ${profile}-sample-count-must-be-five`);
  }
  if (new Set(samples.map((sample) => sample.id)).size !== samples.length) {
    throw new Error(`[P5A3_ROUTE_LAB] ${profile}-sample-id-duplicate`);
  }
  for (const sample of samples) {
    finiteNumber(sample.performance, `${profile}-performance`);
    finiteNumber(sample.lcpMs, `${profile}-lcp`);
    finiteNumber(sample.tbtMs, `${profile}-tbt`);
    finiteNumber(sample.cls, `${profile}-cls`);
    finiteNumber(sample.ttfbMs, `${profile}-ttfb`);
    if (sample.performance > 1 || sample.cls > 1) {
      throw new Error(`[P5A3_ROUTE_LAB] invalid-${profile}-normalized-metric`);
    }
  }
}

function sortedMetric(
  samples: readonly RouteLabSample[],
  metric: "performance" | "lcpMs",
): number[] {
  return samples.map((sample) => sample[metric]).toSorted((left, right) => left - right);
}

function fiveRunMedian(values: readonly number[]): number {
  if (values.length !== 5) throw new Error("[P5A3_ROUTE_LAB] median-requires-five-values");
  return values.toSorted((left, right) => left - right)[2];
}

/** For exactly five retained samples, p75 is the fourth ordered value. */
export function fiveRunP75(values: readonly number[]): number {
  if (values.length !== 5) throw new Error("[P5A3_ROUTE_LAB] p75-requires-five-values");
  return values.toSorted((left, right) => left - right)[3];
}

export function evaluateRouteMigrationLabGate(
  input: RouteMigrationLabGateInput,
): RouteMigrationLabGateEvaluation {
  validateSamples(input.mobile, "mobile");
  validateSamples(input.desktop, "desktop");

  const allSamples = [...input.mobile, ...input.desktop];
  const mobileLcp = sortedMetric(input.mobile, "lcpMs");
  const metrics = Object.freeze({
    mobilePerformanceMedian: fiveRunMedian(sortedMetric(input.mobile, "performance")),
    desktopPerformanceMedian: fiveRunMedian(sortedMetric(input.desktop, "performance")),
    mobileLcpMedianMs: fiveRunMedian(mobileLcp),
    mobileLcpP75Ms: fiveRunP75(mobileLcp),
    tbtMaximumMs: Math.max(...allSamples.map((sample) => sample.tbtMs)),
    clsMaximum: Math.max(...allSamples.map((sample) => sample.cls)),
    ttfbMaximumMs: Math.max(...allSamples.map((sample) => sample.ttfbMs)),
  });
  const blockingFailures: string[] = [];

  if (!input.process.retainedEveryValidSample || input.process.removedSampleCount !== 0) {
    blockingFailures.push("sample-retention-policy-failed");
  }
  if (!input.process.thresholdsFrozenBeforeMeasurement) {
    blockingFailures.push("thresholds-mutated-after-measurement");
  }
  if (input.process.selectiveRerun) blockingFailures.push("selective-rerun-forbidden");
  if (metrics.mobileLcpMedianMs > PHASE5A3_ROUTE_LAB_POLICY.mobileLcpMedianMaximumMs) {
    blockingFailures.push("mobile-lcp-median-above-2400ms");
  }
  if (metrics.mobileLcpP75Ms > PHASE5A3_ROUTE_LAB_POLICY.mobileLcpP75MaximumMs) {
    blockingFailures.push("mobile-lcp-p75-above-2500ms");
  }
  if (metrics.tbtMaximumMs > PHASE5A3_ROUTE_LAB_POLICY.tbtMaximumMs) {
    blockingFailures.push("tbt-maximum-above-200ms");
  }
  if (metrics.clsMaximum > PHASE5A3_ROUTE_LAB_POLICY.clsMaximum) {
    blockingFailures.push("cls-maximum-above-0.05");
  }
  if (metrics.ttfbMaximumMs > PHASE5A3_ROUTE_LAB_POLICY.ttfbMaximumMs) {
    blockingFailures.push("ttfb-maximum-above-800ms");
  }
  if (
    metrics.mobilePerformanceMedian <
    PHASE5A3_ROUTE_LAB_POLICY.mobilePerformanceMedianMinimum
  ) {
    blockingFailures.push("mobile-performance-median-below-0.90");
  }
  if (
    metrics.desktopPerformanceMedian <
    PHASE5A3_ROUTE_LAB_POLICY.desktopPerformanceMedianMinimum
  ) {
    blockingFailures.push("desktop-performance-median-below-0.95");
  }
  if (!input.routeJsPassed) blockingFailures.push("route-js-regression-failed");

  const classifications = new Map<string, LabOutlierClassification>();
  for (const classification of input.outlierClassifications) {
    if (classifications.has(classification.sampleId)) {
      throw new Error("[P5A3_ROUTE_LAB] outlier-classification-duplicate");
    }
    classifications.set(classification.sampleId, classification);
  }
  const visibleMobileLcpOutliers = input.mobile
    .filter((sample) => sample.lcpMs > PHASE5A3_ROUTE_LAB_POLICY.mobileLcpP75MaximumMs)
    .map((sample) => {
      const classification = classifications.get(sample.id) ?? null;
      if (!classification || classification.evidence.trim().length === 0) {
        blockingFailures.push(`mobile-lcp-outlier-unclassified:${sample.id}`);
      } else if (classification.kind === "route-owned-regression") {
        blockingFailures.push(`mobile-lcp-outlier-route-owned:${sample.id}`);
      }
      return Object.freeze({ sample, classification });
    });

  return Object.freeze({
    passed: blockingFailures.length === 0,
    blockingFailures: Object.freeze(blockingFailures),
    metrics,
    visibleMobileLcpOutliers: Object.freeze(visibleMobileLcpOutliers),
  });
}
