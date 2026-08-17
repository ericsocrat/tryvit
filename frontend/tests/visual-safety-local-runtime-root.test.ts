import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line no-restricted-imports -- focused test crosses the test-infrastructure boundary
import {
  VISUAL_SAFETY_LOCAL_RUNTIME_ROOT,
  discoverLocalFixtureCredentials,
  nonSensitiveEnvironment,
  resolveVisualSafetyLocalRuntime,
  sanitizedChildEnvironment,
  type LocalSupabaseStatusRunner,
} from "../e2e/scripts/visual-safety-cli.mts";
// eslint-disable-next-line no-restricted-imports -- focused test crosses the test-infrastructure boundary
import {
  canonicalizeLoopbackOrigin,
  createLocalAuthenticatedSafetyContract,
  loadSafetyContractFromEnvironment,
  type CanonicalLoopbackOrigin,
} from "../e2e/helpers/visual-safety";

const temporaryRoots: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), "tryvit-local-runtime-"));
  temporaryRoots.push(root);
  return root;
}

async function runtimeRoot(apiPort: number): Promise<string> {
  const root = await temporaryDirectory();
  const supabaseDirectory = path.join(root, "supabase");
  await fs.mkdir(supabaseDirectory);
  await fs.writeFile(
    path.join(supabaseDirectory, "config.toml"),
    `[api]\nport = ${apiPort}\n[api.tls]\nenabled = false\n`,
    "utf8",
  );
  return root;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryRoots.splice(0).map(async (root) => {
      const resolved = path.resolve(root);
      expect(path.dirname(resolved)).toBe(path.resolve(tmpdir()));
      expect(path.basename(resolved)).toMatch(/^tryvit-local-runtime-/u);
      await fs.rm(resolved, { recursive: true, force: true });
    }),
  );
});

