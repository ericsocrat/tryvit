import { once } from "node:events";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { createServer as createHttpServer, request as httpRequest } from "node:http";
import { connect as netConnect, createServer as createNetServer, type Socket } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

// The runtime launcher is an ESM TypeScript entry point executed with Node's
// type-stripping loader; Vite resolves it directly for focused unit tests.
// eslint-disable-next-line no-restricted-imports -- focused test crosses the test-infrastructure boundary
import {
  assertNoSensitiveArtifactContent,
  assertNoUnownedNextProcess,
  assertExternalAuthStateRoot,
  assertNodeEnvProxySupported,
  assertPortAvailable,
  assertSafeNextDirectory,
  assertSafeParentEnvironment,
  cleanBuild,
  normalizePlaywrightArguments,
  parseLocalSupabaseStatusEnvironment,
  runAfterSafetyPreflight,
  runChild,
  sanitizedChildEnvironment,
  scanGeneratedAssets,
  startOwnedServer,
  terminateOwnedChild,
  violationMarkerPath,
  waitForOwnedNextReady,
} from "../e2e/scripts/visual-safety-cli.mts";
// eslint-disable-next-line no-restricted-imports -- focused test crosses the test-infrastructure boundary
import {
  createLocalAuthenticatedSafetyContract,
  createPublicSafetyContract,
} from "../e2e/helpers/visual-safety";
// eslint-disable-next-line no-restricted-imports -- focused test crosses the test-infrastructure boundary
import {
  containUpstreamProxyFailure,
  startLoopbackEgressProxy,
} from "../e2e/helpers/loopback-egress-proxy";

const temporaryRoots: string[] = [];
const requireFromTest = createRequire(import.meta.url);

async function temporaryDirectory(): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), "tryvit-visual-runner-"));
  temporaryRoots.push(root);
  return root;
}

async function rawProxyExchange(origin: string, payload: string): Promise<string> {
  const proxyUrl = new URL(origin);
  return new Promise<string>((resolve, reject) => {
    const socket = netConnect(Number(proxyUrl.port), "127.0.0.1");
    let response = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error) reject(error);
      else resolve(response);
    };
    const timeout = setTimeout(() => finish(new Error("raw proxy exchange timed out")), 2_000);
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.once("error", finish);
    socket.once("end", () => finish());
    socket.once("connect", () => socket.write(payload));
  });
}

