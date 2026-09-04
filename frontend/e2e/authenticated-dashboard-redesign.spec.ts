import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DashboardData, RecentlyViewedProduct } from "@/lib/types";
import { expect, test, type Page, type TestInfo } from "./fixtures/safe-test";
import { assertNoA11yViolations } from "./helpers/a11y";
import { getAdminClient, getScopedTestSession } from "./helpers/test-user";
import { loadSafetyContractFromEnvironment } from "./helpers/visual-safety";

// Real /app route + existing disposable local auth fixture. Product/history
// payloads below are synthetic read-only responses, never catalog/user writes.
// Run only through visual-safety:local-authenticated, with --workers=1.
// This produces review candidates, never updates immutable visual baselines.
type Language = "en" | "pl" | "de";
type State = "populated" | "new" | "empty" | "partial" | "loading" | "error";

const contract = loadSafetyContractFromEnvironment(process.env);
if (contract.mode !== "local-authenticated") {
  throw new Error("Dashboard review requires guarded local authentication");
}
const rpcOrigin = contract.supabaseOrigin;
const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
// This existing, scanned artifact root survives Playwright's test-results cleanup.
const evidenceRoot = path.resolve("qa_screenshots/dashboard-redesign", runId);
const fixtureDate = "2026-09-04T10:00:00.000Z";
const names = {
  en: ["Natural yoghurt", "Wholegrain oat flakes", "Crispbread with seeds", "Tomato soup"],
  pl: ["Jogurt naturalny", "Pełnoziarniste płatki owsiane", "Pieczywo chrupkie z ziarnami", "Zupa pomidorowa"],
  de: ["Naturjoghurt", "Vollkorn-Haferflocken", "Knäckebrot mit Saaten", "Tomatensuppe"],
} satisfies Record<Language, string[]>;

async function collectSourceIdentity() {
  const filenames = execFileSync("git", [
    "ls-files", "--cached", "--others", "--exclude-standard", "--",
    "src/app/app/page.tsx", "src/app/app/ReturningDashboard.tsx",
    "src/components/dashboard", "src/components/common/skeletons/DashboardSkeleton.tsx",
    "messages/en.json", "messages/pl.json", "messages/de.json",
    "e2e/authenticated-dashboard-redesign.spec.ts",
  ], { encoding: "utf8" }).trim().split(/\r?\n/)
    .filter((name) => /\.(?:tsx?|css|json)$/.test(name) && !name.includes(".test."));
  const files = await Promise.all([...new Set(filenames)].sort().map(async (filename) => {
    const bytes = await readFile(filename).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    return { file: filename, sha256: bytes ? createHash("sha256").update(bytes).digest("hex") : null };
  }));
  return {
    files,
    fingerprint: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
  };
}

let sourceIdentity: Awaited<ReturnType<typeof collectSourceIdentity>>;
let buildProvenance: Record<string, unknown>;
const categoryNames = {
  en: ["Dairy", "Bread", "Cereals", "Drinks", "Snacks", "Soups"],
  pl: ["Nabiał", "Pieczywo", "Płatki śniadaniowe", "Napoje", "Przekąski", "Zupy"],
  de: ["Milchprodukte", "Brot", "Frühstückscerealien", "Getränke", "Snacks", "Suppen"],
} satisfies Record<Language, string[]>;

function dashboardFixture(state: State, language: Language): DashboardData {
  const recent: RecentlyViewedProduct[] = names[language].map((name, index) => ({
    product_id: 990010 + index,
    product_name: name,
    brand: "Local review fixture",
    category: ["Dairy", "Cereals", "Bread", "Soups"][index],
    country: "PL",
    unhealthiness_score: state === "partial" || index === 3 ? null : [18, 29, 52][index],
    nutri_score_label: state === "partial" || index === 3 ? null : index === 2 ? "C" : "A",
    viewed_at: fixtureDate,
    image_thumb_url: null,
  }));
  const hasRecent = state !== "new" && state !== "empty";
  return {
    api_version: "1.0",
    recently_viewed: hasRecent ? recent : [],
    favorites_preview: hasRecent ? recent.slice(0, 2).map(({ viewed_at: _date, ...product }) => ({
      ...product,
      added_at: fixtureDate,
    })) : [],
    new_products: [],
    stats: {
      total_scanned: state === "new" ? 0 : 7,
      total_viewed: state === "new" ? 0 : 12,
      lists_count: state === "new" ? 0 : 2,
      favorites_count: hasRecent ? 2 : 0,
      most_viewed_category: hasRecent ? "Dairy" : null,
    },
  };
}

async function setFixtureLanguage(language: Language) {
  const session = await getScopedTestSession("authenticated");
  const { error } = await getAdminClient().from("user_preferences")
    .update({ preferred_language: language }).eq("user_id", session.userId);
  if (error) throw new Error("Could not configure disposable review fixture language");
}

