import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { BrowserContext, Route, WebSocketRoute } from "@playwright/test";
import type { WebSocketLike, WebSocketLikeConstructor } from "@supabase/realtime-js";
import { afterEach, describe, expect, it, vi } from "vitest";

// Safety infrastructure intentionally lives outside production src/.
// eslint-disable-next-line no-restricted-imports
import {
  VisualSafetyError,
  VISUAL_SAFETY_INVOCATION_SCHEMA_VERSION,
  assertNoEgressViolations,
  canonicalizeLoopbackOrigin,
  classifyForbiddenEgress,
  createBuildProvenance,
  createEgressAudit,
  createGuardedFetch,
  createGuardedWebSocketConstructor,
  createLocalAuthenticatedSafetyContract,
  createPublicSafetyContract,
  discoverLocalSupabaseOrigin,
  installBrowserEgressGuards,
  loadSafetyContractFromEnvironment,
  parseLocalSupabaseConfig,
  safeNextBuildPath,
  scanGeneratedAssets,
  validateInvocationProof,
  verifyBuildProvenance,
} from "../e2e/helpers/visual-safety";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tryvit-visual-safety-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) continue;
    const resolved = path.resolve(root);
    expect(path.dirname(resolved)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(resolved)).toMatch(/^tryvit-visual-safety-/u);
    await fs.rm(resolved, { recursive: true, force: true });
  }
});

function expectSafetyError(action: () => unknown, code: string): VisualSafetyError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(VisualSafetyError);
    expect((error as VisualSafetyError).code).toBe(code);
    return error as VisualSafetyError;
  }
  throw new Error("Expected a VisualSafetyError");
}

async function expectAsyncSafetyError(
  action: () => Promise<unknown>,
  code: string,
): Promise<VisualSafetyError> {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(VisualSafetyError);
    expect((error as VisualSafetyError).code).toBe(code);
    return error as VisualSafetyError;
  }
  throw new Error("Expected a VisualSafetyError");
}

describe("canonicalizeLoopbackOrigin", () => {
  it.each([
    ["http://localhost", "http://localhost", 80],
    ["https://localhost:4443/", "https://localhost:4443", 4443],
    ["http://127.0.0.1:55001", "http://127.0.0.1:55001", 55001],
    ["http://[::1]:3000", "http://[::1]:3000", 3000],
  ])("accepts canonical loopback origin %s", (input, origin, port) => {
    expect(canonicalizeLoopbackOrigin(input)).toMatchObject({
      origin,
      effectivePort: port,
    });
  });

  it.each([
    "https://example.supabase.co",
    "https://tryvit.vercel.app",
    "https://example.test",
    "http://localhost.example.com",
    "http://localhost@evil.example",
    "http://localhost.",
    "http://0.0.0.0:3000",
    "http://192.168.1.2:3000",
    "http://169.254.1.2:3000",
    "http://host.docker.internal:3000",
    "http://127.1:3000",
    "http://0177.0.0.1:3000",
    "http://0x7f000001:3000",
    "http://2130706433:3000",
    "http://[0:0:0:0:0:0:0:1]:3000",
    "http://[::ffff:127.0.0.1]:3000",
    "http://user:password@localhost:3000",
    "http://localhost:3000/path",
    "http://localhost:3000?key=canary-query",
    "http://localhost:3000#canary-fragment",
    "ws://localhost:3000",
    "HTTP://localhost:3000",
    " http://localhost:3000",
    "http://localhost:0",
    "http://localhost:65536",
    "not a url",
  ])("rejects unsafe or noncanonical origin %s", (input) => {
    const error = expectSafetyError(() => canonicalizeLoopbackOrigin(input), "VS_ORIGIN_INVALID");
    expect(error.message).not.toContain("canary-query");
    expect(error.message).not.toContain("canary-fragment");
    expect(error.message).not.toContain("password");
  });
});

