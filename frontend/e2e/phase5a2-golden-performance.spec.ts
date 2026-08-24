import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { expect, test, type Page } from "./fixtures/safe-test";
import {
  goldenOutputPath,
  openGoldenCapture,
} from "./helpers/phase5a2-golden-reference";
import {
  GOLDEN_FONT_TRANSFER_LIMIT_BYTES,
  GOLDEN_REFERENCE_IDS,
  defaultGoldenState,
} from "@/../tooling/design-system/golden-reference/capture-contract";

const SAMPLE_COUNT = 5;
const BUILD_ROOT = realpathSync.native(path.join(process.cwd(), ".next"));

interface GoldenPerformanceObserverState {
  lcpMs: number;
  cls: number;
  longTasks: Array<{ startTimeMs: number; durationMs: number }>;
  motionIntervals: Array<{
    kind: "animation" | "transition";
    name: string;
    startTimeMs: number;
    endTimeMs: number | null;
  }>;
}

interface ResourceEntry {
  readonly name: string;
  readonly initiatorType: string;
  readonly encodedBodySize: number;
  readonly decodedBodySize: number;
  readonly transferSize: number;
}

interface ValidSample {
  readonly reference: (typeof GOLDEN_REFERENCE_IDS)[number];
  readonly sample: number;
  readonly status: "valid";
  readonly routeJsGzipBytes: number;
  readonly cssGzipBytes: number;
  readonly fontBytes: number;
  readonly imageBytes: number;
  readonly lcpMs: number;
  readonly tbtMs: number;
  readonly ttfbMs: number;
  readonly cls: number;
  readonly longTasks: readonly { startTimeMs: number; durationMs: number }[];
  readonly motionIntervals: readonly { kind: string; name: string; startTimeMs: number; endTimeMs: number }[];
  readonly animationAttributableLongTasks: readonly { startTimeMs: number; durationMs: number }[];
  readonly maximumLongTaskMs: number;
  readonly maximumAnimationLongTaskMs: number;
  readonly jsAssets: readonly { path: string; rawBytes: number; gzipBytes: number }[];
  readonly cssAssets: readonly { path: string; rawBytes: number; gzipBytes: number }[];
}

type PerformanceAttempt = ValidSample | Readonly<{
  reference: (typeof GOLDEN_REFERENCE_IDS)[number];
  sample: number;
  status: "failed-before-valid-measurement";
  failure: string;
}>;