afterEach(async () => {
  await fs.rm(violationMarkerPath, { force: true });
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("visual-safety runner environment", () => {
  it("fails closed when Node cannot enforce the owned env proxy", () => {
    for (const unsupported of ["21.99.0", "22.20.0", "23.11.1", "24.4.9", "invalid"]) {
      expect(() => assertNodeEnvProxySupported(unsupported)).toThrow(/VS_NODE_PROXY/u);
    }
    for (const supported of ["22.21.0", "24.5.0", "25.0.0", "26.1.2"]) {
      expect(() => assertNodeEnvProxySupported(supported)).not.toThrow();
    }
    expect(() => assertNodeEnvProxySupported()).not.toThrow();
  });

  it("removes inherited canary credentials from a public child", () => {
    const canary = "CANARY_DO_NOT_EMIT_9f30";
    const child = sanitizedChildEnvironment(
      {
        PATH: process.env.PATH,
        SUPABASE_SERVICE_ROLE_KEY: canary,
        NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: canary,
        DATABASE_URL: canary,
        STAGING_URL: canary,
        STAGING_SERVICE_KEY: canary,
        LHCI_UPLOAD__TARGET: "lhci-canary",
        PW_TEST_CONNECT_WS_ENDPOINT: "pw-canary",
        PUPPETEER_EXECUTABLE_PATH: "puppeteer-canary",
      },
      "public",
      "http://127.0.0.1:55001",
    );

    expect(JSON.stringify(child)).not.toContain(canary);
    expect(child.SUPABASE_SERVICE_ROLE_KEY).toBe("");
    expect(child.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:55001");
    expect(child.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("tryvit-local-visual-safety-placeholder");
    expect(child.LHCI_UPLOAD__TARGET).toBeUndefined();
    expect(child.PW_TEST_CONNECT_WS_ENDPOINT).toBeUndefined();
    expect(child.PUPPETEER_EXECUTABLE_PATH).toBeUndefined();
  });

  it("rejects Playwright config overrides and normalizes wrapper-only flags", () => {
    for (const unsafe of [
      "--config=other.ts",
      "--config",
      "-c",
      "-cother.ts",
      "-c=other.ts",
      "--trace=on",
      "--output=outside",
      "--reporter=json",
      "--reporter",
      "--update-snapshots=all",
      "-u",
      "-u=all",
      "--ui",
      "--debug",
    ]) {
      expect(() => normalizePlaywrightArguments([unsafe])).toThrow(/VS_PLAYWRIGHT_ARGUMENT/u);
    }
    const normalized = normalizePlaywrightArguments([
      "--quality-level=full",
      "--project=quality-mobile",
    ]);
    expect(normalized.qualityLevel).toBe("full");
    expect(normalized.projects).toEqual(new Set(["quality-mobile"]));
    expect(normalized.playwrightArgs).toEqual(["--project=quality-mobile"]);

    for (const reporter of ["--reporter=list", "--reporter=html,list"]) {
      expect(normalizePlaywrightArguments(["--project=smoke", reporter]).playwrightArgs).toEqual([
        "--project=smoke",
        reporter,
      ]);
    }
  });

  it("rejects process controls that could preload, proxy, or debug child traffic", () => {
    for (const name of [
      "NODE_OPTIONS",
      "NODE_USE_ENV_PROXY",
      "HTTPS_PROXY",
      "ALL_PROXY",
      "DEBUG",
      "PLAYWRIGHT_JSON_OUTPUT_NAME",
      "PWDEBUG",
      "PW_TEST_CONNECT_WS_ENDPOINT",
      "PWTEST_SOURCE_TRANSFORM",
      "PW_RUNNER_DEBUG",
      "LHCI_UPLOAD__TARGET",
      "LHCITEST_MOCK_LHR",
      "LIGHTHOUSE_CHROMIUM_PATH",
      "PUPPETEER_EXECUTABLE_PATH",
      "CHROME_PATH",
      "VISUAL_SAFETY_CONFIG_RUNNER_PID",
      "VISUAL_SAFETY_CONFIG_SEAL",
    ]) {
      expect(() => assertSafeParentEnvironment({ [name]: "canary" })).toThrow(/VS_PARENT_ENV/u);
    }
    expect(() => assertSafeParentEnvironment({ PATH: process.env.PATH })).not.toThrow();
    expect(() => assertSafeParentEnvironment({ PWD: "/safe/workspace" })).not.toThrow();
  });

  it("binds fixture credentials to the exact verified local status origin", () => {
    const parsed = parseLocalSupabaseStatusEnvironment(
      [
        'API_URL="http://127.0.0.1:55001"',
        'ANON_KEY="local-anon-canary-value"',
        'SERVICE_ROLE_KEY="local-service-canary-value"',
        'DB_URL="postgresql://local-only"',
      ].join("\n"),
      "http://127.0.0.1:55001",
    );
    expect(parsed).toEqual({
      anonKey: "local-anon-canary-value",
      serviceRoleKey: "local-service-canary-value",
    });
    for (const output of [
      'API_URL="https://synthetic.supabase.co"\nANON_KEY="local-anon-canary-value"\nSERVICE_ROLE_KEY="local-service-canary-value"',
      'API_URL="http://127.0.0.1:55002"\nANON_KEY="local-anon-canary-value"\nSERVICE_ROLE_KEY="local-service-canary-value"',
      'API_URL="http://127.0.0.1:55001"\nANON_KEY="missing-service-key"',
    ]) {
      expect(() => parseLocalSupabaseStatusEnvironment(output, "http://127.0.0.1:55001")).toThrow(
        /VS_(?:LOCAL_STATUS|ORIGIN_INVALID)/u,
      );
    }
  });

  it("rejects an authentication-state temp root inside the workspace", () => {
    expect(() => assertExternalAuthStateRoot(process.cwd(), process.cwd())).toThrow(
      /VS_AUTH_STATE_ROOT/u,
    );
    expect(() => assertExternalAuthStateRoot(tmpdir(), process.cwd())).not.toThrow();
  });

  it("does not launch any downstream action after preflight failure", async () => {
    const contract = createLocalAuthenticatedSafetyContract({
      appOrigin: "http://127.0.0.1:3000",
      supabaseOrigin: "http://127.0.0.1:55001",
    });
    const calls = {
      browser: 0,
      user: 0,
      adminClient: 0,
      network: 0,
      server: 0,
    };
    await expect(
      runAfterSafetyPreflight(
        contract,
        async () => {
          for (const name of Object.keys(calls) as Array<keyof typeof calls>) {
            calls[name] += 1;
          }
        },
        async () => {
          throw new Error("[VS_SYNTHETIC_PREFLIGHT] unavailable");
        },
      ),
    ).rejects.toThrow(/VS_SYNTHETIC_PREFLIGHT/u);
    expect(calls).toEqual({
      browser: 0,
      user: 0,
      adminClient: 0,
      network: 0,
      server: 0,
    });
  });
});

describe("owned .next cleanup target", () => {
  it("requires an owned egress proxy before build or server startup", async () => {
    const contract = createPublicSafetyContract({
      appOrigin: "http://127.0.0.1:3000",
    });
    await expect(cleanBuild(contract)).rejects.toThrow(/VS_BUILD_PROXY/u);
    await expect(startOwnedServer(contract)).rejects.toThrow(/VS_SERVER_PROXY/u);
  });

  it("accepts only the exact real frontend/.next directory", async () => {
    const root = await temporaryDirectory();
    const frontend = path.join(root, "frontend");
    const next = path.join(frontend, ".next");
    await fs.mkdir(next, { recursive: true });
    expect(assertSafeNextDirectory(frontend, next)).toBe(await fs.realpath(next));
  });

  it.each([".next-sibling", "nested/.next", "../frontend-copy/.next"])(
    "rejects lexical escape %s",
    async (relative) => {
      const root = await temporaryDirectory();
      const frontend = path.join(root, "frontend");
      await fs.mkdir(frontend, { recursive: true });
      expect(() => assertSafeNextDirectory(frontend, path.resolve(frontend, relative))).toThrow(
        /VS_NEXT_TARGET/u,
      );
    },
  );
});

describe("generated-client scan", () => {
  it("returns only digest/count metadata for clean assets", async () => {
    const root = await temporaryDirectory();
    const next = path.join(root, ".next");
    const chunks = path.join(next, "static", "chunks");
    await fs.mkdir(chunks, { recursive: true });
    await fs.writeFile(path.join(chunks, "app.js"), "const endpoint = 'local';");
    expect(scanGeneratedAssets(next)).toMatchObject({ scannedFiles: 1 });
  });

  it("rejects a synthetic hosted marker without exposing asset contents", async () => {
    const root = await temporaryDirectory();
    const next = path.join(root, ".next");
    const chunks = path.join(next, "static", "chunks");
    await fs.mkdir(chunks, { recursive: true });
    const canary = "CANARY_BUILD_SECRET_61b7";
    await fs.writeFile(
      path.join(chunks, "stale.js"),
      `const endpoint='https://synthetic.supabase.co';const secret='${canary}'`,
    );
    expect(() => scanGeneratedAssets(next)).toThrow(/VS_ASSET_HOSTED_ORIGIN/u);
    try {
      scanGeneratedAssets(next);
    } catch (error) {
      expect(String(error)).not.toContain(canary);
      expect(String(error)).not.toContain("synthetic.supabase.co");
    }
  });

  it("includes server chunks and CSS in the provenance digest", async () => {
    const root = await temporaryDirectory();
    const next = path.join(root, ".next");
    const chunk = path.join(next, "server", "chunks", "runtime.js");
    const css = path.join(next, "static", "css", "app.css");
    await fs.mkdir(path.dirname(chunk), { recursive: true });
    await fs.mkdir(path.dirname(css), { recursive: true });
    await fs.writeFile(chunk, "const runtime = 'local';", "utf8");
    await fs.writeFile(css, ".app { color: green; }", "utf8");
    expect(scanGeneratedAssets(next)).toMatchObject({ scannedFiles: 2 });
  });
});

describe("secret output and artifact hygiene", () => {
  it.each([
    ["playwright-report/report.html", "html report"],
    ["test-results/results.json", "JSON report"],
    ["artifact-staging/run.log", "artifact staging"],
    ["screenshots/capture.png", "screenshot"],
    [".next/provenance.json", "provenance"],
  ])("rejects a canary in %s (%s)", async (relative) => {
    const root = await temporaryDirectory();
    const filename = path.join(root, relative);
    const canary = "CANARY_ARTIFACT_SECRET_a071";
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, Buffer.from(`prefix:${canary}:suffix`, "utf8"));
    expect(() => assertNoSensitiveArtifactContent([root], [canary])).toThrow(/VS_ARTIFACT_SECRET/u);
    try {
      assertNoSensitiveArtifactContent([root], [canary]);
    } catch (error) {
      expect(String(error)).not.toContain(canary);
      expect(String(error)).not.toContain(relative);
    }
  });

  it("rejects compressed trace archives rather than claiming to inspect them", async () => {
    const root = await temporaryDirectory();
    await fs.writeFile(path.join(root, "trace.zip"), "synthetic archive");
    expect(() => assertNoSensitiveArtifactContent([root], [])).toThrow(/VS_ARTIFACT_ARCHIVE/u);
  });

  it("scans a single log-file root as well as directories", async () => {
    const root = await temporaryDirectory();
    const filename = path.join(root, "playwright-stdout.log");
    await fs.writeFile(filename, "redacted local output", "utf8");
    expect(assertNoSensitiveArtifactContent([filename], ["CANARY_UNUSED"])).toEqual({
      filesScanned: 1,
      bytesScanned: 21,
    });
  });

  it("captures child output and fails without forwarding a canary", async () => {
    const canary = "CANARY_CHILD_STDIO_4e12";
    let stdout = "";
    let stderr = "";
    const stdoutWrite = process.stdout.write.bind(process.stdout);
    const stderrWrite = process.stderr.write.bind(process.stderr);
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(((
      chunk: string | Uint8Array,
    ) => {
      stdout += String(chunk);
      return true;
    }) as typeof process.stdout.write);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(((
      chunk: string | Uint8Array,
    ) => {
      stderr += String(chunk);
      return true;
    }) as typeof process.stderr.write);
    try {
      await expect(
        runChild(process.execPath, ["-e", "process.stdout.write(process.env.TEST_SECRET || '')"], {
          cwd: process.cwd(),
          env: { ...process.env, TEST_SECRET: canary },
        }),
      ).rejects.toThrow(/VS_CHILD_SECRET/u);
      expect(stdout).not.toContain(canary);
      expect(stderr).not.toContain(canary);
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      // Keep bound references live so TypeScript verifies the original call
      // signatures even though the spies intentionally suppress output.
      expect(typeof stdoutWrite).toBe("function");
      expect(typeof stderrWrite).toBe("function");
    }
  });
});

describe("public Lighthouse page guard", () => {
  const guardModulePath = path.resolve(process.cwd(), "e2e/scripts/lighthouse-public-guard.cjs");
  const guard = requireFromTest(guardModulePath) as {
    (browser: unknown): Promise<void>;
    classify(rawUrl: string): string | null;
  };

  it("classifies hosted and custom-domain Supabase paths", () => {
    expect(guard.classify("https://synthetic.supabase.co/rest/v1/products")).toBe(
      "hosted-supabase-origin",
    );
    expect(guard.classify("https://api.synthetic.test/functions/v1/check")).toBe(
      "non-loopback-supabase-service",
    );
    expect(guard.classify("https://provider.synthetic.test/widget.js")).toBeNull();
  });

  it("contains external requests and records only forbidden Supabase traffic", async () => {
    const root = await temporaryDirectory();
    const marker = path.join(root, "violation.json");
    const previousMarker = process.env.VISUAL_SAFETY_VIOLATION_MARKER;
    process.env.VISUAL_SAFETY_VIOLATION_MARKER = marker;
    let requestHandler:
      | ((request: {
          url(): string;
          abort(reason: string): Promise<void>;
          continue(): Promise<void>;
        }) => Promise<void>)
      | undefined;
    const page = {
      setBypassServiceWorker: vi.fn(async () => undefined),
      setRequestInterception: vi.fn(async () => undefined),
      on: vi.fn((event: string, handler: typeof requestHandler) => {
        if (event === "request") requestHandler = handler;
      }),
    };
    const browser = {
      pages: vi.fn(async () => [page]),
      on: vi.fn(),
    };
    const request = (url: string) => ({
      url: () => url,
      abort: vi.fn(async () => undefined),
      continue: vi.fn(async () => undefined),
    });

    try {
      await guard(browser);
      expect(requestHandler).toBeTypeOf("function");
      const local = request("http://127.0.0.1:3000/auth/login");
      await requestHandler!(local);
      expect(local.continue).toHaveBeenCalledOnce();

      const provider = request("https://public-provider.synthetic.test/widget.js");
      await requestHandler!(provider);
      expect(provider.abort).toHaveBeenCalledWith("blockedbyclient");
      await expect(fs.stat(marker)).rejects.toMatchObject({ code: "ENOENT" });

      const forbidden = request("https://api.synthetic.test/rest/v1/products");
      await requestHandler!(forbidden);
      expect(forbidden.abort).toHaveBeenCalledWith("blockedbyclient");
      expect(JSON.parse(await fs.readFile(marker, "utf8"))).toEqual({
        total: 1,
        categories: {
          "lighthouse.non-loopback-supabase-service": 1,
        },
      });
    } finally {
      if (previousMarker === undefined) {
        delete process.env.VISUAL_SAFETY_VIOLATION_MARKER;
      } else {
        process.env.VISUAL_SAFETY_VIOLATION_MARKER = previousMarker;
      }
    }
  });
});

describe("process ownership and loopback proxy", () => {
  it("contains an upstream failure after response headers are committed", () => {
    const afterHeaders = {
      destroyed: false,
      writableEnded: false,
      headersSent: true,
      destroy: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
    };
    containUpstreamProxyFailure(
      afterHeaders as unknown as Parameters<
        typeof containUpstreamProxyFailure
      >[0],
    );
    expect(afterHeaders.destroy).toHaveBeenCalledOnce();
    expect(afterHeaders.writeHead).not.toHaveBeenCalled();

    const beforeHeaders = {
      ...afterHeaders,
      headersSent: false,
      destroy: vi.fn(),
      writeHead: vi.fn(() => beforeHeaders),
      end: vi.fn(),
    };
    containUpstreamProxyFailure(
      beforeHeaders as unknown as Parameters<
        typeof containUpstreamProxyFailure
      >[0],
    );
    expect(beforeHeaders.writeHead).toHaveBeenCalledWith(502);
    expect(beforeHeaders.end).toHaveBeenCalledOnce();
  });

  it("fails promptly when an owned server child exits before readiness", async () => {
    const child = spawn(process.execPath, ["-e", "process.exit(7)"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    await expect(waitForOwnedNextReady(child, 2_000)).rejects.toThrow(/VS_SERVER_EXIT/u);
    if (child.exitCode === null && child.signalCode === null) {
      await once(child, "close");
    }
    expect(child.exitCode).toBe(7);
  });

  it("terminates and awaits only a harness-owned child", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    await once(child, "spawn");
    await terminateOwnedChild(child);
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  });

  it("terminates the descendant tree of a harness-owned child", async () => {
    const root = await temporaryDirectory();
    const pidFile = path.join(root, "descendant.pid");
    const parentScript = [
      "const { spawn } = require('node:child_process');",
      "const fs = require('node:fs');",
      "const child = spawn(process.execPath, ['-e', 'setInterval(() => undefined, 1000)'], { stdio: 'ignore' });",
      "fs.writeFileSync(process.env.PID_FILE, String(child.pid));",
      "setInterval(() => undefined, 1000);",
    ].join("");
    const parent = spawn(process.execPath, ["-e", parentScript], {
      cwd: process.cwd(),
      env: { ...process.env, PID_FILE: pidFile },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    await once(parent, "spawn");
    for (
      let attempt = 0;
      attempt < 40 && !(await fs.stat(pidFile).catch(() => null));
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const descendantPid = Number(await fs.readFile(pidFile, "utf8"));
    expect(Number.isSafeInteger(descendantPid)).toBe(true);
    await terminateOwnedChild(parent);

    let descendantAlive = true;
    for (let attempt = 0; attempt < 40 && descendantAlive; attempt += 1) {
      try {
        process.kill(descendantPid, 0);
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch {
        descendantAlive = false;
      }
    }
    expect(descendantAlive).toBe(false);
  });

  it.runIf(process.platform === "win32" || process.platform === "linux")(
    "detects a synthetic unowned Next command without terminating it",
    async () => {
      const nextCli = path.resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");
      const child = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)", nextCli], {
        cwd: path.resolve(process.cwd()),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      await once(child, "spawn");
      try {
        expect(() => assertNoUnownedNextProcess(process.cwd())).toThrow(/VS_NEXT_OWNERSHIP/u);
        expect(child.exitCode).toBeNull();
        expect(child.signalCode).toBeNull();
      } finally {
        await terminateOwnedChild(child);
      }
    },
  );

  it("refuses an occupied port without terminating its owner", async () => {
    const owner = createNetServer();
    owner.listen(0, "127.0.0.1");
    await once(owner, "listening");
    const address = owner.address();
    if (!address || typeof address === "string") throw new Error("test port");

    await expect(assertPortAvailable(address.port)).rejects.toThrow(/VS_PORT_OWNERSHIP/u);
    expect(owner.listening).toBe(true);
    await new Promise<void>((resolve) => owner.close(() => resolve()));
  });

  it("forwards loopback HTTP through the owned proxy", async () => {
    const target = createHttpServer((_request, response) => {
      response.writeHead(204).end();
    });
    target.listen(0, "127.0.0.1");
    await once(target, "listening");
    const address = target.address();
    if (!address || typeof address === "string") throw new Error("test port");
    const proxy = await startLoopbackEgressProxy({
      writeViolationMarker: false,
    });

    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(proxy.origin, {
        path: `http://127.0.0.1:${address.port}/safe`,
      });
      request.once("response", (response) => resolve(response.statusCode ?? 0));
      request.once("error", reject);
      request.end();
    });

    expect(status).toBe(204);
    expect(proxy.summary).toEqual({ total: 0, categories: {} });
    await proxy.close();
    await new Promise<void>((resolve) => target.close(() => resolve()));
  });

  it("blocks a synthetic hosted target at the loopback proxy without DNS", async () => {
    const proxy = await startLoopbackEgressProxy({
      writeViolationMarker: false,
    });
    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(proxy.origin, {
        path: "http://synthetic.supabase.co/rest/v1/products",
      });
      request.once("response", (response) => resolve(response.statusCode ?? 0));
      request.once("error", reject);
      request.end();
    });

    expect(status).toBe(451);
    expect(proxy.summary).toEqual({
      total: 1,
      categories: { "proxy-http-hosted-supabase-origin": 1 },
    });
    await proxy.close();
  });

  it("blocks a synthetic hosted CONNECT target without DNS", async () => {
    const proxy = await startLoopbackEgressProxy({
      writeViolationMarker: false,
    });
    const response = await rawProxyExchange(
      proxy.origin,
      [
        "CONNECT synthetic.supabase.co:443 HTTP/1.1",
        "Host: synthetic.supabase.co:443",
        "",
        "",
      ].join("\r\n"),
    );

    expect(response).toContain("451 Unavailable For Legal Reasons");
    expect(proxy.summary).toEqual({
      total: 1,
      categories: { "proxy-http-hosted-supabase-origin": 1 },
    });
    await proxy.close();
  });

  it("refuses to allowlist a hosted Supabase CONNECT hostname", async () => {
    await expect(
      startLoopbackEgressProxy({
        writeViolationMarker: false,
        allowedConnectHostnames: ["synthetic.supabase.co"],
      }),
    ).rejects.toThrow(/VS_PROXY_ALLOWLIST/u);
  });

  it("contains unrelated HTTP but fails closed for an opaque CONNECT", async () => {
    const proxy = await startLoopbackEgressProxy({
      writeViolationMarker: false,
    });
    const httpStatus = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(proxy.origin, {
        path: "http://synthetic.external.test/public-asset",
      });
      request.once("response", (response) => resolve(response.statusCode ?? 0));
      request.once("error", reject);
      request.end();
    });
    const connectResponse = await rawProxyExchange(
      proxy.origin,
      [
        "CONNECT synthetic.external.test:443 HTTP/1.1",
        "Host: synthetic.external.test:443",
        "",
        "",
      ].join("\r\n"),
    );

    expect(httpStatus).toBe(451);
    expect(connectResponse).toContain("451 Unavailable For Legal Reasons");
    expect(proxy.summary).toEqual({
      total: 1,
      categories: { "proxy-non-loopback-connect": 1 },
    });
    await proxy.close();
  });

  it("permits Lighthouse to contain opaque CONNECT only with its page guard", async () => {
    const proxy = await startLoopbackEgressProxy({
      writeViolationMarker: false,
      opaqueConnectPolicy: "contain",
    });
    const response = await rawProxyExchange(
      proxy.origin,
      [
        "CONNECT chrome-background.synthetic.test:443 HTTP/1.1",
        "Host: chrome-background.synthetic.test:443",
        "",
        "",
      ].join("\r\n"),
    );

    expect(response).toContain("451 Unavailable For Legal Reasons");
    expect(proxy.summary).toEqual({ total: 0, categories: {} });
    await proxy.close();
  });

  it("rejects and records raw HTTP Upgrade traffic without DNS", async () => {
    const proxy = await startLoopbackEgressProxy({
      writeViolationMarker: false,
    });
    const response = await rawProxyExchange(
      proxy.origin,
      [
        "GET http://synthetic.supabase.co/realtime/v1/websocket HTTP/1.1",
        "Host: synthetic.supabase.co",
        "Connection: Upgrade",
        "Upgrade: websocket",
        "",
        "",
      ].join("\r\n"),
    );

    expect(response).toContain("451 Unavailable For Legal Reasons");
    expect(proxy.summary).toEqual({
      total: 1,
      categories: { "proxy-websocket-hosted-supabase-origin": 1 },
    });
    await proxy.close();
  });

  it("destroys both halves of an active CONNECT tunnel during bounded close", async () => {
    const target = createNetServer();
    target.listen(0, "127.0.0.1");
    await once(target, "listening");
    const address = target.address();
    if (!address || typeof address === "string") throw new Error("test port");

    const acceptedPromise = once(target, "connection").then(([socket]) => socket as Socket);
    const proxy = await startLoopbackEgressProxy({
      writeViolationMarker: false,
    });
    const proxyUrl = new URL(proxy.origin);
    const client = netConnect(Number(proxyUrl.port), "127.0.0.1");
    client.on("error", () => {});

    try {
      const connected = new Promise<string>((resolve, reject) => {
        let response = "";
        const timeout = setTimeout(() => reject(new Error("CONNECT handshake timed out")), 2_000);
        client.setEncoding("utf8");
        client.on("data", (chunk) => {
          response += chunk;
          if (response.includes("\r\n\r\n")) {
            clearTimeout(timeout);
            resolve(response);
          }
        });
        client.once("error", reject);
      });
      client.once("connect", () => {
        client.write(
          `CONNECT 127.0.0.1:${address.port} HTTP/1.1\r\n` +
            `Host: 127.0.0.1:${address.port}\r\n\r\n`,
        );
      });

      expect(await connected).toContain("200 Connection Established");
      const accepted = await acceptedPromise;
      accepted.on("error", () => {});
      const clientClosed = once(client, "close");
      const acceptedClosed = once(accepted, "close");
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          proxy.close(),
          new Promise<never>((_resolve, reject) => {
            deadline = setTimeout(
              () => reject(new Error("proxy close exceeded test deadline")),
              1_000,
            );
          }),
        ]);
      } finally {
        if (deadline) clearTimeout(deadline);
      }
      await Promise.all([clientClosed, acceptedClosed]);
      expect(client.destroyed).toBe(true);
      expect(accepted.destroyed).toBe(true);
    } finally {
      client.destroy();
      await proxy.close().catch(() => {});
      await new Promise<void>((resolve) => target.close(() => resolve()));
    }
  });
});