describe("launcher invocation proof", () => {
  const ownerToken = "12345678-1234-4234-9234-123456789abc";
  const contract = createPublicSafetyContract({
    appOrigin: "http://127.0.0.1:3000",
  });
  const expected = {
    ownerToken,
    launcherPid: 101,
    contract,
    proxyOrigin: "http://127.0.0.1:43111",
  };
  const proof = {
    schemaVersion: VISUAL_SAFETY_INVOCATION_SCHEMA_VERSION,
    ownerToken,
    launcherPid: 101,
    serverPid: 202,
    mode: "public",
    appOrigin: contract.appOrigin,
    proxyOrigin: expected.proxyOrigin,
  } as const;

  it("accepts only the exact launcher, server, contract, proxy and nonce", () => {
    expect(validateInvocationProof(proof, expected)).toEqual(proof);
    for (const mismatch of [
      { ...proof, ownerToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { ...proof, launcherPid: 102 },
      { ...proof, serverPid: 0 },
      { ...proof, proxyOrigin: "http://127.0.0.1:43112" },
      { ...proof, extra: true },
    ]) {
      expectSafetyError(() => validateInvocationProof(mismatch, expected), "VS_INVOCATION_PROOF");
    }
  });
});

describe("local Supabase configuration discovery", () => {
  it("parses the API port and TLS setting from their exact TOML sections", () => {
    expect(
      parseLocalSupabaseConfig(`
        [db]
        port = 9999
        [api]
        port = 55001 # local API
        [api.tls]
        enabled = false
      `),
    ).toEqual({ apiPort: 55001, apiTlsEnabled: false });
  });

  it("rejects missing, duplicate, zero, and oversized API ports", () => {
    for (const config of [
      "[db]\nport = 55001",
      "[api]\nport = 55001\nport = 55002",
      "[api]\nport = 0",
      "[api]\nport = 65536",
      '[api]\nport = "55001"',
      "[api]\nport = 55001\n[api.tls]\nenabled = maybe",
    ]) {
      expectSafetyError(() => parseLocalSupabaseConfig(config), "VS_CONFIG_INVALID");
    }
  });

  it("discovers the repository's checked-in non-default API port", async () => {
    const configPath = path.resolve(process.cwd(), "../supabase/config.toml");
    const discovered = await discoverLocalSupabaseOrigin(configPath);
    expect(discovered.origin).toBe("http://127.0.0.1:55001");
    expect(discovered.effectivePort).not.toBe(54321);
  });

  it("discovers a synthetic TLS-enabled configuration without reading env", async () => {
    const root = await makeTempRoot();
    const configPath = path.join(root, "config.toml");
    await fs.writeFile(configPath, "[api]\nport = 55443\n[api.tls]\nenabled = true\n", "utf8");
    await expect(discoverLocalSupabaseOrigin(configPath)).resolves.toMatchObject({
      origin: "https://127.0.0.1:55443",
    });
  });
});

describe("explicit safety contracts", () => {
  it("reproduces the former ambient-auth inference with synthetic values, then fails closed", () => {
    const syntheticLegacyEnvironment = {
      NEXT_PUBLIC_SUPABASE_URL: "https://synthetic-legacy.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role-canary",
    };
    let legacyClientConstructions = 0;
    const legacyHasAuth = Boolean(
      syntheticLegacyEnvironment.NEXT_PUBLIC_SUPABASE_URL &&
      syntheticLegacyEnvironment.SUPABASE_SERVICE_ROLE_KEY,
    );
    if (legacyHasAuth) legacyClientConstructions += 1;
    expect(legacyClientConstructions).toBe(1);

    let guardedClientConstructions = 0;
    expect(() => {
      loadSafetyContractFromEnvironment({
        VISUAL_SAFETY_MODE: "local-authenticated",
        VISUAL_SAFETY_APP_ORIGIN: "http://127.0.0.1:3000",
        VISUAL_SAFETY_SUPABASE_ORIGIN: syntheticLegacyEnvironment.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: syntheticLegacyEnvironment.SUPABASE_SERVICE_ROLE_KEY,
      });
      guardedClientConstructions += 1;
    }).toThrow(VisualSafetyError);
    expect(guardedClientConstructions).toBe(0);
  });

  it("bootstraps public mode without any Supabase configuration", () => {
    expect(createPublicSafetyContract({ appOrigin: "http://localhost:3000" })).toMatchObject({
      mode: "public",
      appOrigin: "http://localhost:3000",
      supabaseOrigin: null,
    });
  });

  it("loads public mode without Supabase variables", () => {
    expect(
      loadSafetyContractFromEnvironment({
        VISUAL_SAFETY_MODE: "public",
        VISUAL_SAFETY_APP_ORIGIN: "http://127.0.0.1:3000",
      }),
    ).toMatchObject({ mode: "public", supabaseOrigin: null });
  });

  it.each([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY_STAGING",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "STAGING_URL",
    "STAGING_SERVICE_KEY",
    "PRODUCTION_URL",
    "PRODUCTION_SERVICE_KEY",
    "VISUAL_SAFETY_BUILD_SUPABASE_ORIGIN",
    "VISUAL_SAFETY_BUILD_ADAPTER_ID",
  ])("rejects %s in a public browser environment without echoing it", (name) => {
    const error = expectSafetyError(
      () =>
        loadSafetyContractFromEnvironment({
          VISUAL_SAFETY_MODE: "public",
          VISUAL_SAFETY_APP_ORIGIN: "http://localhost:3000",
          [name]: "canary-public-credential",
        }),
      "VS_ENV_FORBIDDEN",
    );
    expect(error.message).not.toContain("canary-public-credential");
    expect(JSON.stringify(error)).not.toContain("canary-public-credential");
  });

  it("requires an explicitly local Supabase origin in authenticated mode", () => {
    expectSafetyError(
      () =>
        loadSafetyContractFromEnvironment({
          VISUAL_SAFETY_MODE: "local-authenticated",
          VISUAL_SAFETY_APP_ORIGIN: "http://localhost:3000",
        }),
      "VS_ENV_MISSING",
    );

    expect(
      loadSafetyContractFromEnvironment({
        VISUAL_SAFETY_MODE: "local-authenticated",
        VISUAL_SAFETY_APP_ORIGIN: "http://localhost:3000",
        VISUAL_SAFETY_SUPABASE_ORIGIN: "http://127.0.0.1:55001",
      }),
    ).toMatchObject({
      mode: "local-authenticated",
      supabaseOrigin: "http://127.0.0.1:55001",
    });
  });

  it("rejects hosted auth configuration even when a service role exists", () => {
    const error = expectSafetyError(
      () =>
        loadSafetyContractFromEnvironment({
          VISUAL_SAFETY_MODE: "local-authenticated",
          VISUAL_SAFETY_APP_ORIGIN: "http://localhost:3000",
          VISUAL_SAFETY_SUPABASE_ORIGIN: "https://synthetic-hosted.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "canary-service-role",
        }),
      "VS_ORIGIN_INVALID",
    );
    expect(error.message).not.toContain("canary-service-role");
    expect(error.message).not.toContain("synthetic-hosted");
  });
});

describe("egress classification and audit", () => {
  const publicContract = createPublicSafetyContract({
    appOrigin: "http://localhost:3000",
    knownHostedSupabaseOrigins: ["https://data.synthetic.test"],
  });

  it.each([
    ["https://project.supabase.co/rest/v1/products", "http", "hosted-supabase-origin"],
    ["wss://project.supabase.co/realtime/v1/websocket", "websocket", "hosted-supabase-origin"],
    ["https://custom.synthetic.test/auth/v1/token", "http", "non-loopback-supabase-service"],
    ["https://custom.synthetic.test/rest%2fv1/products", "http", "non-loopback-supabase-service"],
    ["https://custom.synthetic.test//rest/v1/products", "http", "non-loopback-supabase-service"],
    [
      "wss://custom.synthetic.test/realtime/v1/websocket",
      "websocket",
      "non-loopback-supabase-service",
    ],
    ["https://data.synthetic.test/anything", "http", "known-hosted-supabase-origin"],
  ] as const)("blocks %s", (url, transport, category) => {
    expect(classifyForbiddenEgress(url, transport, publicContract)).toEqual({
      transport,
      category,
    });
  });

  it("allows ordinary public traffic and loopback Supabase service paths", () => {
    expect(
      classifyForbiddenEgress("https://images.synthetic.test/image.png", "http", publicContract),
    ).toBeNull();
    expect(
      classifyForbiddenEgress("http://127.0.0.1:55001/rest/v1/products", "http", publicContract),
    ).toBeNull();
  });

  it("records categories and counts only, then fails the final assertion", () => {
    const audit = createEgressAudit();
    const violation = classifyForbiddenEgress(
      "https://project.supabase.co/rest/v1/products?token=canary",
      "http",
      publicContract,
    );
    expect(violation).not.toBeNull();
    audit.record(violation!);
    audit.record(violation!);

    expect(audit.summary()).toEqual({
      total: 2,
      categories: { "http.hosted-supabase-origin": 2 },
    });
    const error = expectSafetyError(() => assertNoEgressViolations(audit), "VS_EGRESS_BLOCKED");
    expect(error.message).not.toContain("project.supabase.co");
    expect(error.message).not.toContain("canary");
  });
});

describe("guarded fetch", () => {
  const allowedOrigin = "http://127.0.0.1:55001";

  it("blocks a synthetic hosted first hop before invoking fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const guardedFetch = createGuardedFetch({
      allowedOrigin,
      fetchImpl,
    });
    await expectAsyncSafetyError(
      () => guardedFetch("https://synthetic-hosted.supabase.co/rest/v1/products"),
      "VS_FETCH_BLOCKED",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("follows a safe relative loopback redirect with manual mode", async () => {
    const seen: Array<{ path: string; redirect: RequestRedirect }> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      const url = new URL(request.url);
      seen.push({ path: url.pathname, redirect: request.redirect });
      if (url.pathname === "/auth/v1/start") {
        return new Response(null, {
          status: 302,
          headers: { location: "../ready" },
        });
      }
      return new Response("ok", { status: 200 });
    });
    const guardedFetch = createGuardedFetch({ allowedOrigin, fetchImpl });

    const response = await guardedFetch(`${allowedOrigin}/auth/v1/start`);
    expect(response.status).toBe(200);
    expect(seen).toEqual([
      { path: "/auth/v1/start", redirect: "manual" },
      { path: "/auth/ready", redirect: "manual" },
    ]);
  });

  it("does not follow a loopback redirect to a hosted target", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(null, {
          status: 307,
          headers: {
            location: "https://synthetic-hosted.supabase.co/rest/v1/canary-secret",
          },
        }),
    );
    const guardedFetch = createGuardedFetch({ allowedOrigin, fetchImpl });

    const error = await expectAsyncSafetyError(
      () => guardedFetch(`${allowedOrigin}/rest/v1/products`),
      "VS_FETCH_BLOCKED",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(error.message).not.toContain("synthetic-hosted");
    expect(error.message).not.toContain("canary-secret");
  });

  it("rejects redirect loops and excessive hops", async () => {
    const loopFetch = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 302, headers: { location: "/loop" } }),
    );
    await expectAsyncSafetyError(
      () => createGuardedFetch({ allowedOrigin, fetchImpl: loopFetch })(`${allowedOrigin}/loop`),
      "VS_FETCH_REDIRECT",
    );
    expect(loopFetch).toHaveBeenCalledTimes(1);

    let hop = 0;
    const hoppingFetch = vi.fn<typeof fetch>(async () => {
      hop += 1;
      return new Response(null, {
        status: 302,
        headers: { location: `/hop-${hop}` },
      });
    });
    await expectAsyncSafetyError(
      () =>
        createGuardedFetch({
          allowedOrigin,
          fetchImpl: hoppingFetch,
          maxRedirects: 1,
        })(`${allowedOrigin}/start`),
      "VS_FETCH_REDIRECT",
    );
    expect(hoppingFetch).toHaveBeenCalledTimes(2);
  });

  it("supports a no-redirect readiness policy", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "/auth/v1/health" },
        }),
    );
    await expectAsyncSafetyError(
      () =>
        createGuardedFetch({
          allowedOrigin,
          fetchImpl,
          maxRedirects: 0,
        })(`${allowedOrigin}/auth/v1/health`),
      "VS_FETCH_REDIRECT",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("applies Fetch method rules without exposing request bodies", async () => {
    const seen: Array<{ method: string; body: string }> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      seen.push({ method: request.method, body: await request.text() });
      if (seen.length === 1) {
        return new Response(null, {
          status: 303,
          headers: { location: "/rest/v1/complete" },
        });
      }
      return new Response(null, { status: 204 });
    });
    const guardedFetch = createGuardedFetch({ allowedOrigin, fetchImpl });
    await guardedFetch(`${allowedOrigin}/rest/v1/start`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "canary-body",
    });
    expect(seen).toEqual([
      { method: "POST", body: "canary-body" },
      { method: "GET", body: "" },
    ]);
  });

  it("redacts transport failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("request failed for http://127.0.0.1:55001/?token=canary-token");
    });
    const error = await expectAsyncSafetyError(
      () => createGuardedFetch({ allowedOrigin, fetchImpl })(`${allowedOrigin}/auth/v1/health`),
      "VS_FETCH_FAILED",
    );
    expect(error.message).not.toContain("canary-token");
    expect(JSON.stringify(error)).not.toContain("canary-token");
  });
});

