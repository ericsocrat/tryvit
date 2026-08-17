import AxeBuilder from "@axe-core/playwright";

import { expect, test, type Page } from "./fixtures/safe-test";
import {
  DIRECTION_SELECTION_CANDIDATES,
  DIRECTION_SELECTION_STILLS,
  directionSelectionRoute,
  type DirectionSelectionCandidate,
} from "@/../tooling/design-system/direction-selection/capture-contract";
import { PHASE5A2_FIXTURE } from "@/app/dev/phase5a2/_shared/fixture";
import { PHASE5A2_COMMON_MESSAGES } from "@/app/dev/phase5a2/_shared/messages";

const REFLOW_PROFILES = [
  { width: 320, zoom: 1 },
  { width: 640, zoom: 2 },
  { width: 768, zoom: 1 },
  { width: 1024, zoom: 1 },
  { width: 1280, zoom: 1 },
  { width: 1440, zoom: 1 },
] as const;

const TEXT_SPACING_STYLE = `
  [data-phase5a2-candidate], [data-phase5a2-candidate] * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  [data-phase5a2-candidate] p {
    margin-block-end: 2em !important;
  }
`;

const runtimeMarkers = new WeakMap<Page, string[]>();

interface ReviewRoute {
  readonly surface: "identity" | "landing" | "home" | "product" | "scanner" | "motion";
  readonly locale: "en" | "pl" | "de";
  readonly theme: "light" | "dark";
  readonly motion: "full" | "reduced";
  readonly state: string;
}

function behaviorRoute(candidate: DirectionSelectionCandidate, study: ReviewRoute): string {
  const query = new URLSearchParams({
    locale: study.locale,
    theme: study.theme,
    motion: study.motion,
    state: study.state,
    capture: "1",
  });
  return `/dev/phase5a2/${candidate}/${study.surface}?${query.toString()}`;
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function openRoute(
  page: Page,
  candidate: DirectionSelectionCandidate,
  study: ReviewRoute,
  options: Readonly<{
    forcedColors?: "none" | "active";
    osReducedMotion?: "no-preference" | "reduce";
    width?: number;
    height?: number;
  }> = {},
) {
  await page.setViewportSize({
    width: options.width ?? 1440,
    height: options.height ?? 900,
  });
  await page.emulateMedia({
    colorScheme: study.theme,
    forcedColors: options.forcedColors ?? "none",
    reducedMotion: options.osReducedMotion ??
      (study.motion === "reduced" ? "reduce" : "no-preference"),
  });
  const response = await page.goto(behaviorRoute(candidate, study), {
    waitUntil: "domcontentloaded",
  });
  if (!response?.ok()) throw new Error("[P5A2_BEHAVIOR] route-status-invalid");
  const root = page.locator(
    `[data-phase5a2-candidate="${candidate}"][data-phase5a2-surface="${study.surface}"]`,
  );
  await expect(root).toBeAttached();
  await expect(root).toHaveAttribute("data-phase5a2-ready", "true");
  await expect(root).toHaveAttribute("data-phase5a2-state", study.state);
  await expect(root).toHaveAttribute("lang", study.locale);
  await settle(page);
  await expect(
    page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay"),
  ).toHaveCount(0);
  return root;
}

async function assertNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    return Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    ) - viewportWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function assertShellReflow(
  page: Page,
  candidate: DirectionSelectionCandidate,
  surface: ReviewRoute["surface"],
  locale: ReviewRoute["locale"],
): Promise<void> {
  const root = page.locator(
    `[data-phase5a2-candidate="${candidate}"][data-phase5a2-surface="${surface}"]`,
  );
  await expect(root).toHaveAttribute("lang", locale);
  await expect(root.locator("h1:visible")).toHaveCount(1);
  const bounds = await root.evaluate((element) => {
    const rectangle = element.getBoundingClientRect();
    return {
      left: rectangle.left,
      right: rectangle.right,
      width: rectangle.width,
      viewportWidth: window.innerWidth,
    };
  });
  expect(bounds.width).toBeGreaterThan(0);
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  await assertNoPageOverflow(page);
}

