import { expect, test, type Page, type TestInfo } from "./fixtures/safe-test";
import { assertNoA11yViolations } from "./helpers/a11y";
import { getAdminClient, getScopedTestSession } from "./helpers/test-user";
import { createGuardedFetch, loadSafetyContractFromEnvironment } from "./helpers/visual-safety";
import { ProductReadEnvelopeSchema, type ProductReadModel } from "../src/lib/evidence/product-read-model";
import { translate } from "../src/lib/i18n-core";
import { readFileSync } from "node:fs";
import path from "node:path";

// Execute through visual-safety:local-authenticated only. IDs identify explicit
// disposable local catalog fixtures, never production records or user identities.
// Fixtures must include one source-observed product and one legacy-unverified one.
const safety = loadSafetyContractFromEnvironment(process.env);
if (safety.mode !== "local-authenticated") throw new Error("Evidence UI review requires guarded local authentication");
const rawIds = process.env.EVIDENCE_UI_PRODUCT_IDS ?? "";
const ids = rawIds.split(",").filter(Boolean).map(Number);
type Language = "en" | "pl" | "de";
let products: ProductReadModel[];
let changedFixtureLanguage = false;
const imageFixture = readFileSync(path.join(process.cwd(), "e2e/fixtures/evidence-product-image.svg"));

async function setFixtureLanguage(language: Language) {
  const { userId } = await getScopedTestSession("authenticated");
  const { error } = await getAdminClient().from("user_preferences").update({ preferred_language: language }).eq("user_id", userId);
  if (error) throw new Error("Could not set disposable fixture language");
  changedFixtureLanguage = true;
}

async function assertFits(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport);
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
}

async function assertReadyPageA11y(page: Page) {
  // Metadata can stream after DOMContentLoaded. Wait for the actual document
  // contract, not an arbitrary delay or an exemption of the title rule.
  await expect(page).toHaveTitle(/\S/);
  // Audit the settled rendering, not an intermediate opacity in a finite
  // entrance transition. Infinite activity indicators are not awaited.
  await page.locator("main").evaluate(async (main) => {
    await Promise.all(main.getAnimations({ subtree: true })
      .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map((animation) => animation.finished.catch(() => undefined)));
  });
  const audit = await assertNoA11yViolations(page);
  expect(audit.blocking).toHaveLength(0);
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await assertFits(page);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
  const firstFold = info.outputPath(`${name}-viewport.png`);
  await page.screenshot({ path: firstFold, fullPage: false, animations: "disabled" });
  await info.attach(`${name}-viewport`, { path: firstFold, contentType: "image/png" });
}