describe("guarded Node WebSocket transport", () => {
  class FakeWebSocket implements Partial<WebSocketLike> {
    static readonly calls: string[] = [];
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readonly readyState = 0;
    readonly url: string;
    readonly protocol = "";
    onopen = null;
    onmessage = null;
    onclose = null;
    onerror = null;

    constructor(address: string | URL) {
      this.url = String(address);
      FakeWebSocket.calls.push(this.url);
    }

    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  }

  function makeGuardedConstructor() {
    FakeWebSocket.calls.length = 0;
    return createGuardedWebSocketConstructor({
      allowedOrigin: "http://127.0.0.1:55001",
      WebSocketImpl: FakeWebSocket as unknown as WebSocketLikeConstructor,
    });
  }

  it("constructs a transport only for the exact local Realtime target", () => {
    const GuardedWebSocket = makeGuardedConstructor();
    new GuardedWebSocket("ws://127.0.0.1:55001/realtime/v1/websocket?apikey=local-canary");
    expect(FakeWebSocket.calls).toHaveLength(1);
  });

  it.each([
    "wss://synthetic.supabase.co/realtime/v1/websocket?apikey=canary-key",
    "ws://custom.synthetic.test/realtime/v1/websocket?apikey=canary-key",
    "ws://127.0.0.1:55002/realtime/v1/websocket?apikey=canary-key",
    "ws://127.0.0.1:55001/not-realtime?apikey=canary-key",
  ])("blocks %s before invoking the underlying constructor", (target) => {
    const GuardedWebSocket = makeGuardedConstructor();
    const error = expectSafetyError(() => new GuardedWebSocket(target), "VS_WEBSOCKET_BLOCKED");
    expect(FakeWebSocket.calls).toHaveLength(0);
    expect(error.message).not.toContain("canary-key");
    expect(error.message).not.toContain("synthetic.supabase.co");
  });
});

