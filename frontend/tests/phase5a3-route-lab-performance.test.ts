import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Policy tests live beside the established tooling test suite.
// eslint-disable-next-line no-restricted-imports
import {
  PHASE5A3_ROUTE_LAB_POLICY,
  evaluateRouteMigrationLabGate,
  fiveRunP75,
  type RouteLabSample,
  type RouteMigrationLabGateInput,
} from "../tooling/phase5a3-route-lab-performance";

const methodologyDocument = readFileSync(
  join(process.cwd(), "..", "docs", "PHASE5A3_ROUTE_MIGRATION_LAB_PERFORMANCE.md"),
  "utf8",
);

function sample(
  id: string,
  values: Partial<Omit<RouteLabSample, "id">> = {},
): RouteLabSample {
  return {
    id,
    performance: 0.98,
    lcpMs: 2_200,
    tbtMs: 100,
    cls: 0,
    ttfbMs: 25,
    ...values,
  };
}

function passingInput(): RouteMigrationLabGateInput {
  return {
    mobile: [1, 2, 3, 4, 5].map((index) => sample(`m${index}`)),
    desktop: [1, 2, 3, 4, 5].map((index) =>
      sample(`d${index}`, { performance: 1, lcpMs: 560, tbtMs: 0 }),
    ),
    outlierClassifications: [],
    process: {
      retainedEveryValidSample: true,
      removedSampleCount: 0,
      thresholdsFrozenBeforeMeasurement: true,
      selectiveRerun: false,
    },
    routeJsPassed: true,
  };
}