async function installDashboardFixtures(page: Page, language: Language) {
  let state: State = "populated";
  let releaseLoading: (() => void) | undefined;
  let loadingGate: Promise<void> | undefined;
  let failedRequests = 0;
  await page.route((url) => url.origin === rpcOrigin && url.pathname.startsWith("/rest/v1/rpc/"), async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    if (name === "api_get_dashboard_data") {
      if (state === "loading") await loadingGate;
      if (state === "error") {
        failedRequests += 1;
        await route.fulfill({ status: 503, json: { code: "REVIEW_UNAVAILABLE", message: "Synthetic dashboard outage" } });
      } else {
        await route.fulfill({ json: dashboardFixture(state, language) });
      }
      return;
    }
    // These responses contain no recommendation, health trend, or source claim.
    if (name === "api_dashboard_insights") {
      if (state === "partial") {
        await route.fulfill({ json: { error: "Synthetic missing allergen evidence" } });
        return;
      }
      await route.fulfill({ json: {
        api_version: "1.0", avg_score: 0, score_trend: "stable", nova_distribution: {},
        category_diversity: { explored: 0, total: 0 },
        allergen_alerts: state === "populated"
          ? { count: 1, products: [{ product_id: 990010, product_name: names[language][0], allergen: "en:milk" }] }
          : { count: 0, products: [] },
        recent_comparisons: [],
      } });
      return;
    }
    if (name === "api_category_overview") {
      await route.fulfill({ json: {
        api_version: "1.0", country: "PL",
        categories: state === "empty" ? [] : categoryNames.en.map((category, index) => ({
          category, country_code: "PL", slug: category.toLowerCase(),
          display_name: categoryNames[language][index], category_description: null,
          icon_emoji: "", sort_order: index, product_count: 4,
          avg_score: 35, min_score: 18, max_score: 52, median_score: 35,
          pct_nutri_a_b: 0, pct_nova_4: 0,
        })),
      } });
      return;
    }
    await route.fallback();
  });
  return {
    set(next: State) {
      releaseLoading?.();
      state = next;
      if (next === "loading") loadingGate = new Promise<void>((resolve) => { releaseLoading = resolve; });
    },
    release() {
      state = "populated";
      releaseLoading?.();
    },
    failures: () => failedRequests,
  };
}

async function assertDashboardFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
}

async function capture(page: Page, info: TestInfo, name: string, state: State) {
  await assertDashboardFits(page);
  await page.evaluate(() => document.fonts.ready);
  await mkdir(evidenceRoot, { recursive: true });
  const filename = `${name}-${state}.png`;
  const filenamePath = path.join(evidenceRoot, filename);
  await page.screenshot({ path: filenamePath, fullPage: true, animations: "disabled" });
  await info.attach(filename, { path: filenamePath, contentType: "image/png" });
  const bytes = await readFile(filenamePath);
  const viewportFilename = `${name}-${state}-viewport.png`;
  const viewportPath = path.join(evidenceRoot, viewportFilename);
  await page.screenshot({ path: viewportPath, fullPage: false, animations: "disabled" });
  await info.attach(viewportFilename, { path: viewportPath, contentType: "image/png" });
  const viewportBytes = await readFile(viewportPath);
  const computedStyles = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="returning-dashboard"], [data-testid="new-user-welcome"]');
    const targets = {
      heading: document.querySelector("main h1"),
      product: document.querySelector('[data-testid="recently-viewed-item"] [class*="productName"]'),
      productMeta: document.querySelector('[data-testid="recently-viewed-item"] [class*="productMeta"]'),
      allergen: document.querySelector('[data-testid="dashboard-allergen-notice"] p'),
    };
    const rootStyle = root ? getComputedStyle(root) : null;
    return {
      tokens: Object.fromEntries(["--color-text-primary", "--color-text-secondary", "--color-foreground", "--color-foreground-secondary"]
        .map((token) => [token, rootStyle?.getPropertyValue(token).trim() ?? null])),
      elements: Object.fromEntries(Object.entries(targets).map(([key, element]) => [key, element ? {
        color: getComputedStyle(element).color,
        fontSize: getComputedStyle(element).fontSize,
        fontFamily: getComputedStyle(element).fontFamily,
      } : null])),
    };
  });
  await writeFile(path.join(evidenceRoot, `${name}-${state}.json`), `${JSON.stringify({
    schema: "tryvit-dashboard-review/v1",
    fixture: "synthetic-read-only-rpc",
    route: "/app",
    state,
    screenshot: filename,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    viewportScreenshot: viewportFilename,
    viewportSha256: createHash("sha256").update(viewportBytes).digest("hex"),
    sourceIdentity,
    buildProvenance,
    computedStyles,
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourceTree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
    sourceDirty: execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim().length > 0,
    viewport: page.viewportSize(),
    browser: info.project.use.browserName ?? "chromium",
    language: await page.locator("html").getAttribute("lang"),
    theme: await page.locator("html").getAttribute("data-theme"),
    capturedAt: new Date().toISOString(),
  }, null, 2)}\n`, { flag: "wx" });
}

