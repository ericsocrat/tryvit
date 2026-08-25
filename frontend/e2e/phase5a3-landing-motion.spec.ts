import { writeFile } from "node:fs/promises";

import { expect, test, type Page, type TestInfo } from "./fixtures/safe-test";

type MotionMode = "normal" | "reduced";

interface MotionInterval {
  readonly kind: "animation" | "transition";
  readonly name: string;
  readonly startTimeMs: number;
  endTimeMs: number | null;
}

interface MotionObserverState {
  readonly observerSupport: { longtask: boolean; layoutShift: boolean };
  readonly layoutShifts: Array<{
    startTimeMs: number;
    value: number;
    hadRecentInput: boolean;
  }>;
  readonly longTasks: Array<{ startTimeMs: number; durationMs: number }>;
  readonly motionIntervals: MotionInterval[];
}

interface JourneyCheckpoint {
  readonly name: string;
  readonly timeMs: number;
  readonly scrollY: number;
}

async function installJourneyObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const supported = new Set(PerformanceObserver.supportedEntryTypes ?? []);
    const state: MotionObserverState = {
      observerSupport: { longtask: false, layoutShift: false },
      layoutShifts: [],
      longTasks: [],
      motionIntervals: [],
    };
    Object.defineProperty(globalThis, "__phase5a3JourneyEvidence", {
      configurable: true,
      value: state,
    });

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.longTasks.push({ startTimeMs: entry.startTime, durationMs: entry.duration });
        }
      }).observe({ type: "longtask", buffered: true });
      state.observerSupport.longtask = supported.has("longtask");
    } catch {
      state.observerSupport.longtask = false;
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            readonly value?: number;
            readonly hadRecentInput?: boolean;
          };
          state.layoutShifts.push({
            startTimeMs: entry.startTime,
            value: shift.value ?? 0,
            hadRecentInput: shift.hadRecentInput ?? false,
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
      state.observerSupport.layoutShift = supported.has("layout-shift");
    } catch {
      state.observerSupport.layoutShift = false;
    }

    const beginMotion = (kind: MotionInterval["kind"], name: string) => {
      state.motionIntervals.push({
        kind,
        name,
        startTimeMs: performance.now(),
        endTimeMs: null,
      });
    };
    const endMotion = (kind: MotionInterval["kind"], name: string) => {
      for (let index = state.motionIntervals.length - 1; index >= 0; index -= 1) {
        const interval = state.motionIntervals[index];
        if (interval.kind === kind && interval.name === name && interval.endTimeMs === null) {
          interval.endTimeMs = performance.now();
          return;
        }
      }
    };

    document.addEventListener(
      "animationstart",
      (event) => beginMotion("animation", event.animationName),
      true,
    );
    document.addEventListener(
      "animationend",
      (event) => endMotion("animation", event.animationName),
      true,
    );
    document.addEventListener(
      "animationcancel",
      (event) => endMotion("animation", event.animationName),
      true,
    );
    document.addEventListener(
      "transitionrun",
      (event) => beginMotion("transition", event.propertyName),
      true,
    );
    document.addEventListener(
      "transitionend",
      (event) => endMotion("transition", event.propertyName),
      true,
    );
    document.addEventListener(
      "transitioncancel",
      (event) => endMotion("transition", event.propertyName),
      true,
    );
  });
}

async function recordCheckpoint(
  page: Page,
  checkpoints: JourneyCheckpoint[],
  name: string,
): Promise<number> {
  const checkpoint = await page.evaluate((checkpointName) => ({
    name: checkpointName,
    timeMs: performance.now(),
    scrollY: window.scrollY,
  }), name);
  checkpoints.push(checkpoint);
  return checkpoint.scrollY;
}

async function assertFullyInViewport(page: Page, selector: string): Promise<void> {
  const bounds = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
}

async function collectJourneyEvidence(page: Page) {
  return page.evaluate(() => {
    const state = (
      globalThis as typeof globalThis & {
        __phase5a3JourneyEvidence?: MotionObserverState;
      }
    ).__phase5a3JourneyEvidence;
    if (!state) throw new Error("[P5A3_MOTION] observer-state-missing");

    const observationEndTimeMs = performance.now();
    const motionIntervals = state.motionIntervals.map((interval) => ({
      ...interval,
      endTimeMs: interval.endTimeMs ?? observationEndTimeMs,
    }));
    const overlapsMotion = (startTimeMs: number, endTimeMs: number) =>
      motionIntervals.some(
        (interval) => startTimeMs < interval.endTimeMs && endTimeMs > interval.startTimeMs,
      );
    const animationAttributableLongTasks = state.longTasks.filter((task) =>
      overlapsMotion(task.startTimeMs, task.startTimeMs + task.durationMs),
    );
    const animationAttributableLayoutShifts = state.layoutShifts.filter(
      (shift) =>
        !shift.hadRecentInput && overlapsMotion(shift.startTimeMs, shift.startTimeMs + 0.001),
    );

    return {
      observerSupport: state.observerSupport,
      observationStartTimeMs: 0,
      observationEndTimeMs,
      cls: state.layoutShifts
        .filter((shift) => !shift.hadRecentInput)
        .reduce((total, shift) => total + shift.value, 0),
      layoutShifts: state.layoutShifts,
      longTasks: state.longTasks,
      motionIntervals,
      animationAttributableLayoutShifts,
      animationAttributableLongTasks,
      terminalState: {
        theme: document.documentElement.dataset.theme,
        narrativeExpanded: document
          .querySelector('main button[aria-expanded]')
          ?.getAttribute("aria-expanded"),
        focusedText: document.activeElement?.textContent?.trim() ?? "",
        focusedHref:
          document.activeElement instanceof HTMLAnchorElement
            ? document.activeElement.getAttribute("href")
            : null,
      },
    };
  });
}