describe("browser guard installation with transport stubs", () => {
  function mockContext() {
    let httpHandler: ((route: Route) => Promise<void>) | undefined;
    let websocketHandler: ((route: WebSocketRoute) => Promise<void>) | undefined;
    const context = {
      pages: vi.fn(() => []),
      serviceWorkers: vi.fn(() => []),
      route: vi.fn(async (_pattern, handler) => {
        httpHandler = handler;
      }),
      routeWebSocket: vi.fn(async (_pattern, handler) => {
        websocketHandler = handler;
      }),
    } as unknown as BrowserContext;
    return {
      context,
      getHttpHandler: () => httpHandler!,
      getWebSocketHandler: () => websocketHandler!,
    };
  }

  const contract = createPublicSafetyContract({
    appOrigin: "http://localhost:3000",
  });

  it("aborts and records forbidden HTTP without continuing it", async () => {
    const mocked = mockContext();
    const audit = createEgressAudit();
    await installBrowserEgressGuards(mocked.context, contract, audit);
    const route = {
      request: () => ({
        url: () => "https://synthetic.supabase.co/rest/v1/products",
      }),
      abort: vi.fn(async () => undefined),
      continue: vi.fn(async () => undefined),
    } as unknown as Route;
    await mocked.getHttpHandler()(route);
    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.continue).not.toHaveBeenCalled();
    expect(audit.summary().total).toBe(1);
  });

  it("closes forbidden WebSockets without connecting to the server", async () => {
    const mocked = mockContext();
    const audit = createEgressAudit();
    await installBrowserEgressGuards(mocked.context, contract, audit);
    const route = {
      url: () => "wss://synthetic.supabase.co/realtime/v1/websocket",
      close: vi.fn(async () => undefined),
      connectToServer: vi.fn(),
    } as unknown as WebSocketRoute;
    await mocked.getWebSocketHandler()(route);
    expect(route.close).toHaveBeenCalledWith({
      code: 1008,
      reason: "visual safety",
    });
    expect(route.connectToServer).not.toHaveBeenCalled();
    expect(audit.summary().total).toBe(1);
  });

  it("continues allowed HTTP and local WebSockets", async () => {
    const mocked = mockContext();
    const audit = createEgressAudit();
    await installBrowserEgressGuards(mocked.context, contract, audit);
    const httpRoute = {
      request: () => ({ url: () => "http://localhost:3000/" }),
      abort: vi.fn(),
      continue: vi.fn(async () => undefined),
    } as unknown as Route;
    const websocketRoute = {
      url: () => "ws://127.0.0.1:55001/realtime/v1/websocket",
      close: vi.fn(),
      connectToServer: vi.fn(),
    } as unknown as WebSocketRoute;
    await mocked.getHttpHandler()(httpRoute);
    await mocked.getWebSocketHandler()(websocketRoute);
    expect(httpRoute.continue).toHaveBeenCalledOnce();
    expect(websocketRoute.connectToServer).toHaveBeenCalledOnce();
    expect(audit.summary().total).toBe(0);
  });

  it("contains unrelated external providers without classifying them as Supabase", async () => {
    const mocked = mockContext();
    const audit = createEgressAudit();
    await installBrowserEgressGuards(mocked.context, contract, audit);
    const httpRoute = {
      request: () => ({
        url: () => "https://public-provider.synthetic.test/widget.js",
      }),
      abort: vi.fn(async () => undefined),
      continue: vi.fn(async () => undefined),
    } as unknown as Route;
    const websocketRoute = {
      url: () => "wss://public-provider.synthetic.test/socket",
      close: vi.fn(async () => undefined),
      connectToServer: vi.fn(),
    } as unknown as WebSocketRoute;

    await mocked.getHttpHandler()(httpRoute);
    await mocked.getWebSocketHandler()(websocketRoute);

    expect(httpRoute.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(httpRoute.continue).not.toHaveBeenCalled();
    expect(websocketRoute.close).toHaveBeenCalledWith({
      code: 1008,
      reason: "visual containment",
    });
    expect(websocketRoute.connectToServer).not.toHaveBeenCalled();
    expect(audit.summary()).toEqual({ total: 0, categories: {} });
  });

  it.each([
    ["public", contract],
    [
      "local-authenticated",
      createLocalAuthenticatedSafetyContract({
        appOrigin: "http://localhost:3000",
        supabaseOrigin: "http://127.0.0.1:55001",
      }),
    ],
  ] as const)(
    "locally fulfills only the exact Turnstile script in %s mode",
    async (_mode, safetyContract) => {
      const mocked = mockContext();
      const audit = createEgressAudit();
      await installBrowserEgressGuards(mocked.context, safetyContract, audit);
      const route = {
        request: () => ({
          url: () =>
            "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit",
          resourceType: () => "script",
        }),
        abort: vi.fn(async () => undefined),
        continue: vi.fn(async () => undefined),
        fulfill: vi.fn(async () => undefined),
      } as unknown as Route;

      await mocked.getHttpHandler()(route);

      expect(route.fulfill).toHaveBeenCalledWith({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: "/* TryVit visual-safety: Cloudflare Turnstile intentionally contained. */",
      });
      expect(route.abort).not.toHaveBeenCalled();
      expect(route.continue).not.toHaveBeenCalled();
      expect(audit.summary()).toEqual({ total: 0, categories: {} });
    },
  );

  it.each([
    [
      "wrong callback",
      "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=unexpected&render=explicit",
      "script",
    ],
    [
      "extra query parameter",
      "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit&extra=1",
      "script",
    ],
    [
      "wrong resource type",
      "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit",
      "xhr",
    ],
    [
      "wrong path",
      "https://challenges.cloudflare.com/turnstile/v0/api-alt.js?onload=onloadTurnstileCallback&render=explicit",
      "script",
    ],
  ])("continues to contain non-exact Turnstile request: %s", async (_reason, url, resourceType) => {
    const mocked = mockContext();
    const audit = createEgressAudit();
    await installBrowserEgressGuards(mocked.context, contract, audit);
    const route = {
      request: () => ({
        url: () => url,
        resourceType: () => resourceType,
      }),
      abort: vi.fn(async () => undefined),
      continue: vi.fn(async () => undefined),
      fulfill: vi.fn(async () => undefined),
    } as unknown as Route;

    await mocked.getHttpHandler()(route);

    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.fulfill).not.toHaveBeenCalled();
    expect(route.continue).not.toHaveBeenCalled();
    expect(audit.summary()).toEqual({ total: 0, categories: {} });
  });

  it.each([
    ["public", contract],
    [
      "local-authenticated",
      createLocalAuthenticatedSafetyContract({
        appOrigin: "http://localhost:3000",
        supabaseOrigin: "http://127.0.0.1:55001",
      }),
    ],
  ] as const)(
    "locally fulfills the exact Speed Insights script in %s mode",
    async (_mode, safetyContract) => {
      const mocked = mockContext();
      const audit = createEgressAudit();
      await installBrowserEgressGuards(mocked.context, safetyContract, audit);
      const route = {
        request: () => ({
          url: () => "http://localhost:3000/_vercel/speed-insights/script.js",
          resourceType: () => "script",
        }),
        abort: vi.fn(async () => undefined),
        continue: vi.fn(async () => undefined),
        fulfill: vi.fn(async () => undefined),
      } as unknown as Route;

      await mocked.getHttpHandler()(route);

      expect(route.fulfill).toHaveBeenCalledWith({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: "/* TryVit visual-safety: local Vercel Speed Insights intentionally contained. */",
      });
      expect(route.abort).not.toHaveBeenCalled();
      expect(route.continue).not.toHaveBeenCalled();
      expect(audit.summary()).toEqual({ total: 0, categories: {} });
    },
  );

  it.each([
    [
      "query string",
      "http://localhost:3000/_vercel/speed-insights/script.js?debug=1",
      "script",
      "continue",
    ],
    [
      "fragment",
      "http://localhost:3000/_vercel/speed-insights/script.js#canary",
      "script",
      "continue",
    ],
    [
      "credentials",
      "http://user:password@localhost:3000/_vercel/speed-insights/script.js",
      "script",
      "continue",
    ],
    [
      "another /_vercel path",
      "http://localhost:3000/_vercel/analytics/script.js",
      "script",
      "continue",
    ],
    [
      "path suffix",
      "http://localhost:3000/_vercel/speed-insights/script.js.map",
      "script",
      "continue",
    ],
    [
      "wrong resource type",
      "http://localhost:3000/_vercel/speed-insights/script.js",
      "fetch",
      "continue",
    ],
    [
      "different loopback origin",
      "http://127.0.0.1:3000/_vercel/speed-insights/script.js",
      "script",
      "continue",
    ],
    [
      "external origin",
      "https://insights.synthetic.test/_vercel/speed-insights/script.js",
      "script",
      "abort",
    ],
  ] as const)(
    "does not fulfill a non-exact Speed Insights request: %s",
    async (_reason, url, resourceType, disposition) => {
      const mocked = mockContext();
      const audit = createEgressAudit();
      await installBrowserEgressGuards(mocked.context, contract, audit);
      const route = {
        request: () => ({ url: () => url, resourceType: () => resourceType }),
        abort: vi.fn(async () => undefined),
        continue: vi.fn(async () => undefined),
        fulfill: vi.fn(async () => undefined),
      } as unknown as Route;

      await mocked.getHttpHandler()(route);

      expect(route.fulfill).not.toHaveBeenCalled();
      if (disposition === "abort") {
        expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
        expect(route.continue).not.toHaveBeenCalled();
      } else {
        expect(route.continue).toHaveBeenCalledOnce();
        expect(route.abort).not.toHaveBeenCalled();
      }
      expect(audit.summary()).toEqual({ total: 0, categories: {} });
    },
  );

  it("refuses installation after page or service-worker creation", async () => {
    for (const override of [
      { pages: () => [{}], serviceWorkers: () => [] },
      { pages: () => [], serviceWorkers: () => [{}] },
    ]) {
      const context = {
        ...override,
        route: vi.fn(),
        routeWebSocket: vi.fn(),
      } as unknown as BrowserContext;
      await expect(
        installBrowserEgressGuards(context, contract, createEgressAudit()),
      ).rejects.toBeInstanceOf(VisualSafetyError);
      expect(context.route).not.toHaveBeenCalled();
      expect(context.routeWebSocket).not.toHaveBeenCalled();
    }
  });
});

