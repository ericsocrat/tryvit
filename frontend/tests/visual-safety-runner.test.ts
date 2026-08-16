import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { createServer as createHttpServer, request as httpRequest } from "node:http";
import { connect as netConnect, createServer as createNetServer, type Socket } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

// The runtime launcher is an ESM TypeScript entry point executed with Node's
// type-stripping loader; Vite resolves it directly for focused unit tests.
// eslint-disable-next-line no-restricted-imports -- focused test crosses the test-infrastructure boundary
import {
  assertCompleteLighthouseReportSet,
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
  it("pins guarded build and runtime font fetches locally with no external CONNECT allowlist", async () => {
    const runner = await fs.readFile(
      path.resolve(process.cwd(), "e2e", "scripts", "visual-safety-cli.mts"),
      "utf8",
    );
    const preload = await fs.readFile(
      path.resolve(process.cwd(), "e2e", "scripts", "phase5a0d-local-font-fetch.mjs"),
      "utf8",
    );
    const fixedTimePreload = path.resolve(
      process.cwd(),
      "e2e",
      "scripts",
      "phase5a0d-fixed-time.mjs",
    );
    expect(runner).toContain("NO_EXTERNAL_CONNECT_HOSTNAMES");
    expect(runner).not.toContain("REVIEWED_EXTERNAL_CONNECT_HOSTNAMES");
    expect(
      runner.match(/"--import",\s*pathToFileURL\(localFontFetchPreload\)\.href/gu),
    ).toHaveLength(2);
    expect(runner).toMatch(/pathToFileURL\(localFontFetchPreload\)\.href,\s*nextCli,\s*"build"/u);
    expect(runner).toMatch(
      /pathToFileURL\(localFontFetchPreload\)\.href,\s*\.\.\.fixedTimeArguments,\s*nextCli,\s*"start"/u,
    );
    expect(preload).toContain("c1c6ba111e8d04d392b741d194ab548186ec3c006ed7cc134be0525402520339");
    expect(preload).toContain("unpinned-font-url-rejected");
    expect(preload).toContain("fstatSync(fixtureDescriptor, { bigint: true })");
    expect(preload).toContain("readFileSync(fixtureDescriptor)");

    const fixed = spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(fixedTimePreload).href,
        "--eval",
        "class ExtendedDate extends Date {};" +
          'process.stdout.write(`${Date.now()}|${new Date().toISOString()}|${new Date(0).toISOString()}|${Date() === new Date().toString()}|${new Date() instanceof Date}|${new ExtendedDate() instanceof ExtendedDate}|${new Date().constructor === Date}|${Date.name}|${Date.length}|${Object.getPrototypeOf(Date) === Function.prototype}|${Date.parse("1970-01-01T00:00:00.000Z")}|${Date.UTC(1970, 0, 1)}`)',
      ],
      {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          PHASE5A0D_FIXED_TIME: "2026-07-15T12:00:00.000Z",
        },
        windowsHide: true,
      },
    );
    expect(fixed.status).toBe(0);
    expect(fixed.stdout).toBe(
      "1784116800000|2026-07-15T12:00:00.000Z|1970-01-01T00:00:00.000Z|true|true|true|true|Date|7|true|0|0",
    );

    const rejected = spawnSync(
      process.execPath,
      ["--import", pathToFileURL(fixedTimePreload).href],
      {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          PHASE5A0D_FIXED_TIME: "2026-07-15T12:00:00.001Z",
        },
        windowsHide: true,
      },
    );
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain("[P5_FIXED_TIME] exact-authoritative-time-required");
  });

  it("fails closed when Node cannot enforce the owned env proxy", () => {
    for (const unsupported of ["21.99.0", "22.20.0", "23.11.1", "24.4.9", "invalid"]) {
      expect(() => assertNodeEnvProxySupported(unsupported)).toThrow(/VS_NODE_PROXY/u);
    }
    for (const supported of ["22.21.0", "24.5.0", "25.0.0", "26.1.2"]) {
      expect(() => assertNodeEnvProxySupported(supported)).not.toThrow();
    }
    expect(() => assertNodeEnvProxySupported()).not.toThrow();
  });

  it("removes inherited credentials and Supabase configuration from a public child", () => {
    const canary = "CANARY_DO_NOT_EMIT_9f30";
    const child = sanitizedChildEnvironment(
      {
        PATH: process.env.PATH,
        SUPABASE_SERVICE_ROLE_KEY: canary,
        NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: canary,
        VISUAL_SAFETY_BUILD_SUPABASE_ORIGIN: "http://127.0.0.1:55001",
        VISUAL_SAFETY_BUILD_ADAPTER_ID: "loopback-placeholder-v1",
        DATABASE_URL: canary,
        STAGING_URL: canary,
        STAGING_SERVICE_KEY: canary,
        LHCI_UPLOAD__TARGET: "lhci-canary",
        PW_TEST_CONNECT_WS_ENDPOINT: "pw-canary",
        PUPPETEER_EXECUTABLE_PATH: "puppeteer-canary",
        PHASE5A0D_FIXED_TIME: "attacker-controlled",
      },
      "public",
    );

    expect(JSON.stringify(child)).not.toContain(canary);
    expect(child.SUPABASE_SERVICE_ROLE_KEY).toBe("");
    expect(child.NEXT_PUBLIC_SUPABASE_URL).toBe("");
    expect(child.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("");
    expect(child.VISUAL_SAFETY_BUILD_SUPABASE_ORIGIN).toBeUndefined();
    expect(child.VISUAL_SAFETY_BUILD_ADAPTER_ID).toBeUndefined();
    expect(child.LHCI_UPLOAD__TARGET).toBeUndefined();
    expect(child.PW_TEST_CONNECT_WS_ENDPOINT).toBeUndefined();
    expect(child.PUPPETEER_EXECUTABLE_PATH).toBeUndefined();
    expect(child.PHASE5A0D_FIXED_TIME).toBeUndefined();
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
    expect(normalizePlaywrightArguments(["--update-snapshots=all"], true).playwrightArgs).toEqual([
      "--update-snapshots=all",
    ]);
    for (const unsafeInternalValue of [
      "--update-snapshots=changed",
      "--update-snapshots=missing",
      "-u",
    ]) {
      expect(() => normalizePlaywrightArguments([unsafeInternalValue], true)).toThrow(
        /VS_PLAYWRIGHT_ARGUMENT/u,
      );
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
      "PHASE5A0D_FIXED_TIME",
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
    expect(guard.classify("wss://api.synthetic.test/realtime/v1/websocket")).toBe(
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
    let websocketCreatedHandler: ((event: { url: string }) => void) | undefined;
    const cdpOrder: string[] = [];
    const cdpSession = {
      send: vi.fn(async (command: string) => {
        cdpOrder.push(`send:${command}`);
      }),
      on: vi.fn((event: string, handler: (event: { url: string }) => void) => {
        cdpOrder.push(`on:${event}`);
        if (event === "Network.webSocketCreated") {
          websocketCreatedHandler = handler;
        }
      }),
    };
    const page = {
      setBypassServiceWorker: vi.fn(async () => undefined),
      createCDPSession: vi.fn(async () => cdpSession),
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
      expect(cdpSession.send).toHaveBeenCalledWith("Network.enable");
      expect(websocketCreatedHandler).toBeTypeOf("function");
      expect(cdpOrder).toEqual(["on:Network.webSocketCreated", "send:Network.enable"]);
      const local = request("http://127.0.0.1:3000/auth/login");
      await requestHandler!(local);
      expect(local.continue).toHaveBeenCalledOnce();

      const provider = request("https://public-provider.synthetic.test/widget.js");
      await requestHandler!(provider);
      expect(provider.abort).toHaveBeenCalledWith("blockedbyclient");
      await expect(fs.stat(marker)).rejects.toMatchObject({ code: "ENOENT" });

      websocketCreatedHandler!({
        url: "wss://provider.synthetic.test/socket",
      });
      await expect(fs.stat(marker)).rejects.toMatchObject({ code: "ENOENT" });

      websocketCreatedHandler!({
        url: "wss://api.synthetic.test/realtime/v1/websocket",
      });
      expect(JSON.parse(await fs.readFile(marker, "utf8"))).toEqual({
        total: 1,
        categories: {
          "lighthouse.websocket.non-loopback-supabase-service": 1,
        },
      });

      const forbidden = request("https://api.synthetic.test/rest/v1/products");
      await requestHandler!(forbidden);
      expect(forbidden.abort).toHaveBeenCalledWith("blockedbyclient");
      expect(JSON.parse(await fs.readFile(marker, "utf8"))).toEqual({
        total: 2,
        categories: {
          "lighthouse.non-loopback-supabase-service": 1,
          "lighthouse.websocket.non-loopback-supabase-service": 1,
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

describe("local-authenticated Lighthouse session guard", () => {
  const guardModulePath = path.resolve(
    process.cwd(),
    "e2e/scripts/lighthouse-local-auth-guard.cjs",
  );
  const guard = requireFromTest(guardModulePath) as ((browser: unknown) => Promise<void>) & {
    probeLoginHydration(): boolean;
    restorePasswordMask(): boolean;
  };

  it("uses the password toggle as a reversible hydration handshake", () => {
    const wrapper = document.createElement("div");
    const passwordInput = document.createElement("input");
    passwordInput.id = "password";
    passwordInput.type = "password";
    const toggle = document.createElement("button");
    toggle.type = "button";
    wrapper.append(passwordInput, toggle);
    document.body.replaceChildren(wrapper);

    try {
      expect(guard.probeLoginHydration()).toBe(false);
      expect(passwordInput.type).toBe("password");
      toggle.addEventListener("click", () => {
        passwordInput.type = passwordInput.type === "password" ? "text" : "password";
      });
      expect(guard.probeLoginHydration()).toBe(true);
      expect(passwordInput.type).toBe("text");
      expect(guard.restorePasswordMask()).toBe(true);
      expect(passwordInput.type).toBe("password");
    } finally {
      document.body.replaceChildren();
    }
  });

  it("proves hydration and restores password masking before submitting credentials", async () => {
    const previous = new Map<string, string | undefined>();
    const environment = {
      VISUAL_SAFETY_MODE: "local-authenticated",
      VISUAL_SAFETY_APP_ORIGIN: "http://127.0.0.1:3000",
      VISUAL_SAFETY_SUPABASE_ORIGIN: "http://127.0.0.1:54321",
      QA_TEST_EMAIL: "fixture.user@example.test",
      QA_TEST_PASSWORD: "fixture-password-canary",
      VISUAL_SAFETY_VIOLATION_MARKER: path.join(tmpdir(), "unused-lighthouse-marker.json"),
    };
    for (const [name, value] of Object.entries(environment)) {
      previous.set(name, process.env[name]);
      process.env[name] = value;
    }
    const order: string[] = [];
    let currentUrl = "http://127.0.0.1:3000/auth/login";
    const cdpSession = {
      on: vi.fn(),
      send: vi.fn(async () => undefined),
    };
    const tokenResponse = {
      url: () => "http://127.0.0.1:54321/auth/v1/token?grant_type=password",
      request: () => ({ method: () => "POST" }),
      ok: () => true,
      status: () => 200,
    };
    const page = {
      setBypassServiceWorker: vi.fn(async () => undefined),
      createCDPSession: vi.fn(async () => cdpSession),
      setRequestInterception: vi.fn(async () => undefined),
      on: vi.fn(),
      goto: vi.fn(async () => ({ ok: () => true })),
      waitForFunction: vi.fn(async (pageFunction: unknown) => {
        if (pageFunction === guard.probeLoginHydration) {
          order.push("hydration-probe");
        } else if (pageFunction === guard.restorePasswordMask) {
          order.push("password-mask-restore");
        } else if (currentUrl.endsWith("/auth/login")) {
          order.push("route-ready");
        } else {
          order.push("post-login");
        }
      }),
      url: vi.fn(() => currentUrl),
      type: vi.fn(async (selector: string) => {
        order.push(selector === "#email" ? "type-email" : "type-password");
      }),
      click: vi.fn(async () => {
        order.push("submit");
        currentUrl = "http://127.0.0.1:3000/app/search";
      }),
      waitForResponse: vi.fn(async (predicate: (response: typeof tokenResponse) => boolean) => {
        order.push("arm-token-wait");
        expect(predicate(tokenResponse)).toBe(true);
        return tokenResponse;
      }),
      close: vi.fn(async () => undefined),
    };
    const browser = {
      pages: vi.fn(async () => [page]),
      newPage: vi.fn(async () => page),
      on: vi.fn(),
    };

    try {
      await guard(browser);
      expect(order).toEqual([
        "route-ready",
        "hydration-probe",
        "password-mask-restore",
        "type-email",
        "type-password",
        "arm-token-wait",
        "submit",
        "post-login",
      ]);
      expect(page.waitForFunction).toHaveBeenCalledWith(guard.probeLoginHydration, {
        polling: 100,
        timeout: 30_000,
      });
      expect(page.waitForFunction).toHaveBeenCalledWith(guard.restorePasswordMask, {
        polling: 100,
        timeout: 5_000,
      });
      expect(page.close).toHaveBeenCalledOnce();
    } finally {
      for (const [name, value] of previous) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it("reuses an authenticated browser session without submitting credentials again", async () => {
    const previous = new Map<string, string | undefined>();
    const environment = {
      VISUAL_SAFETY_MODE: "local-authenticated",
      VISUAL_SAFETY_APP_ORIGIN: "http://127.0.0.1:3000",
      VISUAL_SAFETY_SUPABASE_ORIGIN: "http://127.0.0.1:54321",
      QA_TEST_EMAIL: "fixture.user@example.test",
      QA_TEST_PASSWORD: "fixture-password-canary",
      VISUAL_SAFETY_VIOLATION_MARKER: path.join(tmpdir(), "unused-lighthouse-marker.json"),
    };
    for (const [name, value] of Object.entries(environment)) {
      previous.set(name, process.env[name]);
      process.env[name] = value;
    }
    const cdpSession = {
      on: vi.fn(),
      send: vi.fn(async () => undefined),
    };
    const page = {
      setBypassServiceWorker: vi.fn(async () => undefined),
      createCDPSession: vi.fn(async () => cdpSession),
      setRequestInterception: vi.fn(async () => undefined),
      on: vi.fn(),
      goto: vi.fn(async () => ({ ok: () => true })),
      waitForFunction: vi.fn(async () => undefined),
      url: vi.fn(() => "http://127.0.0.1:3000/app"),
      type: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      waitForResponse: vi.fn(),
      close: vi.fn(async () => undefined),
    };
    const browser = {
      pages: vi.fn(async () => [page]),
      newPage: vi.fn(async () => page),
      on: vi.fn(),
    };

    try {
      await guard(browser);
      expect(page.goto).toHaveBeenCalledWith("http://127.0.0.1:3000/auth/login", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      expect(page.type).not.toHaveBeenCalled();
      expect(page.click).not.toHaveBeenCalled();
      expect(page.waitForResponse).not.toHaveBeenCalled();
      expect(page.close).toHaveBeenCalledOnce();
    } finally {
      for (const [name, value] of previous) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});

describe("process ownership and loopback proxy", () => {
  it("fails with a stable label when Lighthouse exits before creating reports", async () => {
    const root = await temporaryDirectory();
    const relativeDirectory = "lighthouse-reports/local-authenticated/mobile";
    expect(() => assertCompleteLighthouseReportSet(relativeDirectory, 1, 1, root)).toThrow(
      /\[P5_LIGHTHOUSE_RUN\] child-failed-before-output/u,
    );

    const reportDirectory = path.join(root, relativeDirectory);
    await fs.mkdir(reportDirectory, { recursive: true });
    await fs.writeFile(path.join(reportDirectory, "fixture.report.json"), "{}\n", "utf8");
    expect(() => assertCompleteLighthouseReportSet(relativeDirectory, 1, 0, root)).not.toThrow();
    expect(() => assertCompleteLighthouseReportSet(relativeDirectory, 2, 0, root)).toThrow(
      /\[P5_LIGHTHOUSE_RUN\] report-count-mismatch/u,
    );
  });

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
      afterHeaders as unknown as Parameters<typeof containUpstreamProxyFailure>[0],
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
      beforeHeaders as unknown as Parameters<typeof containUpstreamProxyFailure>[0],
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
      allowedLoopbackOrigins: [`http://127.0.0.1:${address.port}`],
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

  it("refuses an unapproved loopback HTTP target without opening it", async () => {
    let accepted = 0;
    const target = createHttpServer((_request, response) => {
      accepted += 1;
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
        path: `http://127.0.0.1:${address.port}/not-owned`,
      });
      request.once("response", (response) => resolve(response.statusCode ?? 0));
      request.once("error", reject);
      request.end();
    });

    expect(status).toBe(451);
    expect(accepted).toBe(0);
    expect(proxy.summary).toEqual({
      total: 1,
      categories: { "proxy-loopback-target-not-allowed": 1 },
    });
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

  it("blocks fonts.gstatic.com at the runtime proxy", async () => {
    const proxy = await startLoopbackEgressProxy({
      writeViolationMarker: false,
    });
    const response = await rawProxyExchange(
      proxy.origin,
      ["CONNECT fonts.gstatic.com:443 HTTP/1.1", "Host: fonts.gstatic.com:443", "", ""].join(
        "\r\n",
      ),
    );

    expect(response).toContain("451 Unavailable For Legal Reasons");
    expect(proxy.summary).toEqual({
      total: 1,
      categories: { "proxy-non-loopback-connect": 1 },
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

  it.runIf(process.platform === "win32" || process.platform === "linux")(
    "survives a peer reset after denying an opaque CONNECT",
    () => {
      const proxyModuleUrl = pathToFileURL(
        path.resolve(process.cwd(), "e2e", "helpers", "loopback-egress-proxy.ts"),
      ).href;
      const script = [
        'import { request as httpRequest } from "node:http";',
        'import { connect as netConnect } from "node:net";',
        `const { startLoopbackEgressProxy } = await import(${JSON.stringify(proxyModuleUrl)});`,
        "const proxy = await startLoopbackEgressProxy({",
        "  writeViolationMarker: false,",
        '  opaqueConnectPolicy: "contain",',
        "});",
        "const proxyUrl = new URL(proxy.origin);",
        "const resetDeniedConnect = () => new Promise((resolve, reject) => {",
        '  const socket = netConnect(Number(proxyUrl.port), "127.0.0.1");',
        '  socket.setEncoding("utf8");',
        '  let response = "";',
        '  const timeout = setTimeout(() => reject(new Error("denied CONNECT timed out")), 2_000);',
        '  socket.once("error", (error) => {',
        "    clearTimeout(timeout);",
        "    reject(error);",
        "  });",
        '  socket.on("data", (chunk) => {',
        "    response += chunk;",
        '    if (!response.includes("\\r\\n\\r\\n")) return;',
        "    clearTimeout(timeout);",
        '    if (!response.includes("451 Unavailable For Legal Reasons")) {',
        '      reject(new Error("proxy did not deny CONNECT"));',
        "      return;",
        "    }",
        "    socket.resetAndDestroy();",
        "    resolve();",
        "  });",
        '  socket.once("connect", () => {',
        "    socket.write(",
        '      "CONNECT chrome-background.synthetic.test:443 HTTP/1.1\\r\\n" +',
        '        "Host: chrome-background.synthetic.test:443\\r\\n\\r\\n",',
        "    );",
        "  });",
        "});",
        "try {",
        "  await Promise.all(Array.from({ length: 8 }, resetDeniedConnect));",
        "  await new Promise((resolve) => setTimeout(resolve, 100));",
        "  const status = await new Promise((resolve, reject) => {",
        "    const request = httpRequest(proxy.origin, {",
        '      path: "http://synthetic.external.test/still-alive",',
        "    });",
        '    request.once("response", (response) => {',
        "      response.resume();",
        "      resolve(response.statusCode ?? 0);",
        "    });",
        '    request.once("error", reject);',
        "    request.end();",
        "  });",
        '  if (status !== 451) throw new Error("proxy did not remain fail closed");',
        '  if (proxy.summary.total !== 0) throw new Error("contained CONNECT became a violation");',
        "} finally {",
        "  await proxy.close();",
        "}",
      ].join("\n");

      const result = spawnSync(
        process.execPath,
        ["--experimental-strip-types", "--input-type=module", "--eval", script],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          timeout: 10_000,
          windowsHide: true,
        },
      );

      expect(result.signal).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).not.toContain("Unhandled 'error' event");
    },
  );

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

  it("refuses an unapproved loopback CONNECT target", async () => {
    let accepted = 0;
    const target = createNetServer(() => {
      accepted += 1;
    });
    target.listen(0, "127.0.0.1");
    await once(target, "listening");
    const address = target.address();
    if (!address || typeof address === "string") throw new Error("test port");
    const proxy = await startLoopbackEgressProxy({
      writeViolationMarker: false,
    });

    const response = await rawProxyExchange(
      proxy.origin,
      [
        `CONNECT 127.0.0.1:${address.port} HTTP/1.1`,
        `Host: 127.0.0.1:${address.port}`,
        "",
        "",
      ].join("\r\n"),
    );

    expect(response).toContain("451 Unavailable For Legal Reasons");
    expect(accepted).toBe(0);
    expect(proxy.summary).toEqual({
      total: 1,
      categories: { "proxy-loopback-target-not-allowed": 1 },
    });
    await proxy.close();
    await new Promise<void>((resolve) => target.close(() => resolve()));
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
      allowedLoopbackOrigins: [`https://127.0.0.1:${address.port}`],
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