describe("visual-safety optional local runtime root", () => {
  it("keeps the supplied default root when no override is present", async () => {
    const root = await runtimeRoot(47_001);
    const runtime = await resolveVisualSafetyLocalRuntime({}, root);

    expect(runtime).toEqual({
      root: await fs.realpath(root),
      configPath: path.join(await fs.realpath(root), "supabase", "config.toml"),
      origin: "http://127.0.0.1:47001",
      overridden: false,
    });
  });

  it("selects an existing absolute override and derives only its loopback origin", async () => {
    const defaultRoot = await runtimeRoot(47_001);
    const overrideRoot = await runtimeRoot(47_011);
    const runtime = await resolveVisualSafetyLocalRuntime(
      { [VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]: overrideRoot },
      defaultRoot,
    );

    expect(runtime.root).toBe(await fs.realpath(overrideRoot));
    expect(runtime.origin).toBe("http://127.0.0.1:47011");
    expect(runtime.overridden).toBe(true);
  });

  it("rejects relative, missing, non-directory, and config-less overrides with fixed labels", async () => {
    const defaultRoot = await runtimeRoot(47_001);
    const emptyRoot = await temporaryDirectory();
    const fileRoot = path.join(await temporaryDirectory(), "runtime.txt");
    await fs.writeFile(fileRoot, "not a directory", "utf8");

    await expect(
      resolveVisualSafetyLocalRuntime(
        { [VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]: "relative/runtime" },
        defaultRoot,
      ),
    ).rejects.toThrow(/\[VS_LOCAL_RUNTIME_ROOT\] local-runtime-root-absolute-required/u);
    await expect(
      resolveVisualSafetyLocalRuntime(
        { [VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]: path.join(emptyRoot, "missing") },
        defaultRoot,
      ),
    ).rejects.toThrow(/\[VS_LOCAL_RUNTIME_ROOT\] local-runtime-path-unavailable/u);
    await expect(
      resolveVisualSafetyLocalRuntime(
        { [VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]: fileRoot },
        defaultRoot,
      ),
    ).rejects.toThrow(/\[VS_LOCAL_RUNTIME_ROOT\] local-runtime-root-invalid/u);
    await expect(
      resolveVisualSafetyLocalRuntime(
        { [VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]: emptyRoot },
        defaultRoot,
      ),
    ).rejects.toThrow(/\[VS_LOCAL_RUNTIME_ROOT\] local-runtime-path-unavailable/u);
  });

  it("rejects a junction or symlink in the runtime path without following it", async () => {
    const defaultRoot = await runtimeRoot(47_001);
    const root = await temporaryDirectory();
    const outside = await runtimeRoot(47_021);
    const link = path.join(root, "supabase");
    await fs.symlink(
      path.join(outside, "supabase"),
      link,
      process.platform === "win32" ? "junction" : "dir",
    );

    await expect(
      resolveVisualSafetyLocalRuntime(
        { [VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]: root },
        defaultRoot,
      ),
    ).rejects.toThrow(/\[VS_LOCAL_RUNTIME_ROOT\] local-runtime-path-reparse/u);
    await fs.unlink(link);
  });

  it("rejects a non-loopback discovery result with no hosted fallback", async () => {
    const root = await runtimeRoot(47_001);
    const hostedDiscovery = vi.fn(async () => ({
      origin: "https://synthetic.supabase.co",
      protocol: "https:",
      hostname: "127.0.0.1",
      effectivePort: 443,
    }) as unknown as CanonicalLoopbackOrigin);

    await expect(resolveVisualSafetyLocalRuntime({}, root, hostedDiscovery)).rejects.toThrow(
      /\[VS_LOCAL_RUNTIME_ROOT\] local-runtime-origin-not-loopback/u,
    );
  });

  it("uses one root for status cwd, workdir, environment, and expected origin", async () => {
    const root = await runtimeRoot(47_031);
    const runtime = await resolveVisualSafetyLocalRuntime(
      { [VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]: root },
      await runtimeRoot(47_001),
    );
    const contract = createLocalAuthenticatedSafetyContract({
      appOrigin: "http://127.0.0.1:3000",
      supabaseOrigin: runtime.origin,
    });
    const statusRunner = vi.fn<LocalSupabaseStatusRunner>((command, args, options) => {
      expect(command).toBe("supabase");
      expect(args).toEqual(["status", "-o", "env", "--workdir", runtime.root]);
      expect(options.cwd).toBe(runtime.root);
      expect(options.env[VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]).toBeUndefined();
      return {
        status: 0,
        stdout: [
          `API_URL=${runtime.origin}`,
          "ANON_KEY=synthetic-anon-key-value",
          "SERVICE_ROLE_KEY=synthetic-service-role-value",
        ].join("\n"),
      };
    });

    expect(discoverLocalFixtureCredentials(contract, runtime, statusRunner)).toEqual({
      anonKey: "synthetic-anon-key-value",
      serviceRoleKey: "synthetic-service-role-value",
    });
    expect(statusRunner).toHaveBeenCalledOnce();
  });

  it("never forwards the absolute override into public or local child environments", async () => {
    const root = await runtimeRoot(47_001);
    const source = {
      [VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]: root,
      VISUAL_SAFETY_MODE: "local-authenticated",
    };
    const local = sanitizedChildEnvironment(
      source,
      "local-authenticated",
      "http://127.0.0.1:47001",
      {
        anonKey: "synthetic-anon-key-value",
        serviceRoleKey: "synthetic-service-role-value",
      },
    );
    const publicEnvironment = sanitizedChildEnvironment(
      { [VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]: "invalid/relative" },
      "public",
    );
    const genericChildEnvironment = nonSensitiveEnvironment({
      PATH: process.env.PATH,
      [VISUAL_SAFETY_LOCAL_RUNTIME_ROOT.toLowerCase()]: root,
    });

    expect(local[VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]).toBeUndefined();
    expect(publicEnvironment[VISUAL_SAFETY_LOCAL_RUNTIME_ROOT]).toBeUndefined();
    expect(
      Object.keys(genericChildEnvironment).some(
        (name) => name.toUpperCase() === VISUAL_SAFETY_LOCAL_RUNTIME_ROOT,
      ),
    ).toBe(false);
    expect(genericChildEnvironment.PATH).toBe(process.env.PATH);
  });

  it("routes every CLI discovery through the resolver and removes child config reads", async () => {
    const frontendRoot = process.cwd();
    const cli = await fs.readFile(
      path.join(frontendRoot, "e2e", "scripts", "visual-safety-cli.mts"),
      "utf8",
    );
    const authSetup = await fs.readFile(path.join(frontendRoot, "e2e", "auth.setup.ts"), "utf8");
    const fixtureSeeder = await fs.readFile(
      path.join(frontendRoot, "tests", "quality", "seed-fixtures.mjs"),
      "utf8",
    );

    expect(cli.match(/resolveVisualSafetyLocalRuntime\(process\.env\)/gu)).toHaveLength(3);
    expect(cli).toContain("VISUAL_SAFETY_LOCAL_RUNTIME_ROOT)/i");
    expect(cli.match(/localRuntime\?\.overridden \? \[localRuntime\.root\] : \[\]/gu)).toHaveLength(2);
    expect(cli).not.toContain('path.join(repositoryRoot, "supabase", "config.toml")');
    expect(cli).toContain('["status", "-o", "env", "--workdir", runtime.root]');
    expect(cli).toContain("cwd: runtime.root");
    expect(authSetup).not.toContain("discoverLocalSupabaseOrigin");
    expect(authSetup).toContain("!safetyContract.supabaseOrigin");
    expect(authSetup).toContain("expectedSupabaseOrigin = safetyContract.supabaseOrigin");
    expect(fixtureSeeder).not.toContain("discoverLocalSupabaseOrigin");
    expect(fixtureSeeder).toContain("process.env.VISUAL_SAFETY_SUPABASE_ORIGIN");
    expect(fixtureSeeder).not.toContain("config.toml");
  });

  it("fails closed when a child contract origin is absent or non-loopback", () => {
    expect(() =>
      loadSafetyContractFromEnvironment({
        VISUAL_SAFETY_MODE: "local-authenticated",
        VISUAL_SAFETY_APP_ORIGIN: "http://127.0.0.1:3000",
      }),
    ).toThrow(/VS_ENV_MISSING/u);
    expect(() =>
      canonicalizeLoopbackOrigin(undefined as unknown as string),
    ).toThrow(/VS_ORIGIN_INVALID/u);
  });
});