// One serial lane is required because the server layout reads the disposable
// identity's saved locale. No production identity or preference is involved.
test.describe("Dashboard redesign guarded review", () => {
  test.describe.configure({ mode: "default" });
  test.beforeAll(async () => {
    sourceIdentity = await collectSourceIdentity();
    const provenance = JSON.parse(await readFile(".next/tryvit-visual-safety-provenance.json", "utf8"));
    // Runtime addresses are sensitive environment values under the artifact
    // contract. Bind the built bytes without exporting runtime configuration.
    buildProvenance = {
      schemaVersion: provenance.contract.schemaVersion,
      sourceGitSha: provenance.contract.sourceGitSha,
      buildId: provenance.contract.buildId,
      assetDigest: provenance.assetDigest,
    };
  });
  test.afterAll(async () => {
    try {
      expect((await collectSourceIdentity()).fingerprint, "Dashboard sources changed during review").toBe(sourceIdentity.fingerprint);
    } finally {
      await setFixtureLanguage("en");
    }
  });

  for (const language of ["en", "pl", "de"] as const) {
    for (const theme of ["light", "dark"] as const) {
      for (const width of [1440, 390]) {
        const name = `${language}-${theme}-${width}`;
        test(`${name}: populated, new, empty, partial, loading, error and retry`, async ({ page }, info) => {
          test.setTimeout(100_000);
          await setFixtureLanguage(language);
          await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
          await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
          await page.addInitScript((mode) => localStorage.setItem("theme", mode), theme);
          const fixture = await installDashboardFixtures(page, language);
          const pageErrors: string[] = [];
          page.on("pageerror", (error) => pageErrors.push(error.name));

          for (const state of ["populated", "new", "empty", "partial"] as const) {
            fixture.set(state);
            await page.goto("/app", { waitUntil: "domcontentloaded" });
            const root = page.getByTestId(state === "new" ? "new-user-welcome" : "returning-dashboard");
            await expect(root).toBeVisible();
            await expect(page.locator("html")).toHaveAttribute("lang", language);
            await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
            await expect(page.locator("main h1")).toHaveCount(1);
            for (const href of ["/app/scan", "/app/search", "/app/categories"]) {
              await expect(root.locator(`a[href="${href}"]`).first()).toBeVisible();
            }
            if (state === "populated" || state === "partial") {
              await expect(root.locator('a[href="/app/product/990010"]').first()).toBeVisible();
              await expect(root.getByText(names[language][0], { exact: true }).first()).toBeVisible();
              await expect(root.getByTestId("dashboard-allergen-notice")).toBeVisible();
              if (state === "populated") {
                await expect(root.getByTestId("recently-viewed-item").first()).toContainText("82");
                await expect(root.getByTestId("recently-viewed-item").first()).toContainText("/100");
              } else {
                await expect(root.getByTestId("recently-viewed-item").first()).not.toContainText("/100");
              }
            }
            await expect(root.getByTestId("quick-win-card")).toHaveCount(0);
            await capture(page, info, name, state);
            await assertNoA11yViolations(page);
          }

          fixture.set("loading");
          await page.goto("/app", { waitUntil: "domcontentloaded" });
          await expect(page.getByTestId("dashboard-loading")).toBeVisible();
          await expect(page.getByRole("status").filter({ has: page.getByTestId("dashboard-loading") })).toHaveAttribute("aria-busy", "true");
          await capture(page, info, name, "loading");
          fixture.release();
          await expect(page.getByTestId("returning-dashboard")).toBeVisible();

          fixture.set("error");
          await page.goto("/app", { waitUntil: "domcontentloaded" });
          const errorPanel = page.getByTestId("dashboard-error");
          await expect(errorPanel).toBeVisible({ timeout: 20_000 });
          await expect(errorPanel.getByRole("alert")).toBeVisible();
          expect(fixture.failures()).toBeGreaterThan(0);
          await capture(page, info, name, "error");
          await assertNoA11yViolations(page);
          fixture.set("populated");
          const retry = errorPanel.getByRole("button");
          await retry.focus();
          await expect(retry).toBeFocused();
          await page.keyboard.press("Enter");
          await expect(page.getByTestId("returning-dashboard")).toBeVisible();
          await expect(errorPanel).toHaveCount(0);
          const searchEntry = page.getByTestId("dashboard-search-cta");
          await searchEntry.focus();
          await expect(searchEntry).toBeFocused();
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(/\/app\/search$/);
          expect(pageErrors).toEqual([]);
        });
      }
    }
  }
});