async function assertNoClippedText(page: Page): Promise<void> {
  const issue = await page.locator("[data-phase5a2-candidate]").evaluate((root) => {
    const elements = [root, ...root.querySelectorAll<HTMLElement>("*")];
    for (const element of elements) {
      const style = getComputedStyle(element);
      const rectangle = element.getBoundingClientRect();
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        rectangle.width <= 1 ||
        rectangle.height <= 1
      ) continue;
      const hasDirectText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
      ) || element.matches("input, select, textarea");
      if (!hasDirectText) continue;
      const clipsInline = style.overflowX === "hidden" || style.overflowX === "clip";
      const clipsBlock = style.overflowY === "hidden" || style.overflowY === "clip";
      if (clipsInline && element.scrollWidth > element.clientWidth + 1) return "inline";
      if (clipsBlock && element.scrollHeight > element.clientHeight + 1) return "block";
    }
    return null;
  });
  expect(issue).toBeNull();
}

function durationToMilliseconds(value: string): number {
  const normalized = value.trim();
  if (normalized === "0") return 0;
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(ms|s)$/iu.exec(normalized);
  if (!match) return Number.POSITIVE_INFINITY;
  const amount = Number(match[1]);
  return match[2] === "s" ? amount * 1_000 : amount;
}

async function maximumMotionDuration(locator: ReturnType<Page["locator"]>): Promise<number> {
  const durations = await locator.evaluate((element) =>
    [element, ...element.querySelectorAll("*")].flatMap((candidate) => {
      const style = getComputedStyle(candidate);
      return [
        style.animationDuration,
        style.animationDelay,
        style.transitionDuration,
        style.transitionDelay,
      ]
        .flatMap((value) => value.split(","));
    }),
  );
  return Math.max(0, ...durations.map(durationToMilliseconds));
}

async function assertSeriousAxeClean(
  page: Page,
  candidate: DirectionSelectionCandidate,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include(`[data-phase5a2-candidate="${candidate}"]`)
    .analyze();
  const blocking = results.violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id }) => id)
    .sort();
  if (blocking.length > 0) {
    throw new Error(`[P5A2_BEHAVIOR] axe-${blocking.join("-")}`);
  }
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  const markers: string[] = [];
  runtimeMarkers.set(page, markers);
  page.on("pageerror", () => markers.push("pageerror"));
  page.on("console", (message) => {
    if (message.type() === "error") markers.push("console-error");
  });
});

test.afterEach(async ({ page }) => {
  expect(runtimeMarkers.get(page) ?? []).toEqual([]);
});

test("all 21 studies reflow across the bounded viewport and zoom matrix", async ({ page }) => {
  test.setTimeout(180_000);
  expect(DIRECTION_SELECTION_CANDIDATES).toHaveLength(3);
  expect(DIRECTION_SELECTION_STILLS).toHaveLength(21);
  for (const study of DIRECTION_SELECTION_STILLS) {
    await page.setViewportSize({ width: 1440, height: study.height });
    await page.emulateMedia({
      colorScheme: study.theme,
      forcedColors: "none",
      reducedMotion: study.motion === "reduced" ? "reduce" : "no-preference",
    });
    const response = await page.goto(directionSelectionRoute(study.candidate, study), {
      waitUntil: "domcontentloaded",
    });
    if (!response?.ok()) throw new Error("[P5A2_BEHAVIOR] matrix-route-status-invalid");
    await settle(page);

    for (const profile of REFLOW_PROFILES) {
      await page.setViewportSize({ width: profile.width, height: study.height });
      await page.evaluate((zoom) => {
        document.documentElement.style.setProperty("zoom", String(zoom));
      }, profile.zoom);
      await settle(page);
      await assertShellReflow(
        page,
        study.candidate,
        study.surface,
        study.locale,
      );
    }
    await page.evaluate(() => document.documentElement.style.removeProperty("zoom"));
  }
});

