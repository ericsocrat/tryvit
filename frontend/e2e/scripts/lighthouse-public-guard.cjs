"use strict";

const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const SERVICE_PREFIXES = [
  "/auth/v1",
  "/rest/v1",
  "/graphql/v1",
  "/realtime/v1",
  "/storage/v1",
  "/functions/v1",
];

function isLoopback(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

function classify(rawUrl) {
  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    return "invalid-url";
  }
  const hostname = target.hostname.toLowerCase();
  if (hostname === "supabase.co" || hostname.endsWith(".supabase.co")) {
    return "hosted-supabase-origin";
  }
  if (
    !isLoopback(hostname) &&
    SERVICE_PREFIXES.some(
      (prefix) => target.pathname === prefix || target.pathname.startsWith(`${prefix}/`),
    )
  ) {
    return "non-loopback-supabase-service";
  }
  return null;
}

function record(category) {
  const markerPath = process.env.VISUAL_SAFETY_VIOLATION_MARKER;
  if (!markerPath) throw new Error("[VS_LIGHTHOUSE_GUARD] marker-missing");
  let summary = { total: 0, categories: {} };
  try {
    summary = JSON.parse(readFileSync(markerPath, "utf8"));
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw new Error("[VS_LIGHTHOUSE_GUARD] marker-invalid");
    }
  }
  summary.total += 1;
  summary.categories[`lighthouse.${category}`] =
    (summary.categories[`lighthouse.${category}`] || 0) + 1;
  mkdirSync(path.dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, `${JSON.stringify(summary, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function installPageGuard(page) {
  await page.setBypassServiceWorker(true);
  const session = await page.createCDPSession();
  session.on("Network.webSocketCreated", ({ url }) => {
    const violation = classify(url);
    if (violation) record(`websocket.${violation}`);
  });
  await session.send("Network.enable");
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const rawUrl = request.url();
    let target;
    try {
      target = new URL(rawUrl);
    } catch {
      record("invalid-url");
      await request.abort("blockedbyclient").catch(() => undefined);
      return;
    }
    if (isLoopback(target.hostname.toLowerCase())) {
      await request.continue().catch(() => undefined);
      return;
    }
    const violation = classify(rawUrl);
    if (violation) record(violation);
    // Keep the audit network-contained. Unrelated providers are contained but
    // are not mislabeled as Supabase safety violations.
    await request.abort("blockedbyclient").catch(() => undefined);
  });
}

module.exports = async function publicLighthouseSafetyGuard(browser) {
  const pages = await browser.pages();
  if (pages.length === 0) {
    throw new Error("[VS_LIGHTHOUSE_GUARD] page-missing");
  }
  await Promise.all(pages.map((page) => installPageGuard(page)));
  browser.on("targetcreated", async (target) => {
    const page = await target.page();
    if (page) await installPageGuard(page);
  });
};

module.exports.classify = classify;
module.exports.installPageGuard = installPageGuard;