describe("Phase 5A.3 route-migration lab-performance methodology", () => {
  it("freezes the prospective thresholds and unchanged Route-JS guard", () => {
    expect(PHASE5A3_ROUTE_LAB_POLICY).toMatchObject({
      sampleCountPerProfile: 5,
      mobileLcpMedianMaximumMs: 2_400,
      mobileLcpP75MaximumMs: 2_500,
      tbtMaximumMs: 200,
      clsMaximum: 0.05,
      ttfbMaximumMs: 800,
      mobilePerformanceMedianMinimum: 0.9,
      desktopPerformanceMedianMinimum: 0.95,
      routeJsAbsoluteGrowthBytes: 10_240,
      routeJsRelativeGrowthPercent: 5,
      routeJsRegressionOperator: "or",
      deterministicLabReleaseGate: true,
      fieldCoreWebVitalsClaim: false,
    });
  });

  it("keeps the documentation explicit about lab, field, retention, and Cycle 3", () => {
    expect(methodologyDocument).toContain("deterministic **lab-release gate**");
    expect(methodologyDocument).toMatch(
      /not a claim that a\s+route passes field Core Web Vitals/u,
    );
    expect(methodologyDocument).toContain("Retain every valid sample");
    expect(methodologyDocument).toContain("p75 is defined deterministically as the fourth value");
    expect(methodologyDocument).toContain("No Lighthouse run was repeated");
    expect(methodologyDocument).toContain("| Mobile LCP median | `2218.88 ms` | **PASS** |");
    expect(methodologyDocument).toContain("| Mobile p75 | `2268.47 ms` | **PASS** |");
  });

  it("defines five-run p75 as the fourth ordered sample", () => {
    expect(fiveRunP75([2_218.8841, 2_268.474, 2_172.1459, 2_155.4532, 2_593.4573])).toBe(
      2_268.474,
    );
  });

  it("passes the retained Cycle 3 cohort without hiding its classified outlier", () => {
    const input: RouteMigrationLabGateInput = {
      ...passingInput(),
      mobile: [
        sample("cycle3-1", { lcpMs: 2_218.8841, tbtMs: 107, ttfbMs: 25.256 }),
        sample("cycle3-2", { lcpMs: 2_268.474, tbtMs: 80, ttfbMs: 26.111 }),
        sample("cycle3-3", { lcpMs: 2_172.1459, tbtMs: 80, ttfbMs: 19.116 }),
        sample("cycle3-4", { lcpMs: 2_155.4532, tbtMs: 97, ttfbMs: 17.141 }),
        sample("cycle3-5", {
          performance: 0.97,
          lcpMs: 2_593.4573,
          tbtMs: 82,
          ttfbMs: 19.339,
        }),
      ],
      desktop: [
        sample("cycle3-d1", { performance: 1, lcpMs: 568.1641, tbtMs: 0, ttfbMs: 12.906 }),
        sample("cycle3-d2", { performance: 1, lcpMs: 566.4071, tbtMs: 0, ttfbMs: 12.093 }),
        sample("cycle3-d3", { performance: 1, lcpMs: 566.2279, tbtMs: 0, ttfbMs: 11.254 }),
        sample("cycle3-d4", { performance: 1, lcpMs: 476.9588, tbtMs: 0, ttfbMs: 10.301 }),
        sample("cycle3-d5", { performance: 1, lcpMs: 554.9081, tbtMs: 0, ttfbMs: 20.655 }),
      ],
      outlierClassifications: [
        {
          sampleId: "cycle3-5",
          kind: "shared-runtime-lab-simulation",
          evidence:
            "Observed H1 paint was 127 ms with no observed post-navigation task over 50 ms; Lantern assigned simulated shared-runtime/render-delay work.",
        },
      ],
    };

    const result = evaluateRouteMigrationLabGate(input);
    expect(result.passed).toBe(true);
    expect(result.blockingFailures).toEqual([]);
    expect(result.metrics).toMatchObject({
      mobileLcpMedianMs: 2_218.8841,
      mobileLcpP75Ms: 2_268.474,
      tbtMaximumMs: 107,
      clsMaximum: 0,
      ttfbMaximumMs: 26.111,
    });
    expect(result.visibleMobileLcpOutliers).toHaveLength(1);
    expect(result.visibleMobileLcpOutliers[0]?.sample.lcpMs).toBe(2_593.4573);
  });

  it("blocks when the p75 distribution gate fails", () => {
    const mobile = [2_200, 2_400, 2_510, 2_520, 2_600].map((lcpMs, index) =>
      sample(`m${index}`, { lcpMs }),
    );
    const input: RouteMigrationLabGateInput = {
      ...passingInput(),
      mobile,
      outlierClassifications: mobile
        .filter((item) => item.lcpMs > 2_500)
        .map((item) => ({
          sampleId: item.id,
          kind: "known-non-route-owned" as const,
          evidence: "Classified retained sample.",
        })),
    };
    expect(evaluateRouteMigrationLabGate(input).blockingFailures).toContain(
      "mobile-lcp-p75-above-2500ms",
    );
  });

  it("blocks a classified new route-owned regression even when median and p75 pass", () => {
    const mobile = [...passingInput().mobile];
    mobile[4] = sample("route-outlier", { lcpMs: 2_650 });
    const input: RouteMigrationLabGateInput = {
      ...passingInput(),
      mobile,
      outlierClassifications: [
        {
          sampleId: "route-outlier",
          kind: "route-owned-regression",
          evidence: "Trace and source map bind the task to the migrated route chunk.",
        },
      ],
    };
    expect(evaluateRouteMigrationLabGate(input).blockingFailures).toContain(
      "mobile-lcp-outlier-route-owned:route-outlier",
    );
  });

  it("fails closed when a visible above-2500ms sample lacks classification", () => {
    const mobile = [...passingInput().mobile];
    mobile[4] = sample("unclassified", { lcpMs: 2_650 });
    const input: RouteMigrationLabGateInput = { ...passingInput(), mobile };
    expect(evaluateRouteMigrationLabGate(input).blockingFailures).toContain(
      "mobile-lcp-outlier-unclassified:unclassified",
    );
  });

  it("blocks sample removal, post-measurement threshold changes, and selective reruns", () => {
    const input: RouteMigrationLabGateInput = {
      ...passingInput(),
      process: {
        retainedEveryValidSample: false,
        removedSampleCount: 1,
        thresholdsFrozenBeforeMeasurement: false,
        selectiveRerun: true,
      },
    };
    expect(evaluateRouteMigrationLabGate(input).blockingFailures).toEqual([
      "sample-retention-policy-failed",
      "thresholds-mutated-after-measurement",
      "selective-rerun-forbidden",
    ]);
  });

  it("requires exactly five samples in each profile", () => {
    const input: RouteMigrationLabGateInput = {
      ...passingInput(),
      mobile: passingInput().mobile.slice(0, 4),
    };
    expect(() => evaluateRouteMigrationLabGate(input)).toThrow(
      "mobile-sample-count-must-be-five",
    );
  });
});