describe("safe .next path validation", () => {
  it("accepts only the exact real frontend/.next directory", async () => {
    const root = await makeTempRoot();
    const frontend = path.join(root, "frontend");
    const next = path.join(frontend, ".next");
    await fs.mkdir(next, { recursive: true });
    await expect(safeNextBuildPath(frontend, next)).resolves.toBe(await fs.realpath(next));
  });

  it("returns the exact owned path when .next does not exist", async () => {
    const root = await makeTempRoot();
    const frontend = path.join(root, "frontend");
    await fs.mkdir(frontend);
    await expect(safeNextBuildPath(frontend)).resolves.toBe(
      path.join(await fs.realpath(frontend), ".next"),
    );
  });

  it.each([".next-sibling", "nested/.next", "../frontend-copy/.next"])(
    "rejects lexical escape %s",
    async (suffix) => {
      const root = await makeTempRoot();
      const frontend = path.join(root, "frontend");
      await fs.mkdir(frontend);
      await expectAsyncSafetyError(
        () => safeNextBuildPath(frontend, path.join(frontend, suffix)),
        "VS_NEXT_PATH_UNSAFE",
      );
    },
  );

  it("rejects a .next symlink or Windows junction escape", async () => {
    const root = await makeTempRoot();
    const frontend = path.join(root, "frontend");
    const outside = path.join(root, "outside");
    const next = path.join(frontend, ".next");
    await fs.mkdir(frontend);
    await fs.mkdir(outside);
    await fs.symlink(outside, next, process.platform === "win32" ? "junction" : "dir");
    await expectAsyncSafetyError(() => safeNextBuildPath(frontend, next), "VS_NEXT_PATH_UNSAFE");
  });

  it("rejects a non-directory .next target", async () => {
    const root = await makeTempRoot();
    const frontend = path.join(root, "frontend");
    const next = path.join(frontend, ".next");
    await fs.mkdir(frontend);
    await fs.writeFile(next, "not a directory", "utf8");
    await expectAsyncSafetyError(() => safeNextBuildPath(frontend, next), "VS_NEXT_PATH_UNSAFE");
  });
});