test("localized landing survives WCAG text spacing and forced colors preserve semantics", async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const candidate of DIRECTION_SELECTION_CANDIDATES) {
    const landing = await openRoute(
      page,
      candidate,
      { surface: "landing", locale: "pl", theme: "light", motion: "reduced", state: "settled" },
      { width: 320, height: 844 },
    );
    const spacing = await page.addStyleTag({ content: TEXT_SPACING_STYLE });
    await settle(page);
    await expect(landing.locator("h1:visible")).toHaveCount(1);
    await assertNoPageOverflow(page);
    await assertNoClippedText(page);
    await spacing.evaluate((element) => (element as HTMLElement).remove());

    const product = await openRoute(
      page,
      candidate,
      { surface: "product", locale: "en", theme: "light", motion: "reduced", state: "evidence" },
      { forcedColors: "active", osReducedMotion: "reduce", width: 1024, height: 900 },
    );
    expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
    await expect(product.locator("h1:visible")).toHaveCount(1);
    const interactives = product.locator("a:visible, button:visible, input:visible, [role='tab']:visible");
    expect(await interactives.count()).toBeGreaterThan(0);
    expect(await interactives.evaluateAll((elements) => elements.every((element) => {
      const rectangle = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rectangle.width > 1 && rectangle.height > 1 &&
        style.display !== "none" && style.visibility !== "hidden";
    }))).toBe(true);
    const firstTab = product.getByRole("tab").first();
    await firstTab.focus();
    await expect(firstTab).toBeFocused();
    expect(await firstTab.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2;
    })).toBe(true);
    await assertSeriousAxeClean(page, candidate);
  }
});

test("query and OS reduced motion settle immediately with complete content", async ({ page }) => {
  test.setTimeout(90_000);
  for (const candidate of DIRECTION_SELECTION_CANDIDATES) {
    const queryReduced = await openRoute(
      page,
      candidate,
      { surface: "motion", locale: "en", theme: "light", motion: "reduced", state: "complete" },
      { osReducedMotion: "no-preference" },
    );
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))
      .toBe(false);
    expect(await maximumMotionDuration(queryReduced)).toBeLessThanOrEqual(1.01);
    await expect(queryReduced.locator(".phase5a2-motion-stage")).toHaveCount(4);
    expect(await queryReduced.locator(".phase5a2-motion-stage").evaluateAll((stages) =>
      stages.every((stage) => Boolean(stage.textContent?.trim()))
    )).toBe(true);
    await expect(queryReduced.locator('.phase5a2-motion-stage[data-active="true"]'))
      .toHaveCount(1);

    const osReduced = await openRoute(
      page,
      candidate,
      { surface: "motion", locale: "en", theme: "light", motion: "full", state: "complete" },
      { osReducedMotion: "reduce" },
    );
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))
      .toBe(true);
    expect(await maximumMotionDuration(osReduced)).toBeLessThanOrEqual(1.01);
    await expect(osReduced.locator(".phase5a2-motion-stage")).toHaveCount(4);
  }
});