test.describe("Evidence-first product and comparison", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async () => {
    expect(ids.length, "Set EVIDENCE_UI_PRODUCT_IDS to two to four disposable local product IDs").toBeGreaterThanOrEqual(2);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(ids.every((id) => Number.isSafeInteger(id) && id > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    const session = await getScopedTestSession("authenticated");
    const response = await createGuardedFetch({ allowedOrigin: safety.supabaseOrigin })(`${safety.supabaseOrigin}/rest/v1/rpc/api_product_read_model`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: session.anonKey, authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ p_product_ids: ids, p_language: "en" }),
    });
    expect(response.ok).toBe(true);
    const envelope = ProductReadEnvelopeSchema.parse(await response.json());
    expect(envelope.missing_ids).toEqual([]);
    products = envelope.products;
    expect(products.some((product) => product.evidence.state === "recorded")).toBe(true);
    expect(products.some((product) => product.evidence.state === "legacy_unverified")).toBe(true);
  });
  test.beforeEach(async ({ page }, info) => {
    // Preserve the real database/read-model path. Substitute only the image
    // transport: no external image fetch, and the pixels clearly say TEST IMAGE.
    const imageUrls = new Set(products.flatMap((product) => product.image?.url ?? []));
    await page.route("**/_next/image?**", async (route) => {
      const requested = new URL(route.request().url()).searchParams.get("url");
      if (requested && imageUrls.has(requested)) {
        await route.fulfill({ status: 200, contentType: "image/svg+xml", body: imageFixture });
      } else {
        await route.fallback();
      }
    });
    info.annotations.push({ type: "fixture", description: "Source image pointers are real; image bytes are an explicit local synthetic fixture. No production-image accuracy claim." });
  });
  test.afterAll(async () => { if (changedFixtureLanguage) await setFixtureLanguage("en"); });

  for (const language of ["en", "pl", "de"] as const) {
    for (const theme of ["light", "dark"] as const) {
      for (const width of [390, 1440]) {
        test(`${language} ${theme} ${width}: source facts, unknowns and comparison`, async ({ page }, info) => {
          test.setTimeout(90_000);
          await setFixtureLanguage(language);
          await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
          await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
          await page.addInitScript((mode) => localStorage.setItem("theme", mode), theme);
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.name));
          const recorded = products.find((product) => product.evidence.state === "recorded")!;
          const legacy = products.find((product) => product.evidence.state === "legacy_unverified")!;

          await page.goto(`/app/search?q=${encodeURIComponent(recorded.ean ?? recorded.product_name_original)}`, { waitUntil: "domcontentloaded" });
          await expect(page.locator(`main a[href="/app/product/${recorded.product_id}"]`).first()).toBeVisible();
          await expect(page.locator("main meter")).toHaveCount(0);
          await expect(page.locator("main").getByRole("button", { name: translate(language, "nav.search"), exact: true })).toBeVisible();
          const filterButton = page.getByRole("button", { name: translate(language, "findUi.filtersButton", { count: 0 }) });
          await filterButton.click();
          await expect(page.getByRole("dialog", { name: translate(language, "findUi.filtersTitle") })).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await expect(filterButton).toBeFocused();
          await expect(page).toHaveTitle(/Search Products/);
          await assertReadyPageA11y(page);
          await capture(page, info, "find-results");

          await page.goto(`/app/product/${recorded.product_id}`, { waitUntil: "domcontentloaded" });
          await expect(page.locator("main h1")).toHaveCount(1);
          await expect(page.getByRole("heading", { name: translate(language, "evidenceUi.nutritionTitle") })).toBeVisible();
          await expect(page.locator("main meter")).toHaveCount(0);
          await expect(page.locator("html")).toHaveAttribute("lang", language);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          if (recorded.allergens.contains.length || recorded.allergens.traces.length) {
            const notice = page.getByRole("complementary", { name: translate(language, "evidenceUi.allergenNoticeTitle") });
            await expect(notice).toBeVisible();
            if (width === 390) {
              const box = await notice.boundingBox();
              expect(box).not.toBeNull();
              expect(box!.y + box!.height).toBeLessThan(780);
            }
          }
          const sources = page.getByTestId("product-sources");
          const classificationPanel = page.locator(`[aria-labelledby="classifications-${recorded.product_id}"]`);
          for (const classification of Object.values(recorded.classifications)) {
            if (classification.value === null) continue;
            const source = recorded.sources.find((entry) => entry.observation_id === classification.observation_id && entry.source_key === classification.source);
            expect(source, "Classification must resolve to its own observation").toBeDefined();
            await expect(classificationPanel.locator(`a[href="#source-${recorded.product_id}-${source!.observation_id}"]`).first()).toBeVisible();
          }
          if (recorded.image?.state === "recorded") {
            const caption = page.locator("figure figcaption");
            const photoDetails = caption.locator("details");
            await expect(photoDetails).not.toHaveAttribute("open");
            await expect(caption.locator(`a[href="#source-${recorded.product_id}-${recorded.image.observation_id}"]`)).not.toBeVisible();
            if (width === 390) {
              const photoBounds = await page.locator("figure").boundingBox();
              expect(photoBounds!.height).toBeLessThan(190);
            }
            await caption.getByText(translate(language, "evidenceUi.photoDetails"), { exact: true }).click();
            await expect(caption.locator(`a[href="#source-${recorded.product_id}-${recorded.image.observation_id}"]`)).toBeVisible();
            await expect(caption).toContainText(translate(language, "evidenceUi.state.recorded"));
            await caption.getByText(translate(language, "evidenceUi.photoDetails"), { exact: true }).click();
            await expect(photoDetails).not.toHaveAttribute("open");
          }
          const observationLink = classificationPanel.locator('a[href^="#source-"]').first();
          const nutritionPanel = page.locator(`[aria-labelledby="nutrition-${recorded.product_id}"]`);
          const nutrientObservation = Object.values(recorded.nutrition).find((field) => field.value !== null && field.observation_id !== null);
          expect(nutrientObservation).toBeDefined();
          const nutrientLink = nutritionPanel.locator(`a[href="#source-${recorded.product_id}-${nutrientObservation!.observation_id}"]`).first();
          const assertionLink = page.locator(`[aria-labelledby="allergens-${recorded.product_id}"], [aria-labelledby="ingredients-${recorded.product_id}"]`).locator('a[href^="#source-"]').first();
          await expect(assertionLink).toBeVisible();
          expect(await assertionLink.getAttribute("aria-label")).toContain(await assertionLink.locator("span").first().innerText());
          for (const link of [nutrientLink, assertionLink]) {
            await expect(link).toBeVisible();
            const target = await link.getAttribute("href");
            expect(recorded.sources.some((source) => target === `#source-${recorded.product_id}-${source.observation_id}`)).toBe(true);
            await link.focus();
            await page.keyboard.press("Enter");
            await expect(sources).toHaveAttribute("open", "");
            await expect(page.locator(target!)).toBeVisible();
            await sources.locator("summary").click();
            await expect(sources).not.toHaveAttribute("open");
          }
          await expect(observationLink).toBeVisible();
          await observationLink.click();
          await expect(sources).toHaveAttribute("open", "");
          await sources.locator("summary").click();
          await expect(sources).not.toHaveAttribute("open");
          await sources.locator("summary").focus();
          await page.keyboard.press("Enter");
          await expect(sources).toHaveAttribute("open", "");
          await expect(sources.getByText(translate(language, "evidenceUi.sourceAgeLimit"))).toBeVisible();
          await expect(sources.locator('a[rel="noopener noreferrer"]')).toHaveCount(recorded.sources.length);
          await expect.poll(() => page.title()).toContain(recorded.product_name);
          await assertReadyPageA11y(page);
          await capture(page, info, "recorded-detail");

          await page.goto(`/app/product/${legacy.product_id}`, { waitUntil: "domcontentloaded" });
          await expect(page.getByText(translate(language, "evidenceUi.summary.legacy_unverified"))).toBeVisible();
          const legacyContext = page.locator(`#nutrition-context-${legacy.product_id}`);
          await expect(legacyContext).toContainText(translate(language, "evidenceUi.nutritionSharedContext"));
          await expect(legacyContext).toContainText(translate(language, "evidenceUi.basis.unknown"));
          await expect(page.locator('[data-evidence-state="unverified"]').first()).toBeVisible();
          await expect(page.getByText(translate(language, "evidenceUi.allergenLimit"))).toBeVisible();
          await capture(page, info, "legacy-detail");

          await page.goto(`/app/compare?ids=${ids.join(",")}`, { waitUntil: "domcontentloaded" });
          await expect(page.getByRole("table", { name: translate(language, "evidenceUi.compareTable") })).toBeVisible();
          await expect(page.getByText(translate(language, "evidenceUi.notComparable.evidence_unavailable")).first()).toBeVisible();
          await expect(page.locator("main meter")).toHaveCount(0);
          await expect(page).toHaveTitle(/Compare Products/);
          if (width === 390) {
            await expect(page.getByText(translate(language, "evidenceUi.comparisonScrollHint"))).toBeVisible();
            const region = page.getByRole("region", { name: translate(language, "evidenceUi.compareTable") });
            const label = region.locator("tbody th").first();
            const before = await label.boundingBox();
            await region.focus();
            await page.keyboard.press("ArrowRight");
            await expect.poll(() => region.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
            const after = await label.boundingBox();
            expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
            await region.evaluate((node) => { node.scrollLeft = 0; });
          }
          await assertReadyPageA11y(page);
          await capture(page, info, "comparison");
          await page.getByRole("button", { name: translate(language, "compare.clearSelection") }).click();
          await expect(page).toHaveURL(/\/app\/compare$/);
          await expect(page.getByRole("table")).toHaveCount(0);
          await page.goBack();
          await expect(page.getByRole("table")).toBeVisible();
          expect(errors).toEqual([]);
        });
      }
    }
  }

  test("2560px content stays anchored near the navigation rail", async ({ page }, info) => {
    await setFixtureLanguage("en");
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto(`/app/product/${ids[0]}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main h1")).toBeVisible();
    const rail = await page.getByTestId("desktop-sidebar").boundingBox();
    const main = await page.locator("main").boundingBox();
    expect(rail).not.toBeNull(); expect(main).not.toBeNull();
    expect(main!.x - (rail!.x + rail!.width)).toBeLessThanOrEqual(64);
    await capture(page, info, "ultrawide-detail");
  });

  test("bookmarks and empty saved/history surfaces use the canonical readers", async ({ page }, info) => {
    await setFixtureLanguage("en");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/app/categories", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/app\/search\?panel=categories$/);
    await expect(page.getByRole("dialog", { name: translate("en", "findUi.filtersTitle") })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto(`/app/scan/result/${ids[0]}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/app/product/${ids[0]}$`));
    await expect(page.locator("main h1")).toHaveCount(1);
    await page.goto("/app/scan/history", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(translate("en", "scanHistory.emptyTitle"))).toBeVisible();
    await expect(page.locator("main meter")).toHaveCount(0);
    await page.goto("/app/watchlist", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: translate("en", "evidenceUi.monitoringTitle"), exact: true })).toBeVisible();
    await expect(page.getByText(translate("en", "watchlist.emptyTitle"))).toBeVisible();
    await capture(page, info, "empty-watchlist");
    await page.goto("/app/lists", { waitUntil: "domcontentloaded" });
    const savedList = page.locator('main a[href^="/app/lists/"]').first();
    await expect(savedList).toBeVisible();
    await savedList.click();
    await expect(page.getByText(translate("en", "lists.emptyList"))).toBeVisible();
    await expect(page.locator("main meter")).toHaveCount(0);
    await assertReadyPageA11y(page);
    await capture(page, info, "empty-saved-list");
  });
  test("manual barcode entry reaches evidence details and persists truthful history", async ({ page }, info) => {
    await setFixtureLanguage("en");
    await page.setViewportSize({ width: 390, height: 844 });
    const recorded = products.find((product) => product.evidence.state === "recorded" && product.ean)!;
    expect(recorded?.ean).toMatch(/^(?:[0-9]{8}|[0-9]{13})$/);
    await page.goto("/app/scan", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: translate("en", "scan.manual"), exact: true }).click();
    await page.getByPlaceholder(translate("en", "scan.manualPlaceholder")).fill(recorded.ean!);
    await page.getByRole("button", { name: translate("en", "scan.lookUp"), exact: true }).click();
    await expect(page.getByText(translate("en", "scan.productFound"), { exact: true })).toBeVisible();
    await expect(page.getByText(recorded.product_name, { exact: true })).toBeVisible();
    await expect(page.locator("main").getByRole("status").filter({ hasText: translate("en", "scan.scoreEvidencePending") })).toBeVisible();
    await expect(page.locator("main meter")).toHaveCount(0);
    await assertReadyPageA11y(page);
    await capture(page, info, "manual-scan-found");
    await page.getByRole("button", { name: translate("en", "scan.viewDetails"), exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/app/product/${recorded.product_id}$`));
    await expect(page.locator("main h1")).toHaveText(recorded.product_name);
    await page.goto("/app/scan/history", { waitUntil: "domcontentloaded" });
    const historyEntry = page.locator("main").getByRole("button").filter({ hasText: recorded.product_name });
    await expect(historyEntry).toBeVisible();
    await expect(page.locator("main meter")).toHaveCount(0);
    await assertReadyPageA11y(page);
    await capture(page, info, "manual-scan-history");
    await historyEntry.click();
    await expect(page).toHaveURL(new RegExp(`/app/product/${recorded.product_id}$`));
  });

  test("mobile save failure recovers, desktop retrieval works, and comparison stays private", async ({ page }, info) => {
    await setFixtureLanguage("en");
    await page.setViewportSize({ width: 390, height: 844 });
    const { userId } = await getScopedTestSession("authenticated");
    const admin = getAdminClient();
    const favorite = await admin.from("user_product_lists").select("id").eq("user_id", userId).eq("list_type", "favorites").single();
    if (favorite.error || !favorite.data) throw new Error("Disposable favorites fixture unavailable");
    const recorded = products.find((product) => product.evidence.state === "recorded")!;
    const addEndpoint = `${safety.supabaseOrigin}/rest/v1/rpc/api_add_to_list`;
    let rejectedOnce = false;
    await page.route(addEndpoint, async (route) => {
      if (!rejectedOnce) {
        rejectedOnce = true;
        await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":false}' });
      } else await route.fallback();
    });
    await page.goto(`/app/product/${recorded.product_id}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: translate("en", "productActions.addToList") }).click();
    const menu = page.getByRole("menu");
    const bounds = await menu.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    const favoriteAction = menu.getByRole("menuitem", { name: "Favorites", exact: true });
    await expect(favoriteAction).toBeEnabled();
    await favoriteAction.click();
    await expect(page.locator(`#list-membership-error-${recorded.product_id}`)).toContainText(translate("en", "productActions.updateFailed"));
    const failedWrite = await admin.from("user_product_list_items").select("id", { count: "exact", head: true }).eq("list_id", favorite.data.id).eq("product_id", recorded.product_id);
    if (failedWrite.error) throw new Error("Disposable membership verification failed");
    expect(failedWrite.count).toBe(0);
    await expect(favoriteAction).toBeEnabled();
    await favoriteAction.click();
    await expect(menu.getByRole("menuitem", { name: /Favorites.*remove/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto(`/app/lists/${favorite.data.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`main a[href="/app/product/${recorded.product_id}"]`)).toBeVisible();
    await assertReadyPageA11y(page);
    await capture(page, info, "saved-product-mobile");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("dashboard-favorite-item")).toContainText(recorded.product_name);
    await capture(page, info, "saved-home-desktop");
    await page.goto(`/app/compare?ids=${ids.join(",")}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: translate("en", "compare.saveComparison") }).click();
    await expect(page.getByText(translate("en", "evidenceUi.comparisonSaved"))).toBeVisible();
    const saved = await admin.from("user_comparisons").select("share_token").eq("user_id", userId);
    if (saved.error) throw new Error("Disposable comparison verification failed");
    expect(saved.data.length).toBe(1);
    // Assert only a boolean so an unexpected capability never enters evidence.
    expect(saved.data.every((entry) => entry.share_token === null)).toBe(true);
    await page.goto("/app/compare/saved", { waitUntil: "domcontentloaded" });
    await expect(page.locator('main a[href*="/app/compare?ids="]').first()).toBeVisible();
    await assertFits(page);
  });
});