describe("build provenance", () => {
  const contract = createPublicSafetyContract({
    appOrigin: "http://localhost:3000",
  });
  const input = {
    contract,
    sourceGitSha: "f2be7a41d49c579912285a36578b7666decbf5ce",
    buildId: "synthetic-build-id",
    buildInputIds: ["assets:0000000000000000000000000000000000000000000000000000000000000000"],
  } as const;

  it("creates deterministic non-secret provenance and verifies a match", () => {
    const first = createBuildProvenance(input);
    const second = createBuildProvenance(input);
    expect(first).toEqual(second);
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.supabaseOrigin).toBe("none");
    expect(first.publicBuildAdapterId).toBe("none");
    expect(() => verifyBuildProvenance(first, input)).not.toThrow();
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain("service-role");
    expect(serialized).not.toContain("anon-key");
    expect(serialized).not.toContain("cookie");
  });

  it("fails a build/runtime mismatch without exposing configuration", () => {
    const actual = createBuildProvenance(input);
    const mismatch = createBuildProvenance({
      ...input,
      buildId: "other-build-id",
    });
    const error = expectSafetyError(
      () => verifyBuildProvenance(actual, mismatch),
      "VS_PROVENANCE_MISMATCH",
    );
    expect(error.message).not.toContain(contract.appOrigin);
    expect(error.message).not.toContain("other-build-id");
  });

  it("rejects a canary or URL-shaped provenance input without echoing it", () => {
    const canary = "CANARY_PROVENANCE_SECRET_8a21";
    for (const unsafe of [
      canary,
      "https://synthetic.supabase.co",
      "opaque-high-entropy-value-4f6a9b2d8c1e7a",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcnkifQ.signature",
    ]) {
      const error = expectSafetyError(
        () =>
          createBuildProvenance({
            ...input,
            buildInputIds: [unsafe],
          }),
        "VS_PROVENANCE_INVALID",
      );
      expect(error.message).not.toContain(unsafe);
      expect(error.message).not.toContain(canary);
    }
  });

  it("detects a tampered fingerprint", () => {
    const provenance = createBuildProvenance(input);
    expectSafetyError(
      () => verifyBuildProvenance({ ...provenance, fingerprint: "0".repeat(64) }, provenance),
      "VS_PROVENANCE_MISMATCH",
    );
    expectSafetyError(
      () =>
        verifyBuildProvenance(provenance, {
          ...provenance,
          buildId: "tampered-build-id",
        }),
      "VS_PROVENANCE_MISMATCH",
    );
  });
});