test("V2 lookup, tabs, and scanner preserve controlled keyboard and focus behavior", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const common = PHASE5A2_COMMON_MESSAGES.en;
  const selectAll = process.platform === "darwin" ? "Meta+A" : "Control+A";

  for (const candidate of DIRECTION_SELECTION_CANDIDATES) {
    const home = await openRoute(
      page,
      candidate,
      { surface: "home", locale: "en", theme: "light", motion: "reduced", state: "returning" },
      { osReducedMotion: "no-preference", width: 1024 },
    );
    const lookup = home.getByRole("combobox", { name: common.productLookup.label });
    await lookup.focus();
    await lookup.pressSequentially("North Grain");
    await expect(lookup).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(lookup).toHaveValue(common.fixtureName);
    await expect(lookup).toBeFocused();

    await page.keyboard.press(selectAll);
    await lookup.pressSequentially(PHASE5A2_FIXTURE.ean);
    const popup = page.locator(
      '[data-ds-component="combobox"][data-ds-part="content"][data-state="open"]',
    );
    await expect(popup.getByRole("option")).toHaveCount(1);
    await expect(popup.getByRole("option")).toContainText(PHASE5A2_FIXTURE.ean);
    expect(await maximumMotionDuration(popup)).toBeLessThanOrEqual(1.01);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(lookup).toHaveValue(common.fixtureName);
    await page.keyboard.press("ArrowDown");
    await expect(popup.getByRole("option", { selected: true })).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(lookup).toBeFocused();

    const product = await openRoute(
      page,
      candidate,
      { surface: "product", locale: "en", theme: "light", motion: "reduced", state: "overview" },
      { width: 1024 },
    );
    const tabs = product.getByRole("tab");
    await expect(tabs).toHaveCount(4);
    await tabs.first().focus();
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Space");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tabs.last()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    await expect(product.getByRole("tabpanel").filter({ visible: true })).toHaveCount(1);

    await openRoute(
      page,
      candidate,
      { surface: "scanner", locale: "en", theme: "dark", motion: "full", state: "ready" },
      { osReducedMotion: "no-preference", width: 390, height: 844 },
    );
    let scanner = page.locator("[data-phase5a2-scanner]");
    let action = scanner.locator(".phase5a2-scanner-actions button");
    await action.focus();
    await page.keyboard.press("Enter");
    await expect(scanner).toHaveAttribute("data-phase5a2-state", "recognized");
    await expect(action).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(scanner).toHaveAttribute("data-phase5a2-state", "processing");
    await expect(action).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(scanner).toHaveAttribute("data-phase5a2-state", "ready");
    await expect(action).toBeFocused();

    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(scanner).toHaveAttribute("data-phase5a2-state", "matched", { timeout: 2_000 });
    await expect(action).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(scanner).toHaveAttribute("data-phase5a2-state", "ready");
    await expect(action).toBeFocused();

    await openRoute(
      page,
      candidate,
      { surface: "scanner", locale: "en", theme: "dark", motion: "reduced", state: "not-found" },
      { width: 390, height: 844 },
    );
    scanner = page.locator("[data-phase5a2-scanner]");
    action = scanner.locator(".phase5a2-scanner-actions button");
    await action.focus();
    await page.keyboard.press("Enter");
    const manual = scanner.getByRole("textbox", { name: common.scanner.manualLabel });
    await expect(manual).toBeFocused();
    await page.keyboard.press(selectAll);
    await manual.pressSequentially("111");
    await page.keyboard.press("Enter");
    await expect(scanner.getByRole("alert")).toContainText(common.scanner.manualInvalid);
    await expect(manual).toBeFocused();
    await page.keyboard.press(selectAll);
    await manual.pressSequentially(PHASE5A2_FIXTURE.ean);
    await page.keyboard.press("Enter");
    await expect(scanner).toHaveAttribute("data-phase5a2-state", "matched");
    await expect(scanner.getByRole("button", { name: common.scanner.retry })).toBeFocused();
  }
});

test("motion tolerates repeated focused input without a Chromium long task", async ({ page }) => {
  test.setTimeout(90_000);
  for (const candidate of DIRECTION_SELECTION_CANDIDATES) {
    const motion = await openRoute(
      page,
      candidate,
      { surface: "motion", locale: "en", theme: "light", motion: "full", state: "start" },
      { osReducedMotion: "no-preference" },
    );
    const supported = await page.evaluate(() => {
      if (!PerformanceObserver.supportedEntryTypes.includes("longtask")) return false;
      const state = { count: 0, maximum: 0 };
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration <= 50) continue;
          state.count += 1;
          state.maximum = Math.max(state.maximum, entry.duration);
        }
      });
      observer.observe({ type: "longtask" });
      Reflect.set(window, "__phase5a2LongTaskState", { observer, state });
      return true;
    });
    expect(supported).toBe(true);

    const next = motion.locator(".phase5a2-motion-actions button").nth(1);
    await next.focus();
    for (let index = 0; index < 8; index += 1) {
      const previous = await motion.getAttribute("data-phase5a2-motion-stage");
      await page.keyboard.press("Enter");
      await expect(motion).not.toHaveAttribute("data-phase5a2-motion-stage", previous ?? "");
      await expect(next).toBeFocused();
    }
    await settle(page);
    const longTasks = await page.evaluate(() => {
      const record = Reflect.get(window, "__phase5a2LongTaskState") as
        | { observer: PerformanceObserver; state: { count: number; maximum: number } }
        | undefined;
      if (!record) return { count: -1, maximum: -1 };
      for (const entry of record.observer.takeRecords()) {
        if (entry.duration <= 50) continue;
        record.state.count += 1;
        record.state.maximum = Math.max(record.state.maximum, entry.duration);
      }
      record.observer.disconnect();
      return record.state;
    });
    expect(longTasks).toEqual({ count: 0, maximum: 0 });
  }
});