const SERVER_CLIENT_BOUNDARY = Object.freeze({
  landing: "Server-rendered identity, value, method, trust, evidence and actions; one package-label narrative island.",
  authentication: "Server-rendered editorial trust panel and localized view model; one bounded form/state island.",
  home: "Server-rendered decision, recovery and navigation structure; one bounded decision-action island.",
  search: "Server-rendered header and synthetic fixture view model; one bounded query/filter/results island.",
  product: "Server-rendered identity, evidence spine, decision and tabs; one bounded provenance/comparison island.",
  scanner: "Server-rendered safety framing and localized view model; one bounded deterministic scanner-state island with zero camera calls.",
} as const);

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function pathIsWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function compressedAssets(
  resources: readonly ResourceEntry[],
  extension: ".js" | ".css",
): readonly { path: string; rawBytes: number; gzipBytes: number }[] {
  const paths = [...new Set(resources
    .map(({ name }) => decodeURIComponent(new URL(name).pathname))
    .filter((pathname) => pathname.startsWith("/_next/static/") && pathname.endsWith(extension)))]
    .sort();
  return paths.map((pathname) => {
    const filename = path.resolve(BUILD_ROOT, pathname.slice("/_next/".length));
    if (!pathIsWithin(BUILD_ROOT, filename) || !existsSync(filename)) {
      throw new Error("[P5A2_GOLDEN_PERF] build-asset-invalid");
    }
    const contents = readFileSync(filename);
    return {
      path: pathname,
      rawBytes: contents.length,
      gzipBytes: gzipSync(contents, { level: 9 }).length,
    };
  });
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function summary(values: readonly number[]) {
  if (values.length !== SAMPLE_COUNT || values.some((value) => !Number.isFinite(value))) {
    throw new Error("[P5A2_GOLDEN_PERF] summary-input-invalid");
  }
  const ordered = [...values].sort((left, right) => left - right);
  return Object.freeze({
    median: ordered[Math.floor(ordered.length / 2)],
    range: Object.freeze({ minimum: ordered[0], maximum: ordered.at(-1) }),
  });
}

async function installPerformanceObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state: GoldenPerformanceObserverState = {
      lcpMs: 0,
      cls: 0,
      longTasks: [],
      motionIntervals: [],
    };
    Object.defineProperty(window, "__phase5a2GoldenPerformance", {
      configurable: true,
      value: state,
    });
    const observe = (type: string, handler: (entry: PerformanceEntry) => void) => {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(handler);
        });
        observer.observe({ buffered: true, type });
      } catch {
        // Unsupported entry types remain zero and fail closed in the report gate.
      }
    };
    observe("largest-contentful-paint", (entry) => { state.lcpMs = entry.startTime; });
    observe("layout-shift", (entry) => {
      const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
      if (!shift.hadRecentInput) state.cls += shift.value ?? 0;
    });
    observe("longtask", (entry) => {
      state.longTasks.push({ startTimeMs: entry.startTime, durationMs: entry.duration });
    });
    const beginMotion = (kind: "animation" | "transition", name: string) => {
      state.motionIntervals.push({ kind, name, startTimeMs: performance.now(), endTimeMs: null });
    };
    const endMotion = (kind: "animation" | "transition", name: string) => {
      for (let index = state.motionIntervals.length - 1; index >= 0; index -= 1) {
        const interval = state.motionIntervals[index];
        if (interval.kind === kind && interval.name === name && interval.endTimeMs === null) {
          interval.endTimeMs = performance.now();
          return;
        }
      }
    };
    document.addEventListener("animationstart", (event) => beginMotion("animation", event.animationName), true);
    document.addEventListener("animationend", (event) => endMotion("animation", event.animationName), true);
    document.addEventListener("animationcancel", (event) => endMotion("animation", event.animationName), true);
    document.addEventListener("transitionrun", (event) => beginMotion("transition", event.propertyName), true);
    document.addEventListener("transitionend", (event) => endMotion("transition", event.propertyName), true);
    document.addEventListener("transitioncancel", (event) => endMotion("transition", event.propertyName), true);
  });
}

async function collectBrowserMeasurement(page: Page) {
  return page.evaluate(() => {
    const state = (window as typeof window & {
      __phase5a2GoldenPerformance?: GoldenPerformanceObserverState;
    }).__phase5a2GoldenPerformance;
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType("resource").map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        name: resource.name,
        initiatorType: resource.initiatorType,
        encodedBodySize: resource.encodedBodySize,
        decodedBodySize: resource.decodedBodySize,
        transferSize: resource.transferSize,
      };
    });
    return {
      cls: state?.cls ?? -1,
      lcpMs: state?.lcpMs ?? -1,
      longTasks: state?.longTasks ?? [],
      motionIntervals: (state?.motionIntervals ?? []).map((interval) => ({
        ...interval,
        endTimeMs: interval.endTimeMs ?? performance.now(),
      })),
      resources,
      ttfbMs: navigation?.responseStart ?? -1,
    };
  });
}

