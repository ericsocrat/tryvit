import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures/safe-test";

import {
  GOLDEN_FORCED_COLORS_STILLS,
  GOLDEN_POLISH_MOBILE_STILLS,
  GOLDEN_REFERENCE_IDS,
  GOLDEN_STATE_CAPTURES,
  defaultGoldenState,
} from "@/../tooling/design-system/golden-reference/capture-contract";

function routeFor(
  reference: (typeof GOLDEN_REFERENCE_IDS)[number],
  state: string,
  locale: "en" | "pl" | "de" = "en",
  theme: "light" | "dark" = reference === "scanner" ? "dark" : "light",
): string {
  return `/dev/phase5a2/golden/${reference}?locale=${locale}&theme=${theme}&motion=reduced&state=${state}`;
}

async function admit(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-golden-ready='true']")).toBeVisible();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-golden-client]")].every(
      (element) => element.getAttribute("data-golden-client-ready") === "true",
    ),
  );
}

for (const capture of GOLDEN_STATE_CAPTURES) {
  test(`whole-page Axe · ${capture.reference} · ${capture.state}`, async ({ page }, testInfo) => {
    await admit(page, routeFor(capture.reference, capture.state));
    const results = await new AxeBuilder({ page }).analyze();
    await testInfo.attach("axe-results", {
      body: Buffer.from(JSON.stringify({
        reference: capture.reference,
        state: capture.state,
        violations: results.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.length,
        })),
      })),
      contentType: "application/json",
    });
    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}

for (const capture of GOLDEN_POLISH_MOBILE_STILLS) {
  test(`text spacing · ${capture.reference}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await admit(
      page,
      routeFor(capture.reference, defaultGoldenState(capture.reference), "pl", "light"),
    );
    await page.addStyleTag({
      content: `
        [data-golden-reference], [data-golden-reference] *, [data-ds-portal-root], [data-ds-portal-root] * {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        [data-golden-reference] p, [data-ds-portal-root] p { margin-bottom: 2em !important; }
      `,
    });
    const geometry = await page.locator("[data-golden-reference]").evaluate((root) => ({
      rootOverflow: root.scrollWidth - root.clientWidth,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders: [...root.querySelectorAll<HTMLElement>("*")]
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1))
        .slice(0, 20)
        .map(({ element, rect }) => ({
          tag: element.tagName.toLowerCase(),
          className: element.className,
          text: element.textContent?.trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        })),
    }));
    expect(geometry.documentOverflow, JSON.stringify(geometry.offenders, null, 2)).toBeLessThanOrEqual(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

for (const reference of GOLDEN_REFERENCE_IDS) {
  test(`200-percent equivalent reflow · ${reference}`, async ({ page }) => {
    await page.setViewportSize({ width: 384, height: 844 });
    await admit(page, routeFor(reference, defaultGoldenState(reference)));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

for (const capture of GOLDEN_FORCED_COLORS_STILLS) {
  test(`forced colors · ${capture.reference} · ${capture.state}`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await admit(page, routeFor(capture.reference, capture.state));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const semantics = await page.locator("[data-golden-reference]").evaluate((root) => ({
      state: root.getAttribute("data-golden-state"),
      text: root.textContent?.trim().length ?? 0,
      borders: [...root.querySelectorAll("button, a, input")].filter((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== "none" || style.borderStyle !== "none";
      }).length,
    }));
    expect(semantics.state).toBe(capture.state);
    expect(semantics.text).toBeGreaterThan(100);
    expect(semantics.borders).toBeGreaterThan(0);
    if (capture.reference === "landing" || capture.reference === "home") {
      const essential = capture.reference === "landing"
        ? page.getByRole("link", { name: "Explore the evidence" })
        : page.getByRole("link", { name: "Home", exact: true });
      const forcedStyle = await essential.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          color: style.color,
          forcedColorAdjust: style.forcedColorAdjust,
          label: element.textContent?.trim(),
        };
      });
      expect(forcedStyle.label).toBe(capture.reference === "landing" ? "Explore the evidence" : "Home");
      expect(forcedStyle.forcedColorAdjust).toBe("none");
      expect(forcedStyle.color).not.toBe(forcedStyle.background);
    }
  });
}

test("RTL-sensitive Product Tabs and portal ownership inherit direction", async ({ page }) => {
  await admit(page, routeFor("product", "unknown"));
  await page.locator("[data-golden-reference]").evaluate((root) => {
    root.setAttribute("dir", "rtl");
  });
  const nutrition = page.getByRole("tab", { name: "Nutrition" });
  const ingredients = page.getByRole("tab", { name: "Ingredients" });
  await nutrition.focus();
  await nutrition.press("ArrowLeft");
  await expect(ingredients).toBeFocused();
  await page.getByRole("button", { name: "Open provenance" }).click();
  const dialog = page.getByRole("dialog", { name: "Source and method provenance" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.closest("[data-ds-portal-root]")?.getAttribute("dir"))).toBe("rtl");
});