describe("generated client asset scan", () => {
  async function makeBuild(contents: string): Promise<string> {
    const root = await makeTempRoot();
    const next = path.join(root, "frontend", ".next");
    await fs.mkdir(path.join(next, "static", "chunks"), { recursive: true });
    await fs.writeFile(path.join(next, "static", "chunks", "app.js"), contents, "utf8");
    return next;
  }

  it("passes clean generated assets and returns counts only", async () => {
    const next = await makeBuild('const endpoint = "http://127.0.0.1:55001/rest/v1";');
    await expect(scanGeneratedAssets(next)).resolves.toMatchObject({
      filesScanned: 1,
    });
  });

  it("does not treat SDK documentation inside a source map as executable config", async () => {
    const next = await makeBuild("const safe = true;");
    await fs.writeFile(
      path.join(next, "static", "chunks", "app.js.map"),
      JSON.stringify({
        version: 3,
        sources: ["../../node_modules/%40supabase/supabase-js/src/index.ts"],
        sourcesContent: ['const docs = "https://xyzcompany.supabase.co";'],
        names: [],
        mappings: "",
      }),
      "utf8",
    );
    await expect(scanGeneratedAssets(next)).resolves.toMatchObject({
      filesScanned: 2,
    });
  });

  it("requires installed-SDK content provenance for its bundled tracing source", async () => {
    const next = await makeBuild("const safe = true;");
    const frontend = path.dirname(next);
    const sdkMap = path.join(
      frontend,
      "node_modules",
      "@supabase",
      "supabase-js",
      "dist",
      "index.mjs.map",
    );
    const bundledSource = 'export const example = "https://myproject.supabase.co";';
    await fs.mkdir(path.dirname(sdkMap), { recursive: true });
    await fs.writeFile(
      sdkMap,
      JSON.stringify({
        version: 3,
        sources: ["../../../shared/tracing/dist/module/validate.js"],
        sourcesContent: [bundledSource],
        names: [],
        mappings: "",
      }),
      "utf8",
    );
    const generatedMap = path.join(next, "server", "chunks", "sdk.js.map");
    await fs.mkdir(path.dirname(generatedMap), { recursive: true });
    await fs.writeFile(
      generatedMap,
      JSON.stringify({
        version: 3,
        sources: ["../../../node_modules/shared/tracing/dist/module/validate.js"],
        sourcesContent: [bundledSource],
        names: [],
        mappings: "",
      }),
      "utf8",
    );
    await expect(scanGeneratedAssets(next)).resolves.toMatchObject({
      filesScanned: 2,
    });

    await fs.writeFile(
      generatedMap,
      JSON.stringify({
        version: 3,
        sources: ["../../../node_modules/shared/tracing/dist/module/validate.js"],
        sourcesContent: [`${bundledSource} `],
        names: [],
        mappings: "",
      }),
      "utf8",
    );
    await expectAsyncSafetyError(() => scanGeneratedAssets(next), "VS_ASSET_FORBIDDEN");
  });

  it("blocks a hosted origin in an application source map", async () => {
    const next = await makeBuild("const safe = true;");
    await fs.writeFile(
      path.join(next, "static", "chunks", "app.js.map"),
      JSON.stringify({
        version: 3,
        sources: ["../../src/lib/client.ts"],
        sourcesContent: ['const stale = "https://xyzcompany.supabase.co";'],
        names: [],
        mappings: "",
      }),
      "utf8",
    );
    await expectAsyncSafetyError(() => scanGeneratedAssets(next), "VS_ASSET_FORBIDDEN");
  });

  it.each([
    'const endpoint = "https://synthetic-hosted.supabase.co";',
    'const endpoint = "https://xyzcompany.supabase.co";',
    'const project = "uskvezwftkkudvksmken";',
  ])("blocks a hosted marker without printing asset content", async (contents) => {
    const next = await makeBuild(contents);
    const error = await expectAsyncSafetyError(
      () => scanGeneratedAssets(next),
      "VS_ASSET_FORBIDDEN",
    );
    expect(error.message).not.toContain("synthetic-hosted");
    expect(error.message).not.toContain("uskvezwftkkudvksmken");
    expect(error.message).not.toContain("app.js");
  });

  it("also scans generated server/app payloads that can contain client data", async () => {
    const next = await makeBuild("const safe = true;");
    await fs.mkdir(path.join(next, "server", "app"), { recursive: true });
    await fs.writeFile(
      path.join(next, "server", "app", "page.js"),
      'const stale = "https://synthetic.supabase.co";',
      "utf8",
    );
    await expectAsyncSafetyError(() => scanGeneratedAssets(next), "VS_ASSET_FORBIDDEN");
  });

  it.each([
    ["server/chunks/runtime.js", 'const stale = "https://deep.synthetic.supabase.co";'],
    ["static/css/app.css", "/* https://deep.synthetic.supabase.co */"],
  ])("scans %s for nested hosted origins", async (relative, contents) => {
    const next = await makeBuild("const safe = true;");
    const filename = path.join(next, ...relative.split("/"));
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, contents, "utf8");
    await expectAsyncSafetyError(() => scanGeneratedAssets(next), "VS_ASSET_FORBIDDEN");
  });

  it("fails closed when no generated client assets exist", async () => {
    const root = await makeTempRoot();
    const next = path.join(root, "frontend", ".next");
    await fs.mkdir(next, { recursive: true });
    await expectAsyncSafetyError(() => scanGeneratedAssets(next), "VS_ASSET_SCAN_FAILED");
  });
});
