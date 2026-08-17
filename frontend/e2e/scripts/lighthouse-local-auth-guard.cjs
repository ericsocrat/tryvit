"use strict";

const publicGuard = require("./lighthouse-public-guard.cjs");

function canonicalLoopbackOrigin(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`[P5_LIGHTHOUSE_AUTH] ${label}-origin-invalid`);
  }
  if (
    parsed.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`[P5_LIGHTHOUSE_AUTH] ${label}-origin-invalid`);
  }
  return parsed.origin;
}

function probeLoginHydration() {
  const passwordInput = document.querySelector("#password");
  const toggle = passwordInput?.parentElement?.querySelector('button[type="button"]');
  if (!(passwordInput instanceof HTMLInputElement) || !(toggle instanceof HTMLButtonElement)) {
    return false;
  }
  if (passwordInput.type === "text") return true;
  toggle.click();
  return passwordInput.type === "text";
}

function restorePasswordMask() {
  const passwordInput = document.querySelector("#password");
  const toggle = passwordInput?.parentElement?.querySelector('button[type="button"]');
  if (!(passwordInput instanceof HTMLInputElement) || !(toggle instanceof HTMLButtonElement)) {
    return false;
  }
  if (passwordInput.type === "password") return true;
  toggle.click();
  return passwordInput.type === "password";
}

module.exports = async function localAuthenticatedLighthouseGuard(browser) {
  if (process.env.VISUAL_SAFETY_MODE !== "local-authenticated") {
    throw new Error("[P5_LIGHTHOUSE_AUTH] local-authenticated-mode-required");
  }
  const appOrigin = canonicalLoopbackOrigin(process.env.VISUAL_SAFETY_APP_ORIGIN, "application");
  const supabaseOrigin = canonicalLoopbackOrigin(
    process.env.VISUAL_SAFETY_SUPABASE_ORIGIN,
    "supabase",
  );
  const email = process.env.QA_TEST_EMAIL;
  const password = process.env.QA_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("[P5_LIGHTHOUSE_AUTH] credentials-required");
  }

  await publicGuard(browser);
  const page = await browser.newPage();
  await publicGuard.installPageGuard(page);
  try {
    const navigation = await page.goto(`${appOrigin}/auth/login`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!navigation || !navigation.ok()) {
      throw new Error("[P5_LIGHTHOUSE_AUTH] login-navigation-failed");
    }
    await page.waitForFunction(
      (origin) =>
        window.location.origin === origin &&
        (window.location.pathname.startsWith("/app") ||
          (window.location.pathname === "/auth/login" &&
            document.querySelector("#email") &&
            document.querySelector("#password"))),
      { timeout: 30_000 },
      appOrigin,
    );
    if (new URL(page.url()).pathname.startsWith("/app")) {
      return;
    }
    try {
      await page.waitForFunction(probeLoginHydration, { polling: 100, timeout: 30_000 });
    } catch {
      throw new Error("[P5_LIGHTHOUSE_AUTH] login-hydration-timeout");
    }
    try {
      await page.waitForFunction(restorePasswordMask, { polling: 100, timeout: 5_000 });
    } catch {
      throw new Error("[P5_LIGHTHOUSE_AUTH] password-mask-restore-timeout");
    }
    await page.type("#email", email);
    await page.type("#password", password);
    const tokenResponsePromise = page
      .waitForResponse(
        (response) => {
          const target = new URL(response.url());
          return (
            response.request().method() === "POST" &&
            target.origin === supabaseOrigin &&
            target.pathname === "/auth/v1/token"
          );
        },
        { timeout: 20_000 },
      )
      .catch(() => null);
    await page.click('button[type="submit"]');
    const tokenResponse = await tokenResponsePromise;
    if (!tokenResponse) {
      throw new Error("[P5_LIGHTHOUSE_AUTH] token-response-timeout");
    }
    if (!tokenResponse.ok()) {
      throw new Error(`[P5_LIGHTHOUSE_AUTH] token-status-${tokenResponse.status()}`);
    }
    await page.waitForFunction(
      (origin) => window.location.origin === origin && window.location.pathname.startsWith("/app"),
      { timeout: 30_000 },
      appOrigin,
    );
    if (new URL(page.url()).origin !== appOrigin) {
      throw new Error("[P5_LIGHTHOUSE_AUTH] post-login-origin-mismatch");
    }
  } finally {
    await page.close();
  }
};

module.exports.canonicalLoopbackOrigin = canonicalLoopbackOrigin;
module.exports.probeLoginHydration = probeLoginHydration;
module.exports.restorePasswordMask = restorePasswordMask;
