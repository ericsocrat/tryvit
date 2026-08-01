import { once } from "node:events";
import { createServer } from "node:http";

import { expect, test } from "./fixtures/safe-test";
import {
  createEgressAudit,
  installBrowserEgressGuards,
  loadSafetyContractFromEnvironment,
} from "./helpers/visual-safety";
import { startLoopbackEgressProxy } from "./helpers/loopback-egress-proxy";

async function expectedViolationProxy(allowedLoopbackOrigins?: readonly string[]) {
  const contract = loadSafetyContractFromEnvironment(process.env);
  return startLoopbackEgressProxy({
    writeViolationMarker: false,
    contract,
    allowedLoopbackOrigins: allowedLoopbackOrigins ?? [contract.appOrigin],
  });
}

test.describe("visual-safety browser transport", () => {
  test("blocks synthetic hosted HTTP before the loopback proxy", async ({ browser }) => {
    const contract = loadSafetyContractFromEnvironment(process.env);
    const audit = createEgressAudit();
    const proxy = await expectedViolationProxy();
    const context = await browser.newContext({
      serviceWorkers: "block",
      proxy: { server: proxy.origin },
    });
    try {
      await installBrowserEgressGuards(context, contract, audit);
      const page = await context.newPage();

      const transmitted = await page.evaluate(async () => {
        try {
          await fetch("http://synthetic-hosted.supabase.co/rest/v1/products");
          return true;
        } catch {
          return false;
        }
      });

      expect(transmitted).toBe(false);
      expect(audit.summary()).toEqual({
        total: 1,
        categories: { "http.hosted-supabase-origin": 1 },
      });
      expect(proxy.summary.total).toBe(0);
    } finally {
      await context.close();
      await proxy.close();
    }
  });

  test("blocks a synthetic custom-domain Supabase service path", async ({ browser }) => {
    const contract = loadSafetyContractFromEnvironment(process.env);
    const audit = createEgressAudit();
    const proxy = await expectedViolationProxy();
    const context = await browser.newContext({
      serviceWorkers: "block",
      proxy: { server: proxy.origin },
    });
    try {
      await installBrowserEgressGuards(context, contract, audit);
      const page = await context.newPage();

      await page.evaluate(async () => {
        await fetch("http://custom.synthetic.test/auth/v1/token").catch(() => {});
      });

      expect(audit.summary()).toEqual({
        total: 1,
        categories: { "http.non-loopback-supabase-service": 1 },
      });
      expect(proxy.summary.total).toBe(0);
    } finally {
      await context.close();
      await proxy.close();
    }
  });

  test("intercepts a loopback redirect before its hosted second hop", async ({ browser }) => {
    let firstHopCount = 0;
    const redirector = createServer((_request, response) => {
      firstHopCount += 1;
      response.writeHead(302, {
        Location: "http://synthetic-redirect.supabase.co/auth/v1/token",
      });
      response.end();
    });
    redirector.listen(0, "127.0.0.1");
    await once(redirector, "listening");
    const address = redirector.address();
    if (!address || typeof address === "string") {
      throw new Error("[VS_TEST_LISTENER] loopback-address");
    }

    const contract = loadSafetyContractFromEnvironment(process.env);
    const audit = createEgressAudit();
    const proxy = await expectedViolationProxy([`http://127.0.0.1:${address.port}`]);
    const context = await browser.newContext({
      serviceWorkers: "block",
      proxy: { server: proxy.origin },
    });
    try {
      await installBrowserEgressGuards(context, contract, audit);
      const page = await context.newPage();

      await page.goto(`http://127.0.0.1:${address.port}/redirect`).catch(() => {});

      expect(firstHopCount).toBe(1);
      expect(audit.summary()).toEqual({ total: 0, categories: {} });
      expect(proxy.summary).toEqual({
        total: 1,
        categories: { "proxy-http-hosted-supabase-origin": 1 },
      });
    } finally {
      await context.close();
      await proxy.close();
      await new Promise<void>((resolve) => redirector.close(() => resolve()));
    }
  });

  test("closes hosted Realtime without server connection", async ({ browser }) => {
    const contract = loadSafetyContractFromEnvironment(process.env);
    const audit = createEgressAudit();
    const proxy = await expectedViolationProxy();
    const context = await browser.newContext({
      serviceWorkers: "block",
      proxy: { server: proxy.origin },
    });
    try {
      await installBrowserEgressGuards(context, contract, audit);
      const page = await context.newPage();

      const outcome = await page.evaluate(
        (url) =>
          new Promise<string>((resolve) => {
            const socket = new WebSocket(url);
            socket.addEventListener("open", () => resolve("open"));
            socket.addEventListener("close", () => resolve("closed"));
            socket.addEventListener("error", () => resolve("blocked"));
            setTimeout(() => resolve("timeout"), 2_000);
          }),
        "wss://synthetic-hosted.supabase.co/realtime/v1/websocket",
      );

      expect(outcome).not.toBe("open");
      expect(audit.summary()).toEqual({
        total: 1,
        categories: { "websocket.hosted-supabase-origin": 1 },
      });
      expect(proxy.summary.total).toBe(0);
    } finally {
      await context.close();
      await proxy.close();
    }
  });

  test("closes a custom-domain Realtime service path", async ({ browser }) => {
    const contract = loadSafetyContractFromEnvironment(process.env);
    const audit = createEgressAudit();
    const proxy = await expectedViolationProxy();
    const context = await browser.newContext({
      serviceWorkers: "block",
      proxy: { server: proxy.origin },
    });
    try {
      await installBrowserEgressGuards(context, contract, audit);
      const page = await context.newPage();
      const outcome = await page.evaluate(
        (url) =>
          new Promise<string>((resolve) => {
            const socket = new WebSocket(url);
            socket.addEventListener("open", () => resolve("open"));
            socket.addEventListener("close", () => resolve("closed"));
            socket.addEventListener("error", () => resolve("blocked"));
            setTimeout(() => resolve("timeout"), 2_000);
          }),
        "ws://custom.synthetic.test/realtime/v1/websocket",
      );
      expect(outcome).not.toBe("open");
      expect(audit.summary()).toEqual({
        total: 1,
        categories: { "websocket.non-loopback-supabase-service": 1 },
      });
      expect(proxy.summary.total).toBe(0);
    } finally {
      await context.close();
      await proxy.close();
    }
  });

  test("keeps service workers blocked in the safety context", async ({ browser }, testInfo) => {
    const contract = loadSafetyContractFromEnvironment(process.env);
    const audit = createEgressAudit();
    const proxy = await expectedViolationProxy();
    const context = await browser.newContext({
      serviceWorkers: "block",
      proxy: { server: proxy.origin },
    });
    try {
      await installBrowserEgressGuards(context, contract, audit);
      const page = await context.newPage();
      await page.goto(contract.appOrigin);
      await page.screenshot({
        path: testInfo.outputPath("public-screenshot-dry-run.png"),
        fullPage: true,
      });
      await page.evaluate(async () => {
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.register("/sw.js").catch(() => undefined);
        }
      });
      expect(context.serviceWorkers()).toHaveLength(0);
      expect(audit.summary().total).toBe(0);
      expect(proxy.summary.total).toBe(0);
    } finally {
      await context.close();
      await proxy.close();
    }
  });
});
