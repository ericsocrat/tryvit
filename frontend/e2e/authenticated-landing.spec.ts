import { expect, test } from "./fixtures/safe-test";

const SERVICE_PATH = /^\/(?:auth|rest|realtime|storage|functions|graphql)\/v1(?:\/|$)/iu;

test("keeps a signed-out query-bearing live landing transport-free", async ({ context, page }) => {
  await context.clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const serviceRequests: string[] = [];
  const realtimeSockets: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (SERVICE_PATH.test(url.pathname)) {
      serviceRequests.push(`${request.method()} ${url.pathname}`);
    }
  });
  page.on("websocket", (socket) => realtimeSockets.push(socket.url()));

  const response = await page.goto("/?utm_source=test&utm_campaign=cycle3");
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toHaveAttribute("data-provider-boundary", "landing");
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(serviceRequests).toEqual([]);
  expect(realtimeSockets).toEqual([]);
});

test("uses one existing-session probe for a signed-in query-bearing live landing", async ({
  page,
}) => {
  const serviceRequests: string[] = [];
  const realtimeSockets: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (SERVICE_PATH.test(url.pathname)) {
      serviceRequests.push(`${request.method()} ${url.pathname}`);
    }
  });
  page.on("websocket", (socket) => realtimeSockets.push(socket.url()));

  const response = await page.goto("/?ref=cycle3-live-proof");
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toHaveAttribute("data-provider-boundary", "landing");
  await expect(page.getByRole("link", { name: "Dashboard", exact: true }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(serviceRequests).toEqual(["GET /auth/v1/user"]);
  expect(realtimeSockets).toEqual([]);
});
