import { expect, test, type Page, type TestInfo } from "@playwright/test";

type GoldenReference =
  | "landing"
  | "authentication"
  | "home"
  | "search"
  | "product"
  | "scanner";

function goldenPath(
  reference: GoldenReference,
  state: string,
  motion: "full" | "reduced" = "full",
): string {
  return `/dev/phase5a2/golden/${reference}?locale=en&theme=${reference === "scanner" ? "dark" : "light"}&motion=${motion}&state=${state}`;
}

async function openGolden(
  page: Page,
  reference: GoldenReference,
  state: string,
  testInfo: TestInfo,
  motion: "full" | "reduced" = "full",
) {
  const response = await page.goto(goldenPath(reference, state, motion));
  expect(response?.status()).toBe(200);
  const root = page.locator(`[data-golden-reference="${reference}"]`);
  await expect(root).toHaveAttribute("data-golden-ready", "true");
  await expect(root).toHaveAttribute("data-golden-state", state);
  await expect(root).toHaveAttribute("data-motion", motion);
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-golden-client]")].every(
      (element) => element.getAttribute("data-golden-client-ready") === "true",
    ),
  );
  if (process.env.PHASE5A2_GOLDEN_PREVIEW === "1" && testInfo.project.name.endsWith("chromium")) {
    await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${reference}.png`) });
  }
  return root;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = { calls: 0 };
    Object.defineProperty(window, "__goldenMediaCalls", { value: state });
    if (navigator.mediaDevices?.getUserMedia) {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: () => {
          state.calls += 1;
          throw new Error("Golden Reference attempted real camera access");
        },
      });
    }
  });
});

test("landing preserves SSR meaning and reduced-motion equivalence", async ({ browserName, page }, testInfo) => {
  await openGolden(page, "landing", "ready", testInfo);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Read the package");
  const skip = page.getByRole("link", { name: "Skip to reference" });
  if (browserName === "webkit") {
    await skip.focus();
    await skip.press("Enter");
  } else {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await skip.click();
  }
  await expect(page.locator("#golden-main")).toBeFocused();
  const unfold = page.getByRole("button", { name: "Unfold the evidence" });
  await unfold.click();
  await expect(page.getByRole("button", { name: "Fold back to source" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("list").getByText("Observed facts", { exact: true })).toBeVisible();
  await openGolden(page, "landing", "ready", testInfo, "reduced");
  await page.getByRole("button", { name: "Unfold the evidence" }).click();
  const motion = await page.locator("[data-golden-client='landing-narrative']").evaluate((element) => {
    const style = getComputedStyle(element.querySelector("button") as Element);
    return { animation: style.animationName, transition: style.transitionDuration };
  });
  expect(motion.animation).toBe("none");
  expect(motion.transition).toBe("0s");
});

test("authentication completes validation, success, and redirect", async ({ page }, testInfo) => {
  await openGolden(page, "authentication", "sign-in", testInfo);
  const email = page.getByLabel("Email address");
  const password = page.getByLabel("Password");
  await email.fill("");
  await password.fill("");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(email).toBeFocused();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Enter a valid email address",
  );
  await email.fill("wrong@example.test");
  await password.fill("evidence");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("do not match");
  await email.fill("review@tryvit.local");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-golden-live-state='success']")).toBeVisible();
  await page.getByRole("button", { name: "Open authenticated home" }).click();
  await expect(page).toHaveURL(/\/golden\/home\?.*state=returning/u);
});

test("home keeps decision priority and restores Menu focus", async ({ page }, testInfo) => {
  await openGolden(page, "home", "paused-partial", testInfo);
  const decision = page.locator("[data-golden-decision-summary]");
  await expect(decision).toContainText("Review before deciding");
  const menu = page.getByRole("button", { name: "More decision actions" });
  await menu.scrollIntoViewIfNeeded();
  await menu.focus();
  await menu.press("ArrowDown");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await page.getByRole("button", { name: "Resume evidence review" }).click();
  await expect(
    page.locator("[data-golden-client='home-controls']").getByRole("status"),
  ).toContainText("resumed");
});

test("search settles results and applies the mobile Sheet", async ({ page }, testInfo) => {
  await openGolden(page, "search", "no-query", testInfo);
  await page.getByLabel("Search synthetic products").fill("oat");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator("[data-golden-live-state='results']")).toBeVisible();
  const filters = page.getByRole("button", { name: "Filters" });
  await filters.click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Include partial records").check();
  await dialog.getByLabel("Include records without a score").uncheck();
  await dialog.getByRole("button", { name: "Apply filters" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Partial evidence included", { exact: false })).toBeVisible();
});

test("product keeps evidence order, manual Tabs, and provenance ownership", async ({ page }, testInfo) => {
  await openGolden(page, "product", "unknown", testInfo);
  await expect(page.locator("[data-golden-decision-summary]")).toContainText("Not assessed");
  const ingredients = page.getByRole("tab", { name: "Ingredients" });
  await ingredients.focus();
  await ingredients.press("Enter");
  await expect(ingredients).toHaveAttribute("aria-selected", "true");
  const provenance = page.getByRole("button", { name: "Open provenance" });
  await provenance.click();
  const dialog = page.getByRole("dialog", { name: "Source and method provenance" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => Boolean(element.closest("[data-ds-overlay-host]")))).toBe(true);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(provenance).toBeFocused();
});

test("scanner performs no camera call and completes the synthetic match", async ({ page }, testInfo) => {
  await openGolden(page, "scanner", "not-requested", testInfo);
  await page.getByRole("button", { name: "Review permission request" }).click();
  await page.getByRole("button", { name: "Allow simulation" }).click();
  await page.getByRole("button", { name: "Continue acquisition" }).click();
  await page.getByRole("button", { name: "Recognize synthetic barcode" }).click();
  await page.getByRole("button", { name: "Build evidence result" }).click();
  await expect(page.locator("[data-golden-live-state='matched']")).toBeVisible();
  await expect(page.locator("[data-golden-decision-summary]")).toContainText("72");
  expect(await page.evaluate(() => (window as unknown as { __goldenMediaCalls: { calls: number } }).__goldenMediaCalls.calls)).toBe(0);
});

test.afterEach(async ({ page }) => {
  const markers = await page.evaluate(() => ({
    overlay: Boolean(document.querySelector("[data-nextjs-dialog]")),
    errors: [...document.querySelectorAll("[data-golden-error]")].length,
  }));
  expect(markers).toEqual({ overlay: false, errors: 0 });
});