test("retains five source-matched performance samples for every Golden Reference", async ({ browser, page }) => {
  test.setTimeout(600_000);
  const sourceSha = process.env.PHASE5A2_GOLDEN_SOURCE_SHA ?? "";
  const sourceTreeSha = process.env.PHASE5A2_GOLDEN_SOURCE_TREE_SHA ?? "";
  if (!/^[0-9a-f]{40}$/u.test(sourceSha) || !/^[0-9a-f]{40}$/u.test(sourceTreeSha)) {
    throw new Error("[P5A2_GOLDEN_PERF] source-provenance-invalid");
  }
  await installPerformanceObservers(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const attempts: PerformanceAttempt[] = [];

  for (const reference of GOLDEN_REFERENCE_IDS) {
    for (let sample = 1; sample <= SAMPLE_COUNT; sample += 1) {
      try {
        await cdp.send("Network.clearBrowserCache");
        await openGoldenCapture(page, {
          reference,
          width: 390,
          height: 844,
          locale: "en",
          theme: reference === "scanner" ? "dark" : "light",
          motion: "full",
          state: defaultGoldenState(reference),
        });
        const measured = await collectBrowserMeasurement(page);
        const jsAssets = compressedAssets(measured.resources, ".js");
        const cssAssets = compressedAssets(measured.resources, ".css");
        const longTasks = measured.longTasks.map(({ startTimeMs, durationMs }) => ({
          startTimeMs: round(startTimeMs),
          durationMs: round(durationMs),
        }));
        const motionIntervals = measured.motionIntervals.map(({ kind, name, startTimeMs, endTimeMs }) => ({
          kind,
          name,
          startTimeMs: round(startTimeMs),
          endTimeMs: round(endTimeMs),
        }));
        const animationAttributableLongTasks = longTasks.filter((task) => motionIntervals.some(
          (interval) =>
            task.startTimeMs < interval.endTimeMs &&
            task.startTimeMs + task.durationMs > interval.startTimeMs,
        ));
        attempts.push({
          reference,
          sample,
          status: "valid",
          routeJsGzipBytes: sum(jsAssets.map(({ gzipBytes }) => gzipBytes)),
          cssGzipBytes: sum(cssAssets.map(({ gzipBytes }) => gzipBytes)),
          fontBytes: sum(measured.resources
            .filter(({ initiatorType, name }) => initiatorType === "font" || /\.(?:woff2?|ttf|otf)(?:\?|$)/iu.test(name))
            .map(({ encodedBodySize }) => encodedBodySize)),
          imageBytes: sum(measured.resources
            .filter(({ initiatorType, name }) => initiatorType === "img" || /\.(?:avif|gif|jpe?g|png|webp)(?:\?|$)/iu.test(name))
            .map(({ encodedBodySize }) => encodedBodySize)),
          lcpMs: round(measured.lcpMs),
          tbtMs: round(sum(longTasks.map(({ durationMs }) => Math.max(0, durationMs - 50)))),
          ttfbMs: round(measured.ttfbMs),
          cls: round(measured.cls),
          longTasks,
          motionIntervals,
          animationAttributableLongTasks,
          maximumLongTaskMs: round(Math.max(0, ...longTasks.map(({ durationMs }) => durationMs))),
          maximumAnimationLongTaskMs: round(Math.max(0, ...animationAttributableLongTasks.map(({ durationMs }) => durationMs))),
          jsAssets,
          cssAssets,
        });
      } catch (error) {
        attempts.push({
          reference,
          sample,
          status: "failed-before-valid-measurement",
          failure: error instanceof Error ? error.message : "unknown-measurement-failure",
        });
      }
    }
  }

  const valid = attempts.filter((attempt): attempt is ValidSample => attempt.status === "valid");
  const summaries = GOLDEN_REFERENCE_IDS.map((reference) => {
    const samples = valid.filter((sample) => sample.reference === reference);
    if (samples.length !== SAMPLE_COUNT) return { reference, status: "incomplete" as const };
    return {
      reference,
      status: "complete" as const,
      serverClientBoundary: SERVER_CLIENT_BOUNDARY[reference],
      routeJsGzipBytes: summary(samples.map(({ routeJsGzipBytes }) => routeJsGzipBytes)),
      cssGzipBytes: summary(samples.map(({ cssGzipBytes }) => cssGzipBytes)),
      fontBytes: summary(samples.map(({ fontBytes }) => fontBytes)),
      imageBytes: summary(samples.map(({ imageBytes }) => imageBytes)),
      lcpMs: summary(samples.map(({ lcpMs }) => lcpMs)),
      tbtMs: summary(samples.map(({ tbtMs }) => tbtMs)),
      ttfbMs: summary(samples.map(({ ttfbMs }) => ttfbMs)),
      cls: summary(samples.map(({ cls }) => cls)),
      maximumLongTaskMs: summary(samples.map(({ maximumLongTaskMs }) => maximumLongTaskMs)),
      maximumAnimationLongTaskMs: summary(samples.map(({ maximumAnimationLongTaskMs }) => maximumAnimationLongTaskMs)),
    };
  });
  const failures = valid.flatMap((sample) => {
    const sampleFailures: string[] = [];
    if (!(sample.lcpMs > 0 && sample.lcpMs <= 2_500)) sampleFailures.push(`${sample.reference}-${sample.sample}-lcp`);
    if (sample.tbtMs > 200) sampleFailures.push(`${sample.reference}-${sample.sample}-tbt`);
    if (sample.ttfbMs < 0 || sample.ttfbMs > 800) sampleFailures.push(`${sample.reference}-${sample.sample}-ttfb`);
    if (sample.cls > (sample.reference === "landing" ? 0.05 : 0.1)) sampleFailures.push(`${sample.reference}-${sample.sample}-cls`);
    if (sample.maximumAnimationLongTaskMs > 50) sampleFailures.push(`${sample.reference}-${sample.sample}-animation-long-task`);
    if (sample.fontBytes > GOLDEN_FONT_TRANSFER_LIMIT_BYTES) sampleFailures.push(`${sample.reference}-${sample.sample}-font-bytes`);
    return sampleFailures;
  });
  if (valid.length !== GOLDEN_REFERENCE_IDS.length * SAMPLE_COUNT) failures.push("valid-sample-count");

  const report = {
    schemaVersion: 1,
    kind: "phase5a2-golden-reference-performance",
    sourceSha,
    sourceTreeSha,
    reviewOnly: true,
    productionCoreWebVitals: false,
    methodology: {
      profile: "Playwright Chromium · 390x844 CSS px · local production build · cache disabled · full motion",
      samplesPerReference: SAMPLE_COUNT,
      lcp: "Buffered LargestContentfulPaint entries in the guarded review environment.",
      cls: "LayoutShift values without recent input in the guarded review environment.",
      tbt: "Sum of observed main-thread long-task duration above 50ms; not field INP.",
      ttfb: "PerformanceNavigationTiming.responseStart from navigation start.",
      assets: "Unique requested Next.js JS/CSS build assets compressed locally with gzip level 9; font/image payloads use encodedBodySize.",
      animationCoverage: "CSS animation/transition intervals are retained and overlapped with every long task; only overlapping tasks are classified animation-attributable.",
    },
    runtime: { browserName: "chromium", browserVersion: browser.version(), nodeVersion: process.version, platform: process.platform, architecture: process.arch },
    targets: { lcpMsMaximum: 2_500, tbtMsMaximum: 200, landingClsMaximum: 0.05, otherClsMaximum: 0.1, ttfbMsMaximum: 800, animationTaskMsMaximum: 50, candidateFontBytesMaximum: GOLDEN_FONT_TRANSFER_LIMIT_BYTES },
    conservativeProductionConstraint: { appMobileScoreBaseline: 0.83, target: 0.85, retainedTbtSampleMs: 538, laterStableObservation: 0.87, disposition: "debt-retained; production migration prohibited" },
    attempts,
    summaries,
    failures,
  };
  writeFileSync(goldenOutputPath("performance.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  expect(failures).toEqual([]);
});
