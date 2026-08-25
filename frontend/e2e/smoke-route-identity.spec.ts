import { expect, test, type Page } from "./fixtures/safe-test";
// Node's type-stripping loader requires the source extension at runtime.
// prettier-ignore
// @ts-expect-error TS5097: executed through the guarded Playwright launcher.
import { MEASUREMENT_ROUTES } from "../tooling/phase5a0d-contract.ts";
// prettier-ignore
// @ts-expect-error TS5097: executed through the guarded Playwright launcher.
import { assertMeasuredRouteIdentity } from "../tooling/phase5a0d-route-js.ts";

const landingRoute = MEASUREMENT_ROUTES.find((route) => route.id === "landing");
if (!landingRoute) throw new Error("[P5_ROUTE_IDENTITY] landing-route-missing");

async function expectLandingIdentityFailure(page: Page, code: string): Promise<void> {
  let failure = "";
  try {
    await assertMeasuredRouteIdentity(page, landingRoute, "/", new URL(page.url()).origin);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  expect(failure).toContain(code);
}

test.describe("stable landing route identity", () => {
  test("measures the current pre-redesign landing", async ({ page }) => {
    await page.goto("/");
    await assertMeasuredRouteIdentity(page, landingRoute, "/", new URL(page.url()).origin);
  });

  test("survives future heading and translation changes", async ({ page }) => {
    await page.goto("/");
    await page.locator("main#main-content h1").evaluate((heading) => {
      heading.textContent = "Zmieniony nagłówek przyszłego projektu";
    });
    await assertMeasuredRouteIdentity(page, landingRoute, "/", new URL(page.url()).origin);
  });

  test("rejects a near-match route even when it copies the marker", async ({ page }) => {
    await page.goto("/contact");
    await page.locator("main#main-content").evaluate((main) => {
      main.setAttribute("data-route-id", "public-landing");
    });
    await expectLandingIdentityFailure(page, "route-pathname-mismatch:landing");
  });

  test("rejects missing, wrong, duplicate, and wrong-boundary markers", async ({ page }) => {
    await page.goto("/");
    const main = page.locator('main#main-content[data-route-id="public-landing"]');
    await main.evaluate((element) => element.removeAttribute("data-route-id"));
    await expectLandingIdentityFailure(page, "route-ready-marker-missing:landing");

    await page.reload();
    await page.locator("main#main-content").evaluate((element) => {
      element.setAttribute("data-route-id", "near-match-landing");
    });
    await expectLandingIdentityFailure(page, "route-identity-mismatch:landing");

    await page.reload();
    await page.locator("main#main-content").evaluate((element) => {
      const duplicate = document.createElement("span");
      duplicate.setAttribute("data-route-id", "public-landing");
      element.append(duplicate);
    });
    await expectLandingIdentityFailure(page, "route-ready-marker-duplicate:landing");

    await page.reload();
    await page.locator("main#main-content").evaluate((element) => {
      element.removeAttribute("data-route-id");
      const wrongBoundary = document.createElement("div");
      wrongBoundary.setAttribute("data-route-id", "public-landing");
      document.body.append(wrongBoundary);
    });
    await expectLandingIdentityFailure(page, "route-identity-boundary-mismatch:landing");
  });
});