async function runJourney(page: Page, motion: MotionMode) {
  const checkpoints: JourneyCheckpoint[] = [];
  const dwell = motion === "reduced" ? 120 : 420;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US" });
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await installJourneyObservers(page);
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: motion === "reduced" ? "reduce" : "no-preference",
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveAttribute("data-provider-boundary", "landing");
  await expect(page).toHaveTitle("TryVit — Food intelligence you can inspect");
  await expect(page.locator('[data-landing-shell="folded-label-register"]')).toBeVisible();
  await expect(page.locator('main[data-route-id="public-landing"]')).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  expect(
    await page.evaluate(
      (reduced) => matchMedia("(prefers-reduced-motion: reduce)").matches === reduced,
      motion === "reduced",
    ),
  ).toBe(true);
  await recordCheckpoint(page, checkpoints, "first-viewport");
  await page.waitForTimeout(dwell);

  const initialScroll = await page.evaluate(() => window.scrollY);
  const theme = page.getByRole("button", { name: "Use dark theme" });
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Use light theme" })).toBeVisible();
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - initialScroll)).toBeLessThanOrEqual(1);
  await recordCheckpoint(page, checkpoints, "dark-theme");
  await page.waitForTimeout(dwell);

  const narrative = page.getByRole("region", { name: "Unfold the evidence" });
  const narrativeButton = narrative.getByRole("button");
  await expect(narrativeButton).toHaveAttribute("aria-expanded", "false");
  await narrativeButton.scrollIntoViewIfNeeded();
  await expect(narrativeButton).toBeInViewport();
  const narrativeScroll = await page.evaluate(() => window.scrollY);
  await narrativeButton.click();
  await expect(narrativeButton).toHaveAttribute("aria-expanded", "true");
  await expect(narrativeButton).toHaveText("Fold back to source");
  await expect(narrative.locator('li[data-active="true"]')).toHaveCount(5);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - narrativeScroll)).toBeLessThanOrEqual(
    1,
  );
  await recordCheckpoint(page, checkpoints, "package-expanded");
  await page.waitForTimeout(motion === "reduced" ? 120 : 650);

  let previousScroll = await page.evaluate(() => window.scrollY);
  const journeyStops = [
    ["evidence", "#evidence-title"],
    ["method", "#method"],
    ["trust", "#trust"],
    ["final-action", "#landing-final-title"],
    ["footer", "footer"],
  ] as const;
  for (const [name, selector] of journeyStops) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await expect(page.locator(selector)).toBeInViewport();
    const currentScroll = await recordCheckpoint(page, checkpoints, name);
    expect(currentScroll + 1).toBeGreaterThanOrEqual(previousScroll);
    previousScroll = currentScroll;
    await page.waitForTimeout(dwell);
  }

  await expect(page.getByRole("heading", { name: "Method before mystique" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Private before personal" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Start with the question—not a verdict." }),
  ).toBeVisible();
  await assertFullyInViewport(page, "footer");
  await expect(
    page.getByText("Food intelligence with confidence, provenance, and unknowns kept visible."),
  ).toBeVisible();

  const footerNavigation = page.getByRole("navigation", { name: "Footer navigation" });
  const footerContact = footerNavigation.getByRole("link", { name: "Contact", exact: true });
  await footerContact.focus();
  await page.keyboard.press("Tab");
  const terminalLink = footerNavigation.getByRole("link", { name: "Demo mode", exact: true });
  await expect(terminalLink).toBeFocused();
  await expect(terminalLink).toHaveAttribute("href", "#service-status");
  expect(await terminalLink.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(narrativeButton).toHaveAttribute("aria-expanded", "true");
  await recordCheckpoint(page, checkpoints, "terminal-focus");
  await page.waitForTimeout(dwell);

  const evidence = await collectJourneyEvidence(page);
  expect(evidence.observerSupport).toEqual({ longtask: true, layoutShift: true });
  expect(evidence.cls).toBeLessThanOrEqual(0.05);
  expect(
    evidence.animationAttributableLayoutShifts.reduce(
      (total, shift) => total + shift.value,
      0,
    ),
  ).toBe(0);
  expect(evidence.animationAttributableLongTasks.filter((task) => task.durationMs > 50)).toEqual(
    [],
  );

  return { motion, checkpoints, ...evidence };
}

test("records equivalent complete normal and reduced-motion landing journeys", async ({ context, page }, testInfo: TestInfo) => {
  test.setTimeout(180_000);
  const runs: Awaited<ReturnType<typeof runJourney>>[] = [];

  const normalVideo = page.video();
  expect(normalVideo).not.toBeNull();
  runs.push(await runJourney(page, "normal"));
  await page.close();
  await normalVideo!.saveAs(testInfo.outputPath("landing--normal--390x844--en.webm"));

  const reducedPage = await context.newPage();
  const reducedVideo = reducedPage.video();
  expect(reducedVideo).not.toBeNull();
  runs.push(await runJourney(reducedPage, "reduced"));
  await reducedPage.close();
  await reducedVideo!.saveAs(testInfo.outputPath("landing--reduced--390x844--en.webm"));

  const expectedCheckpoints = [
    "first-viewport",
    "dark-theme",
    "package-expanded",
    "evidence",
    "method",
    "trust",
    "final-action",
    "footer",
    "terminal-focus",
  ];
  for (const run of runs) {
    expect(run.checkpoints.map(({ name }) => name)).toEqual(expectedCheckpoints);
  }
  await writeFile(
    testInfo.outputPath("landing-motion-performance.json"),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        kind: "phase5a3-complete-landing-motion-evidence",
        viewport: { width: 390, height: 844 },
        runs,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
});
