import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Node's type-stripping loader requires the source extension at runtime.
/* eslint-disable no-restricted-imports -- test-only safety core lives one directory up */
// @ts-expect-error TS5097: executed with `node --experimental-strip-types`.
import {
  canonicalizeLoopbackOrigin,
  createBuildProvenance as createSafetyBuildProvenance,
  createGuardedFetch,
  discoverLocalSupabaseOrigin,
  loadSafetyContractFromEnvironment,
  safeNextBuildPath,
  scanGeneratedAssets as scanSafetyGeneratedAssets,
  VISUAL_SAFETY_INVOCATION_SCHEMA_VERSION,
  verifyBuildProvenance as verifySafetyBuildProvenance,
  type BuildProvenance as SafetyBuildProvenance,
} from "../helpers/visual-safety.ts";
// @ts-expect-error TS5097: executed with `node --experimental-strip-types`.
import {
  startLoopbackEgressProxy,
  type LoopbackEgressProxy,
} from "../helpers/loopback-egress-proxy.ts";
/* eslint-enable no-restricted-imports */

type SafetyMode = "public" | "local-authenticated";

type SafetyContract = ReturnType<typeof loadSafetyContractFromEnvironment>;

interface StoredBuildProvenance {
  contract: SafetyBuildProvenance;
  assetDigest: string;
}

export interface LocalFixtureCredentials {
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}

const require = createRequire(import.meta.url);
export const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const repositoryRoot = path.resolve(frontendRoot, "..");
export const nextDirectory = path.join(frontendRoot, ".next");
export const provenancePath = path.join(nextDirectory, "tryvit-visual-safety-provenance.json");
export const violationMarkerPath = path.join(
  frontendRoot,
  "test-results",
  "visual-safety-violation.json",
);

const APP_PORT = 3000;
const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;
const PUBLIC_ANON_PLACEHOLDER = "tryvit-local-visual-safety-placeholder";
const REVIEWED_EXTERNAL_CONNECT_HOSTNAMES = Object.freeze([
  // Required while Next prerenders the existing Open Graph image routes.
  // Removing this build-time font fetch belongs to Phase 5A.0c.
  "fonts.gstatic.com",
]);
const ASSET_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".rsc",
  ".txt",
]);
const FORBIDDEN_ASSET_MARKERS = ["uskvezwftkkudvksmken", "rxtaicdpnaqigowdbmsb"];
const SENSITIVE_ENV_PATTERN =
  /(?:SUPABASE|POSTGRES|DATABASE|PASSWORD|TOKEN|SECRET|COOKIE|AUTHORIZATION|API_KEY|STAGING_(?:URL|SERVICE_KEY)|PRODUCTION_(?:URL|SERVICE_KEY))/i;
const UNSAFE_PROCESS_ENV_PATTERN =
  /^(?:ALL_PROXY|BROWSER|CHROME_PATH|DEBUG|DOCKER_(?:CERT_PATH|CONTEXT|HOST|TLS_VERIFY)|HTTP_PROXY|HTTPS_PROXY|LHCI_.*|LHCITEST_.*|LIGHTHOUSE_.*|NODE_DEBUG(?:_NATIVE)?|NODE_EXTRA_CA_CERTS|NODE_OPTIONS|NODE_PATH|NODE_REPL_EXTERNAL_MODULE|NODE_TLS_REJECT_UNAUTHORIZED|NODE_USE_ENV_PROXY|NO_PROXY|PLAYWRIGHT_.*|PUPPETEER_.*|PW(?!D$).*|SSLKEYLOGFILE|VISUAL_SAFETY_CONFIG_(?:RUNNER_PID|SEAL))$/iu;
const MAX_CHILD_OUTPUT_BYTES = 32 * 1024 * 1024;
const ARTIFACT_ROOTS = Object.freeze([
  path.join(frontendRoot, "test-results"),
  path.join(frontendRoot, "playwright-report"),
  path.join(frontendRoot, "pr-screenshots"),
  path.join(frontendRoot, "qa_screenshots"),
  path.join(frontendRoot, "lighthouse-reports"),
  path.join(repositoryRoot, "docs", "screenshots"),
  path.join(repositoryRoot, "playwright-stdout.log"),
  path.join(repositoryRoot, "playwright-public-stdout.log"),
  path.join(repositoryRoot, "playwright-authenticated-stdout.log"),
]);
const activeOwnedCleanups = new Set<() => Promise<void>>();

function registerOwnedCleanup(cleanup: () => Promise<void>): () => void {
  activeOwnedCleanups.add(cleanup);
  return () => activeOwnedCleanups.delete(cleanup);
}

async function cleanupOwnedResources(): Promise<void> {
  const cleanups = [...activeOwnedCleanups].reverse();
  activeOwnedCleanups.clear();
  const results = await Promise.allSettled(cleanups.map((cleanup) => cleanup()));
  if (results.some((result) => result.status === "rejected")) {
    throw safetyError("VS_CLEANUP", "owned-resource-cleanup-failed");
  }
}

function installTerminationHandlers(): void {
  let handlingSignal = false;
  for (const [signal, exitCode] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    process.once(signal, () => {
      if (handlingSignal) return;
      handlingSignal = true;
      void cleanupOwnedResources()
        .catch(() => {
          process.stderr.write("[VS_CLEANUP] owned-resource-cleanup-failed\n");
        })
        .finally(() => process.exit(exitCode));
    });
  }
}

function safetyError(code: string, category: string): Error {
  return new Error(`[${code}] ${category}`);
}

function nonSensitiveEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const name of Object.keys(source)) {
    if (!SENSITIVE_ENV_PATTERN.test(name) && !UNSAFE_PROCESS_ENV_PATTERN.test(name)) {
      result[name] = source[name];
    }
  }
  return result;
}

export function assertSafeParentEnvironment(source: NodeJS.ProcessEnv): void {
  if (
    Object.entries(source).some(([name, value]) => UNSAFE_PROCESS_ENV_PATTERN.test(name) && value)
  ) {
    throw safetyError("VS_PARENT_ENV", "unsafe-process-control-environment");
  }
}

function parseMode(value: string | undefined): SafetyMode {
  if (value === "public" || value === "local-authenticated") return value;
  throw safetyError("VS_MODE_INVALID", "explicit-mode-required");
}

export function normalizePlaywrightArguments(args: readonly string[]): {
  playwrightArgs: string[];
  qualityLevel?: "smoke" | "full";
  projects: Set<string>;
} {
  const playwrightArgs: string[] = [];
  const projects = new Set<string>();
  let qualityLevel: "smoke" | "full" | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--config" || argument.startsWith("-c") || argument.startsWith("--config=")) {
      throw safetyError("VS_PLAYWRIGHT_ARGUMENT", "config-override-rejected");
    }
    const unsafeFlag = [
      "--debug",
      "--ui",
      "--ui-host",
      "--ui-port",
      "--trace",
      "--output",
      "--update-snapshots",
      "--update-source-method",
    ].some((flag) => argument === flag || argument.startsWith(`${flag}=`));
    if (unsafeFlag) {
      throw safetyError("VS_PLAYWRIGHT_ARGUMENT", "artifact-or-runtime-override-rejected");
    }
    if (argument === "-u" || argument.startsWith("-u=")) {
      throw safetyError("VS_PLAYWRIGHT_ARGUMENT", "snapshot-update-rejected");
    }
    if (
      argument === "--reporter" ||
      (argument.startsWith("--reporter=") &&
        argument !== "--reporter=list" &&
        argument !== "--reporter=html,list")
    ) {
      throw safetyError("VS_PLAYWRIGHT_ARGUMENT", "reporter-override-rejected");
    }
    if (argument.startsWith("--quality-level=")) {
      const value = argument.slice("--quality-level=".length);
      if (value !== "smoke" && value !== "full") {
        throw safetyError("VS_QUALITY_LEVEL", "quality-level-invalid");
      }
      qualityLevel = value;
      continue;
    }
    if (argument === "--project") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw safetyError("VS_PLAYWRIGHT_ARGUMENT", "project-value-missing");
      }
      projects.add(value);
      playwrightArgs.push(argument, value);
      index += 1;
      continue;
    }
    if (argument.startsWith("--project=")) {
      projects.add(argument.slice("--project=".length));
    }
    playwrightArgs.push(argument);
  }

  return { playwrightArgs, qualityLevel, projects };
}

function dotenvVariableNames(): Set<string> {
  const names = new Set<string>();
  const filenames = [".env", ".env.local", ".env.production", ".env.production.local"];
  for (const root of [repositoryRoot, frontendRoot]) {
    for (const filename of filenames) {
      const candidate = path.join(root, filename);
      if (!existsSync(candidate)) continue;
      const contents = readFileSync(candidate, "utf8");
      for (const line of contents.split(/\r?\n/u)) {
        const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
        if (match) names.add(match[1]);
      }
    }
  }
  return names;
}

export function parseLocalSupabaseStatusEnvironment(
  contents: string,
  expectedOrigin: string,
): LocalFixtureCredentials {
  const values = new Map<string, string>();
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))$/u.exec(line);
    if (!match) {
      throw safetyError("VS_LOCAL_STATUS", "local-status-output-invalid");
    }
    values.set(match[1], match[2] ?? match[3] ?? match[4]);
  }

  const apiUrl = values.get("API_URL");
  const anonKey = values.get("ANON_KEY");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw safetyError("VS_LOCAL_STATUS", "local-status-values-missing");
  }
  if (
    canonicalizeLoopbackOrigin(apiUrl).origin !== canonicalizeLoopbackOrigin(expectedOrigin).origin
  ) {
    throw safetyError("VS_LOCAL_STATUS", "local-status-origin-mismatch");
  }
  if (anonKey.length < 16 || serviceRoleKey.length < 16) {
    throw safetyError("VS_LOCAL_STATUS", "local-status-credentials-invalid");
  }
  return Object.freeze({ anonKey, serviceRoleKey });
}

function discoverLocalFixtureCredentials(contract: SafetyContract): LocalFixtureCredentials {
  if (contract.mode !== "local-authenticated" || !contract.supabaseOrigin) {
    throw safetyError("VS_LOCAL_STATUS", "local-status-mode-invalid");
  }
  const result = spawnSync("supabase", ["status", "-o", "env", "--workdir", repositoryRoot], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    env: nonSensitiveEnvironment(process.env),
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0 || result.error) {
    throw safetyError("VS_LOCAL_STATUS", "local-status-unavailable");
  }
  return parseLocalSupabaseStatusEnvironment(result.stdout, contract.supabaseOrigin);
}

export function sanitizedChildEnvironment(
  source: NodeJS.ProcessEnv,
  mode: SafetyMode,
  buildSupabaseOrigin: string,
  localCredentials?: LocalFixtureCredentials,
): NodeJS.ProcessEnv {
  const result = nonSensitiveEnvironment(source);
  // Prevent Next's dotenv loader from restoring repository-local values.
  for (const name of dotenvVariableNames()) result[name] = "";

  result.NEXT_TELEMETRY_DISABLED = "1";
  result.VISUAL_SAFETY_MODE = mode;
  result.BASE_URL = APP_ORIGIN;
  result.NEXT_PUBLIC_APP_URL = APP_ORIGIN;
  result.NEXT_PUBLIC_SUPABASE_URL = buildSupabaseOrigin;
  result.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    mode === "local-authenticated" ? (localCredentials?.anonKey ?? "") : PUBLIC_ANON_PLACEHOLDER;
  result.SUPABASE_SERVICE_ROLE_KEY = "";
  result.QA_TEST_EMAIL = "";
  result.QA_TEST_PASSWORD = "";
  return result;
}

export function assertNodeEnvProxySupported(version = process.versions.node): void {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(version);
  if (!match) {
    throw safetyError("VS_NODE_PROXY", "node-version-invalid");
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const supported = major >= 25 || (major === 24 && minor >= 5) || (major === 22 && minor >= 21);
  if (!supported) {
    throw safetyError("VS_NODE_PROXY", "env-proxy-unsupported");
  }
}

function applyOwnedProxyEnvironment(environment: NodeJS.ProcessEnv, proxyOrigin: string): void {
  // Next build/start inherit the owned proxy through Node's built-in env-proxy
  // support. Fail closed on runtimes that would silently ignore this control.
  assertNodeEnvProxySupported();
  const canonicalProxy = canonicalizeLoopbackOrigin(proxyOrigin).origin;
  environment.HTTP_PROXY = canonicalProxy;
  environment.HTTPS_PROXY = canonicalProxy;
  environment.NO_PROXY = "localhost,127.0.0.1,[::1]";
  environment.NODE_USE_ENV_PROXY = "1";
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const output: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      throw safetyError("VS_ASSET_SYMLINK", "generated-asset-symlink");
    }
    if (entry.isDirectory()) output.push(...walkFiles(candidate));
    else if (entry.isFile()) output.push(candidate);
  }
  return output.sort((left, right) => left.localeCompare(right, "en"));
}

function filesAtOrBelow(root: string): string[] {
  if (!existsSync(root)) return [];
  const metadata = lstatSync(root);
  if (metadata.isSymbolicLink()) {
    throw safetyError("VS_ARTIFACT_PATH", "artifact-reparse-point");
  }
  if (metadata.isDirectory()) return walkFiles(root);
  return metadata.isFile() ? [root] : [];
}

export function assertSafeNextDirectory(root = frontendRoot, candidate = nextDirectory): string {
  const lexicalRoot = path.resolve(root);
  // `realpathSync.native` avoids Windows 8.3 aliases, keeping provenance and
  // path ownership deterministic with Linux and promise-based realpath calls.
  const resolvedRoot = realpathSync.native(lexicalRoot);
  const expected = path.join(resolvedRoot, ".next");
  const resolvedCandidate = path.resolve(candidate);
  if (
    path.basename(resolvedCandidate) !== ".next" ||
    path.dirname(resolvedCandidate) !== lexicalRoot
  ) {
    throw safetyError("VS_NEXT_TARGET", "cleanup-target-outside-frontend");
  }

  if (existsSync(resolvedCandidate)) {
    const metadata = lstatSync(resolvedCandidate);
    if (metadata.isSymbolicLink()) {
      throw safetyError("VS_NEXT_REPARSE", "cleanup-target-reparse-point");
    }
    if (!metadata.isDirectory()) {
      throw safetyError("VS_NEXT_TYPE", "cleanup-target-not-directory");
    }
    if (realpathSync.native(resolvedCandidate) !== expected) {
      throw safetyError("VS_NEXT_ESCAPE", "cleanup-target-realpath-mismatch");
    }
  }
  return expected;
}

export async function assertPortAvailable(port = APP_PORT, host = "127.0.0.1"): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createNetServer();
    server.unref();
    server.once("error", () => {
      reject(safetyError("VS_PORT_OWNERSHIP", "application-port-in-use"));
    });
    server.listen({ host, port, exclusive: true }, () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

export function assertNoUnownedNextProcess(root = frontendRoot): void {
  // Verify the workspace exists, then conservatively block cleanup while any
  // unowned Next CLI is active. This avoids missing repo-root/relative starts.
  realpathSync.native(path.resolve(root));
  if (process.platform === "win32") {
    const script = [
      "$match = Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(?i:node(?:\\.exe)?)$' -and $_.CommandLine -and $_.CommandLine -match '(?i)next(?:\\\\|/)dist(?:\\\\|/)bin(?:\\\\|/)next' } | Select-Object -First 1",
      "if ($match) { exit 42 }",
      "exit 0",
    ].join("; ");
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        encoding: "utf8",
        windowsHide: true,
        env: {
          SystemRoot: process.env.SystemRoot,
          PATH: process.env.PATH,
        },
      },
    );
    if (result.status === 42) {
      throw safetyError("VS_NEXT_OWNERSHIP", "unowned-next-process-detected");
    }
    if (result.status !== 0) {
      throw safetyError("VS_NEXT_OWNERSHIP", "process-inspection-failed");
    }
    return;
  }

  if (process.platform === "linux" && existsSync("/proc")) {
    for (const entry of readdirSync("/proc", { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^\d+$/u.test(entry.name)) continue;
      try {
        const command = readFileSync(path.join("/proc", entry.name, "cmdline"), "utf8").replaceAll(
          "\0",
          " ",
        );
        if (/next(?:\/|\\)dist(?:\/|\\)bin(?:\/|\\)next/iu.test(command)) {
          throw safetyError("VS_NEXT_OWNERSHIP", "unowned-next-process-detected");
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("[VS_NEXT_OWNERSHIP]")) {
          throw error;
        }
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ESRCH") {
          throw safetyError("VS_NEXT_OWNERSHIP", "process-inspection-failed");
        }
        // The process exited between enumeration and inspection.
      }
    }
    return;
  }

  throw safetyError("VS_NEXT_OWNERSHIP", "process-inspection-unsupported");
}

function sourceSha(): string {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  const value = result.stdout.trim();
  if (result.status !== 0 || !/^[0-9a-f]{40}$/u.test(value)) {
    throw safetyError("VS_SOURCE_SHA", "source-revision-unavailable");
  }
  return value;
}

export function scanGeneratedAssets(root = nextDirectory): {
  assetDigest: string;
  scannedFiles: number;
} {
  const assetRoots = [path.join(root, "static"), path.join(root, "server")];
  const hash = createHash("sha256");
  let scannedFiles = 0;
  let forbiddenMatches = 0;

  for (const assetRoot of assetRoots) {
    for (const filename of walkFiles(assetRoot)) {
      const extension = path.extname(filename).toLowerCase();
      if (!ASSET_EXTENSIONS.has(extension)) continue;
      const relative = path.relative(root, filename).split(path.sep).join("/");
      const bytes = readFileSync(filename);
      const lower = bytes.toString("utf8").toLowerCase();
      forbiddenMatches += FORBIDDEN_ASSET_MARKERS.filter((marker) => lower.includes(marker)).length;
      // Source-map documentation exceptions are validated by the async core
      // scanner called immediately before this digest pass.
      if (extension !== ".map" && containsForbiddenHostedText(bytes)) {
        forbiddenMatches += 1;
      }
      hash.update(relative);
      hash.update("\0");
      hash.update(bytes);
      hash.update("\0");
      scannedFiles += 1;
    }
  }

  if (forbiddenMatches > 0) {
    throw safetyError("VS_ASSET_HOSTED_ORIGIN", `forbidden-generated-markers:${forbiddenMatches}`);
  }
  if (scannedFiles === 0) {
    throw safetyError("VS_ASSET_EMPTY", "generated-client-assets-missing");
  }
  return { assetDigest: hash.digest("hex"), scannedFiles };
}

export async function writeBuildProvenance(
  contract: SafetyContract,
): Promise<StoredBuildProvenance> {
  await scanSafetyGeneratedAssets(nextDirectory);
  const { assetDigest } = scanGeneratedAssets();
  const buildIdPath = path.join(nextDirectory, "BUILD_ID");
  if (!existsSync(buildIdPath)) {
    throw safetyError("VS_BUILD_ID", "next-build-id-missing");
  }
  const nextBuildId = readFileSync(buildIdPath, "utf8").trim();
  if (!/^[A-Za-z0-9_-]+$/u.test(nextBuildId)) {
    throw safetyError("VS_BUILD_ID", "next-build-id-invalid");
  }
  const provenance: StoredBuildProvenance = {
    contract: createSafetyBuildProvenance({
      contract,
      sourceGitSha: sourceSha(),
      buildId: nextBuildId,
      buildInputIds: [
        `assets:${assetDigest}`,
        contract.mode === "public" ? "loopback-placeholder-v1" : "local-emulator-v1",
      ],
    }),
    assetDigest,
  };
  writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return provenance;
}

export async function verifyBuildProvenance(
  contract: SafetyContract,
): Promise<StoredBuildProvenance> {
  if (!existsSync(provenancePath)) {
    throw safetyError("VS_PROVENANCE_MISSING", "build-provenance-missing");
  }
  let actual: StoredBuildProvenance;
  try {
    actual = JSON.parse(readFileSync(provenancePath, "utf8")) as BuildProvenance;
  } catch {
    throw safetyError("VS_PROVENANCE_PARSE", "build-provenance-invalid");
  }
  await scanSafetyGeneratedAssets(nextDirectory);
  const { assetDigest } = scanGeneratedAssets();
  const buildId = readFileSync(path.join(nextDirectory, "BUILD_ID"), "utf8").trim();
  const expected = createSafetyBuildProvenance({
    contract,
    sourceGitSha: sourceSha(),
    buildId,
    buildInputIds: [
      `assets:${assetDigest}`,
      contract.mode === "public" ? "loopback-placeholder-v1" : "local-emulator-v1",
    ],
  });
  try {
    verifySafetyBuildProvenance(actual.contract, expected);
  } catch {
    throw safetyError("VS_PROVENANCE_MISMATCH", "build-runtime-input-mismatch");
  }
  if (actual.assetDigest !== assetDigest) {
    throw safetyError("VS_PROVENANCE_MISMATCH", "build-asset-digest-mismatch");
  }
  return actual;
}

function lockPath(): string {
  const id = createHash("sha256").update(frontendRoot).digest("hex").slice(0, 16);
  return path.join(tmpdir(), `tryvit-visual-safety-${id}.lock`);
}

function acquireBuildLock(): () => void {
  const candidate = lockPath();
  let descriptor: number;
  try {
    descriptor = openSync(
      candidate,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o600,
    );
  } catch {
    throw safetyError("VS_BUILD_LOCK", "another-build-in-progress");
  }
  writeFileSync(descriptor, `${process.pid}\n`, "utf8");
  return () => {
    try {
      closeSync(descriptor);
    } finally {
      try {
        unlinkSync(candidate);
      } catch {
        // The descriptor still proves this invocation owned the lock.
      }
    }
  };
}

function sensitiveValuesFromEnvironment(environment: NodeJS.ProcessEnv): string[] {
  return [
    ...new Set(
      Object.entries(environment)
        .filter(([name, value]) => SENSITIVE_ENV_PATTERN.test(name) && value)
        .map(([, value]) => value as string)
        .filter((value) => value.length >= 4),
    ),
  ].sort((left, right) => right.length - left.length);
}

function containsBytes(haystack: Buffer, needle: Buffer): boolean {
  return needle.byteLength > 0 && haystack.indexOf(needle) >= 0;
}

function containsForbiddenHostedText(bytes: Buffer): boolean {
  const lower = bytes.toString("utf8").toLowerCase();
  return (
    FORBIDDEN_ASSET_MARKERS.some((marker) => lower.includes(marker)) ||
    /(?:https?|wss?):\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.supabase\.co(?=$|[^a-z0-9.-])/u.test(
      lower,
    )
  );
}

export function assertNoSensitiveArtifactContent(
  roots: readonly string[],
  sensitiveValues: readonly string[],
): { filesScanned: number; bytesScanned: number } {
  const needles = [...new Set(sensitiveValues)]
    .filter((value) => value.length >= 4)
    .map((value) => Buffer.from(value, "utf8"));
  let filesScanned = 0;
  let bytesScanned = 0;

  for (const root of roots) {
    for (const filename of filesAtOrBelow(root)) {
      if (path.extname(filename).toLowerCase() === ".zip") {
        throw safetyError("VS_ARTIFACT_ARCHIVE", "unscannable-trace-archive");
      }
      const bytes = readFileSync(filename);
      filesScanned += 1;
      bytesScanned += bytes.byteLength;
      if (
        needles.some((needle) => containsBytes(bytes, needle)) ||
        containsForbiddenHostedText(bytes)
      ) {
        throw safetyError("VS_ARTIFACT_SECRET", "artifact-content-forbidden");
      }
    }
  }
  return { filesScanned, bytesScanned };
}

function artifactSnapshot(): Map<string, string> {
  const snapshot = new Map<string, string>();
  for (const root of ARTIFACT_ROOTS) {
    for (const filename of filesAtOrBelow(root)) {
      const metadata = lstatSync(filename);
      snapshot.set(filename, `${metadata.size}:${metadata.mtimeMs}`);
    }
  }
  return snapshot;
}

function scanChangedArtifacts(
  before: ReadonlyMap<string, string>,
  sensitiveValues: readonly string[],
): { filesScanned: number; bytesScanned: number } {
  const changed: string[] = [];
  for (const root of ARTIFACT_ROOTS) {
    for (const filename of filesAtOrBelow(root)) {
      const metadata = lstatSync(filename);
      if (before.get(filename) !== `${metadata.size}:${metadata.mtimeMs}`) {
        changed.push(filename);
      }
    }
  }
  return assertNoSensitiveArtifactContent(changed, sensitiveValues);
}

function emitSanitizedChildOutput(
  chunks: readonly Buffer[],
  destination: NodeJS.WriteStream,
  sensitiveValues: readonly string[],
): void {
  let contents = Buffer.concat(chunks).toString("utf8");
  for (const value of sensitiveValues) contents = contents.replaceAll(value, "[redacted]");
  destination.write(contents);
}

export function runChild(
  executable: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; cwd?: string },
): Promise<number> {
  return new Promise((resolve, reject) => {
    const sensitiveValues = sensitiveValuesFromEnvironment(options.env);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let outputBytes = 0;
    const child = spawn(executable, args, {
      cwd: options.cwd ?? frontendRoot,
      env: options.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    const unregister = registerOwnedCleanup(() => terminateOwnedChild(child));
    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_CHILD_OUTPUT_BYTES) {
        void terminateOwnedChild(child);
        return;
      }
      target.push(Buffer.from(chunk));
    };
    child.stdout?.on("data", collect(stdoutChunks));
    child.stderr?.on("data", collect(stderrChunks));
    child.once("error", (error) => {
      unregister();
      reject(error);
    });
    child.once("exit", async (code, signal) => {
      try {
        await terminateOwnedChild(child);
      } catch {
        unregister();
        reject(safetyError("VS_CHILD_CLEANUP", "owned-child-tree-cleanup"));
        return;
      }
      unregister();
      const combined = Buffer.concat([...stdoutChunks, ...stderrChunks]);
      if (outputBytes > MAX_CHILD_OUTPUT_BYTES) {
        reject(safetyError("VS_CHILD_OUTPUT", "owned-child-output-limit"));
        return;
      }
      if (sensitiveValues.some((value) => containsBytes(combined, Buffer.from(value, "utf8")))) {
        reject(safetyError("VS_CHILD_SECRET", "owned-child-secret-output"));
        return;
      }
      if (containsForbiddenHostedText(combined)) {
        reject(safetyError("VS_CHILD_HOSTED", "owned-child-hosted-output"));
        return;
      }
      emitSanitizedChildOutput(stdoutChunks, process.stdout, sensitiveValues);
      emitSanitizedChildOutput(stderrChunks, process.stderr, sensitiveValues);
      if (signal) reject(safetyError("VS_CHILD_SIGNAL", "owned-child-terminated"));
      else resolve(code ?? 1);
    });
  });
}

async function buildSupabaseOrigin(contract: SafetyContract): Promise<string> {
  if (contract.mode === "local-authenticated") {
    if (!contract.supabaseOrigin) {
      throw safetyError("VS_LOCAL_ORIGIN", "local-supabase-origin-missing");
    }
    return contract.supabaseOrigin;
  }
  if (contract.publicBuildAdapter) {
    return contract.publicBuildAdapter.supabaseOrigin;
  }
  return (await discoverLocalSupabaseOrigin(path.join(repositoryRoot, "supabase", "config.toml")))
    .origin;
}

export async function cleanBuild(
  contract: SafetyContract,
  localCredentials?: LocalFixtureCredentials,
  proxyOrigin?: string,
): Promise<StoredBuildProvenance> {
  if (!proxyOrigin) {
    throw safetyError("VS_BUILD_PROXY", "owned-egress-proxy-required");
  }
  await assertPortAvailable();
  assertNoUnownedNextProcess();
  const release = acquireBuildLock();
  try {
    const target = await safeNextBuildPath(frontendRoot, nextDirectory);
    if (existsSync(target)) rmSync(target, { recursive: true, force: false });

    const localOrigin = await buildSupabaseOrigin(contract);
    const env = sanitizedChildEnvironment(
      process.env,
      contract.mode,
      localOrigin,
      localCredentials,
    );
    applyOwnedProxyEnvironment(env, proxyOrigin);
    if (contract.mode === "local-authenticated" && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw safetyError("VS_LOCAL_ANON", "local-anon-key-missing");
    }
    const nextCli = require.resolve("next/dist/bin/next");
    const code = await runChild(process.execPath, [nextCli, "build"], {
      cwd: frontendRoot,
      env,
    });
    if (code !== 0) throw safetyError("VS_BUILD_FAILED", "next-build-failed");
    return writeBuildProvenance(contract);
  } finally {
    release();
  }
}

async function waitForLoopbackReady(origin: string, attempts = 60): Promise<void> {
  const guarded = createGuardedFetch({
    allowedOrigin: origin,
    fetchImpl: fetch,
    maxRedirects: 0,
  });
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await guarded(origin, {
        method: "GET",
        redirect: "manual",
      });
      if (response.status >= 200 && response.status < 400) return;
    } catch {
      // A refused loopback connection is expected while the owned child starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw safetyError("VS_READINESS", "owned-server-not-ready");
}

function signalOwnedProcessTree(child: ChildProcess, force: boolean): boolean {
  if (child.pid === undefined) return false;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    });
    return result.status === 0;
  }
  try {
    // Owned children are detached process-group leaders on POSIX.
    process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    try {
      return child.kill(force ? "SIGKILL" : "SIGTERM");
    } catch {
      return false;
    }
  }
}

export async function terminateOwnedChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    signalOwnedProcessTree(child, false);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      if (forceTimer) clearTimeout(forceTimer);
      if (terminalTimer) clearTimeout(terminalTimer);
      child.removeListener("close", onClose);
      child.removeListener("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onClose = () => finish();
    const onError = () => finish();
    child.once("close", onClose);
    child.once("error", onError);
    const forceTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        signalOwnedProcessTree(child, true);
      }
    }, 5_000);
    const terminalTimer = setTimeout(
      () => finish(safetyError("VS_CHILD_CLEANUP", "owned-child-did-not-exit")),
      10_000,
    );
    const signaled = signalOwnedProcessTree(child, false);
    if (!signaled) finish();
  });
}

export async function waitForOwnedNextReady(
  child: ChildProcess,
  timeoutMs = 30_000,
): Promise<void> {
  if (!child.stdout || !child.stderr) {
    throw safetyError("VS_SERVER_STDIO", "owned-server-pipes-missing");
  }
  await new Promise<void>((resolve, reject) => {
    let output = "";
    const finish = (error?: Error) => {
      clearTimeout(timer);
      child.stdout?.removeListener("data", onData);
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
      if (error) reject(error);
      else resolve();
    };
    const onData = (chunk: Buffer) => {
      output = `${output}${chunk.toString("utf8")}`.slice(-4_096);
      if (/Ready in/iu.test(output)) finish();
    };
    const onError = () => finish(safetyError("VS_SERVER_SPAWN", "owned-server-spawn-failed"));
    const onExit = () => finish(safetyError("VS_SERVER_EXIT", "owned-server-exited-before-ready"));
    const timer = setTimeout(
      () => finish(safetyError("VS_SERVER_READY", "owned-server-ready-timeout")),
      timeoutMs,
    );
    child.stdout?.on("data", onData);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

export async function startOwnedServer(
  contract: SafetyContract,
  localCredentials?: LocalFixtureCredentials,
  proxyOrigin?: string,
): Promise<{ child: ChildProcess; stop: () => Promise<void> }> {
  if (!proxyOrigin) {
    throw safetyError("VS_SERVER_PROXY", "owned-egress-proxy-required");
  }
  const localOrigin = await buildSupabaseOrigin(contract);
  await verifyBuildProvenance(contract);
  await assertPortAvailable();
  const env = sanitizedChildEnvironment(process.env, contract.mode, localOrigin, localCredentials);
  applyOwnedProxyEnvironment(env, proxyOrigin);
  const sensitiveValues = sensitiveValuesFromEnvironment(env);
  const nextCli = require.resolve("next/dist/bin/next");
  const child = spawn(
    process.execPath,
    [nextCli, "start", "-H", "127.0.0.1", "-p", String(APP_PORT)],
    {
      cwd: frontendRoot,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
    },
  );
  const output: Buffer[] = [];
  let outputBytes = 0;
  const collectOutput = (chunk: Buffer) => {
    outputBytes += chunk.byteLength;
    if (outputBytes <= MAX_CHILD_OUTPUT_BYTES) output.push(Buffer.from(chunk));
    else void terminateOwnedChild(child);
  };
  child.stdout?.on("data", collectOutput);
  child.stderr?.on("data", collectOutput);
  let stopped = false;
  let stopping: Promise<void> | undefined;
  let unregister = () => {};
  const stop = async () => {
    if (stopped) return;
    if (!stopping) {
      stopping = (async () => {
        await terminateOwnedChild(child);
        if (outputBytes > MAX_CHILD_OUTPUT_BYTES) {
          throw safetyError("VS_CHILD_OUTPUT", "owned-server-output-limit");
        }
        const combined = Buffer.concat(output);
        if (sensitiveValues.some((value) => containsBytes(combined, Buffer.from(value, "utf8")))) {
          throw safetyError("VS_CHILD_SECRET", "owned-server-secret-output");
        }
        if (containsForbiddenHostedText(combined)) {
          throw safetyError("VS_CHILD_HOSTED", "owned-server-hosted-output");
        }
        stopped = true;
        unregister();
      })();
    }
    try {
      await stopping;
    } finally {
      if (!stopped) stopping = undefined;
    }
  };
  unregister = registerOwnedCleanup(stop);
  try {
    await waitForOwnedNextReady(child);
    await waitForLoopbackReady(APP_ORIGIN);
    if (child.exitCode !== null || child.signalCode !== null) {
      throw safetyError("VS_SERVER_EXIT", "owned-server-not-running");
    }
    return { child, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

function clearViolationMarker(): void {
  if (existsSync(violationMarkerPath)) unlinkSync(violationMarkerPath);
}

function assertNoViolationMarker(): void {
  if (existsSync(violationMarkerPath)) {
    throw safetyError("VS_EGRESS_RECORDED", "browser-egress-violation");
  }
}

function assertProxyClean(proxy: LoopbackEgressProxy): void {
  if (proxy.summary.total !== 0) {
    throw safetyError("VS_EGRESS_RECORDED", "browser-egress-violation");
  }
  assertNoViolationMarker();
}

function pathIsWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

export function assertExternalAuthStateRoot(
  candidateRoot: string,
  workspaceRoot = repositoryRoot,
): string {
  const resolvedRoot = realpathSync.native(candidateRoot);
  const resolvedWorkspace = realpathSync.native(workspaceRoot);
  if (pathIsWithin(resolvedWorkspace, resolvedRoot)) {
    throw safetyError("VS_AUTH_STATE_ROOT", "temporary-root-inside-workspace");
  }
  return resolvedRoot;
}

function createOwnedAuthStateDirectory(): {
  directory: string;
  ownerToken: string;
  cleanup: () => Promise<void>;
} {
  const temporaryRoot = assertExternalAuthStateRoot(tmpdir());
  const directory = mkdtempSync(path.join(temporaryRoot, "tryvit-visual-auth-"));
  const ownerToken = randomUUID();
  writeFileSync(path.join(directory, ".tryvit-visual-safety-owner"), `${ownerToken}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  let removed = false;
  return {
    directory,
    ownerToken,
    cleanup: async () => {
      if (removed) return;
      const resolved = path.resolve(directory);
      if (
        path.dirname(resolved) !== temporaryRoot ||
        !path.basename(resolved).startsWith("tryvit-visual-auth-")
      ) {
        throw safetyError("VS_AUTH_STATE_CLEANUP", "temporary-path-unproven");
      }
      if (!existsSync(resolved)) {
        removed = true;
        return;
      }
      const metadata = lstatSync(resolved);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw safetyError("VS_AUTH_STATE_CLEANUP", "temporary-path-reparse");
      }
      rmSync(resolved, { recursive: true, force: false });
      removed = true;
    },
  };
}

function createInvocationProof(
  contract: SafetyContract,
  proxyOrigin: string,
  serverPid: number | undefined,
): {
  file: string;
  ownerToken: string;
  cleanup: () => Promise<void>;
} {
  if (!serverPid || !Number.isSafeInteger(serverPid) || serverPid <= 0) {
    throw safetyError("VS_INVOCATION_PROOF", "owned-server-pid-missing");
  }
  const temporaryRoot = assertExternalAuthStateRoot(tmpdir());
  const directory = mkdtempSync(path.join(temporaryRoot, "tryvit-visual-invocation-"));
  const file = path.join(directory, "proof.json");
  const ownerToken = randomUUID();
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        schemaVersion: VISUAL_SAFETY_INVOCATION_SCHEMA_VERSION,
        ownerToken,
        launcherPid: process.pid,
        serverPid,
        mode: contract.mode,
        appOrigin: contract.appOrigin,
        proxyOrigin,
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  let removed = false;
  return {
    file,
    ownerToken,
    cleanup: async () => {
      if (removed) return;
      const resolved = path.resolve(directory);
      if (
        path.dirname(resolved) !== temporaryRoot ||
        !path.basename(resolved).startsWith("tryvit-visual-invocation-")
      ) {
        throw safetyError("VS_INVOCATION_CLEANUP", "temporary-path-unproven");
      }
      if (existsSync(resolved)) {
        const metadata = lstatSync(resolved);
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
          throw safetyError("VS_INVOCATION_CLEANUP", "temporary-path-reparse");
        }
        rmSync(resolved, { recursive: true, force: false });
      }
      removed = true;
    },
  };
}

async function runPlaywright(mode: SafetyMode, args: string[]): Promise<number> {
  const normalized = normalizePlaywrightArguments(args);
  const sanitized = nonSensitiveEnvironment(process.env);
  for (const name of dotenvVariableNames()) sanitized[name] = "";
  sanitized.VISUAL_SAFETY_MODE = mode;
  sanitized.BASE_URL = APP_ORIGIN;
  sanitized.VISUAL_SAFETY_APP_ORIGIN = APP_ORIGIN;
  if (normalized.projects.has("visual-safety-browser")) {
    sanitized.VISUAL_SAFETY_BROWSER_TESTS = "true";
  }
  if (normalized.projects.has("visual-safety-negative")) {
    sanitized.VISUAL_SAFETY_NEGATIVE_TESTS = "true";
  }
  if (normalized.projects.has("visual-smoke")) {
    sanitized.VISUAL_REGRESSION = "true";
  }
  if (normalized.projects.has("screenshots")) {
    sanitized.CAPTURE_SCREENSHOTS = "true";
  }
  if (normalized.projects.has("pr-screenshots")) {
    sanitized.PR_SCREENSHOTS = "true";
  }
  if (normalized.projects.has("quality-mobile") || normalized.projects.has("quality-desktop")) {
    const qualityLevel = normalized.qualityLevel ?? process.env.QA_MODE_LEVEL;
    if (qualityLevel !== "smoke" && qualityLevel !== "full") {
      throw safetyError("VS_QUALITY_LEVEL", "quality-level-required");
    }
    sanitized.QA_MODE_LEVEL = qualityLevel;
  }
  let contract: SafetyContract;
  if (mode === "public") {
    delete sanitized.VISUAL_SAFETY_SUPABASE_ORIGIN;
    sanitized.VISUAL_SAFETY_BUILD_SUPABASE_ORIGIN = (
      await discoverLocalSupabaseOrigin(path.join(repositoryRoot, "supabase", "config.toml"))
    ).origin;
    sanitized.VISUAL_SAFETY_BUILD_ADAPTER_ID = "loopback-placeholder-v1";
    contract = loadSafetyContractFromEnvironment(sanitized);
  } else {
    const localOrigin = (
      await discoverLocalSupabaseOrigin(path.join(repositoryRoot, "supabase", "config.toml"))
    ).origin;
    sanitized.VISUAL_SAFETY_SUPABASE_ORIGIN = localOrigin;
    contract = loadSafetyContractFromEnvironment(sanitized);
  }
  return runAfterSafetyPreflight(contract, async (localCredentials) => {
    if (localCredentials) {
      sanitized.NEXT_PUBLIC_SUPABASE_URL = contract.supabaseOrigin ?? "";
      sanitized.NEXT_PUBLIC_SUPABASE_ANON_KEY = localCredentials.anonKey;
      sanitized.SUPABASE_SERVICE_ROLE_KEY = localCredentials.serviceRoleKey;
    }
    clearViolationMarker();
    const artifactsBefore = artifactSnapshot();
    const proxy = await startLoopbackEgressProxy({
      violationMarkerPath,
      contract,
      allowedConnectHostnames: REVIEWED_EXTERNAL_CONNECT_HOSTNAMES,
    });
    const unregisterProxy = registerOwnedCleanup(proxy.close);
    let authState: ReturnType<typeof createOwnedAuthStateDirectory> | undefined;
    let unregisterAuthState = () => {};
    let ownedServer: Awaited<ReturnType<typeof startOwnedServer>> | undefined;
    let invocationProof: ReturnType<typeof createInvocationProof> | undefined;
    let unregisterInvocationProof = () => {};
    try {
      await cleanBuild(contract, localCredentials ?? undefined, proxy.origin);
      authState = localCredentials ? createOwnedAuthStateDirectory() : undefined;
      unregisterAuthState = authState ? registerOwnedCleanup(authState.cleanup) : () => {};
      if (authState) {
        sanitized.VISUAL_SAFETY_AUTH_STATE_DIR = authState.directory;
        sanitized.VISUAL_SAFETY_AUTH_STATE_OWNER = authState.ownerToken;
      }
      ownedServer = await startOwnedServer(contract, localCredentials ?? undefined, proxy.origin);
      invocationProof = createInvocationProof(contract, proxy.origin, ownedServer.child.pid);
      unregisterInvocationProof = registerOwnedCleanup(invocationProof.cleanup);
      const playwrightEnv: NodeJS.ProcessEnv = {
        ...sanitized,
        VISUAL_SAFETY_PROXY: proxy.origin,
        VISUAL_SAFETY_OWNED_SERVER: "true",
        VISUAL_SAFETY_INVOCATION_FILE: invocationProof.file,
        VISUAL_SAFETY_INVOCATION_TOKEN: invocationProof.ownerToken,
      };
      const playwrightCli = require.resolve("@playwright/test/cli");
      const code = await runChild(
        process.execPath,
        [playwrightCli, "test", ...normalized.playwrightArgs],
        { cwd: frontendRoot, env: playwrightEnv },
      );
      assertProxyClean(proxy);
      await verifyBuildProvenance(contract);
      scanChangedArtifacts(artifactsBefore, sensitiveValuesFromEnvironment(playwrightEnv));
      return code;
    } finally {
      try {
        scanChangedArtifacts(artifactsBefore, sensitiveValuesFromEnvironment(sanitized));
      } finally {
        try {
          if (ownedServer) await ownedServer.stop();
        } finally {
          try {
            if (invocationProof) await invocationProof.cleanup();
          } finally {
            try {
              unregisterInvocationProof();
              if (authState) await authState.cleanup();
            } finally {
              unregisterAuthState();
              try {
                assertProxyClean(proxy);
              } finally {
                unregisterProxy();
                await proxy.close();
              }
            }
          }
        }
      }
    }
  });
}

export async function preflightLocalEmulator(
  contract: SafetyContract,
): Promise<LocalFixtureCredentials | null> {
  if (contract.mode !== "local-authenticated") return null;
  if (!contract.supabaseOrigin) {
    throw safetyError("VS_LOCAL_ORIGIN", "local-supabase-origin-missing");
  }
  const guarded = createGuardedFetch({
    allowedOrigin: contract.supabaseOrigin,
    fetchImpl: fetch,
    maxRedirects: 0,
  });
  let response: Response;
  try {
    response = await guarded(`${contract.supabaseOrigin}/auth/v1/health`, {
      method: "GET",
      redirect: "manual",
    });
  } catch {
    throw safetyError("VS_LOCAL_READINESS", "local-emulator-unavailable");
  }
  if (response.status < 200 || response.status >= 300) {
    throw safetyError("VS_LOCAL_READINESS", "local-emulator-not-ready");
  }
  // Credentials come from this exact running local runtime, never ambient env.
  return discoverLocalFixtureCredentials(contract);
}

export async function runAfterSafetyPreflight<T>(
  contract: SafetyContract,
  action: (localCredentials: LocalFixtureCredentials | null) => Promise<T>,
  preflight: (
    value: SafetyContract,
  ) => Promise<LocalFixtureCredentials | null> = preflightLocalEmulator,
): Promise<T> {
  const localCredentials = await preflight(contract);
  return action(localCredentials);
}

async function serveCommand(
  contract: SafetyContract,
  localCredentials?: LocalFixtureCredentials,
): Promise<number> {
  clearViolationMarker();
  const proxy = await startLoopbackEgressProxy({
    violationMarkerPath,
    contract,
    allowedConnectHostnames: REVIEWED_EXTERNAL_CONNECT_HOSTNAMES,
  });
  const unregisterProxy = registerOwnedCleanup(proxy.close);
  let server: Awaited<ReturnType<typeof startOwnedServer>> | undefined;
  try {
    server = await startOwnedServer(contract, localCredentials, proxy.origin);
    if (server.child.exitCode !== null) return server.child.exitCode;
    return await new Promise<number>((resolve) => {
      server.child.once("exit", (code) => resolve(code ?? 0));
    });
  } finally {
    try {
      if (server) await server.stop();
    } finally {
      try {
        assertProxyClean(proxy);
      } finally {
        unregisterProxy();
        await proxy.close();
      }
    }
  }
}

async function assertCommand(
  contract: SafetyContract,
  localCredentials?: LocalFixtureCredentials | null,
): Promise<void> {
  assertNoViolationMarker();
  await verifyBuildProvenance(contract);
  const artifactEnvironment = { ...process.env };
  if (localCredentials) {
    artifactEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY = localCredentials.anonKey;
    artifactEnvironment.SUPABASE_SERVICE_ROLE_KEY = localCredentials.serviceRoleKey;
  }
  assertNoSensitiveArtifactContent(
    ARTIFACT_ROOTS,
    sensitiveValuesFromEnvironment(artifactEnvironment),
  );
}

function installedPlaywrightChromiumPath(): string {
  try {
    const playwright = require("@playwright/test") as {
      chromium: { executablePath: () => string };
    };
    const resolved = realpathSync.native(playwright.chromium.executablePath());
    if (!lstatSync(resolved).isFile()) {
      throw new Error("not a file");
    }
    return resolved;
  } catch {
    throw safetyError("VS_LIGHTHOUSE_CHROME", "playwright-chromium-unavailable");
  }
}

async function runLighthouse(contract: SafetyContract, requested: string[]): Promise<number> {
  if (contract.mode !== "public") {
    throw safetyError(
      "VS_LIGHTHOUSE_AUTH_BLOCKED",
      "authenticated-lighthouse-requires-dedicated-local-fixture",
    );
  }
  const variants =
    requested.length === 0 || requested[0] === "all" ? ["mobile", "desktop"] : requested;
  if (
    variants.length === 0 ||
    variants.some((value) => value !== "mobile" && value !== "desktop")
  ) {
    throw safetyError("VS_LIGHTHOUSE_MODE", "lighthouse-variant-invalid");
  }

  clearViolationMarker();
  const artifactsBefore = artifactSnapshot();
  const proxy = await startLoopbackEgressProxy({
    violationMarkerPath,
    contract,
    allowedConnectHostnames: REVIEWED_EXTERNAL_CONNECT_HOSTNAMES,
    // Lighthouse receives an additional path-aware Puppeteer guard below.
    // Chromium background CONNECTs expose no path, so the proxy contains them
    // while the page guard is responsible for classifying Supabase attempts.
    opaqueConnectPolicy: "contain",
  });
  const unregisterProxy = registerOwnedCleanup(proxy.close);
  const chromiumPath = installedPlaywrightChromiumPath();
  let ownedServer: Awaited<ReturnType<typeof startOwnedServer>> | undefined;
  const temporaryConfigs: string[] = [];
  let exitCode = 0;
  try {
    await cleanBuild(contract, undefined, proxy.origin);
    ownedServer = await startOwnedServer(contract, undefined, proxy.origin);
    for (const variant of variants) {
      const sourcePath = path.join(frontendRoot, `lighthouserc.${variant}.js`);
      // The checked-in configuration is read-only in this phase. Generate a
      // temporary public-only copy with the owned server and loopback proxy.
      delete require.cache[sourcePath];
      const source = require(sourcePath) as {
        ci: {
          collect: Record<string, unknown>;
          upload?: Record<string, unknown>;
        };
      };
      const config = structuredClone(source);
      delete config.ci.collect.startServerCommand;
      delete config.ci.collect.startServerReadyPattern;
      delete config.ci.collect.startServerReadyTimeout;
      config.ci.collect.puppeteerScript = path.relative(
        frontendRoot,
        path.join(frontendRoot, "e2e", "scripts", "lighthouse-public-guard.cjs"),
      );
      config.ci.collect.url = [`${APP_ORIGIN}/auth/login`];
      const launchOptions =
        (config.ci.collect.puppeteerLaunchOptions as
          | {
              args?: string[];
            }
          | undefined) ?? {};
      const proxyArguments = [`--proxy-server=${proxy.origin}`, "--proxy-bypass-list=<-loopback>"];
      launchOptions.args = [...(launchOptions.args ?? []), ...proxyArguments];
      config.ci.collect.puppeteerLaunchOptions = launchOptions;
      const settings = (config.ci.collect.settings as Record<string, unknown> | undefined) ?? {};
      // Puppeteer owns Chrome when the safety script is active; LHCI ignores
      // settings.chromeFlags in that mode. Equivalent launch flags already
      // live in puppeteerLaunchOptions above.
      delete settings.chromeFlags;
      config.ci.collect.settings = settings;
      config.ci.upload = {
        target: "filesystem",
        outputDir: "lighthouse-reports",
      };

      const temporaryPath = path.join(tmpdir(), `tryvit-lighthouse-${variant}-${process.pid}.cjs`);
      temporaryConfigs.push(temporaryPath);
      writeFileSync(temporaryPath, `module.exports = ${JSON.stringify(config)};\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      const lighthouseCli = require.resolve("@lhci/cli/src/cli.js");
      const env = sanitizedChildEnvironment(
        process.env,
        "public",
        await buildSupabaseOrigin(contract),
      );
      env.VISUAL_SAFETY_PROXY = proxy.origin;
      env.VISUAL_SAFETY_VIOLATION_MARKER = violationMarkerPath;
      // LHCI's platform finder does not discover Playwright's managed browser
      // on every host. Use the exact installed executable already exercised by
      // Playwright rather than accepting an ambient browser-path override.
      env.CHROME_PATH = chromiumPath;
      const code = await runChild(
        process.execPath,
        [lighthouseCli, "autorun", `--config=${temporaryPath}`],
        { cwd: frontendRoot, env },
      );
      if (code !== 0) exitCode = code;
      assertProxyClean(proxy);
    }
    await verifyBuildProvenance(contract);
    return exitCode;
  } finally {
    try {
      scanChangedArtifacts(artifactsBefore, sensitiveValuesFromEnvironment(process.env));
    } finally {
      try {
        if (ownedServer) await ownedServer.stop();
      } finally {
        try {
          assertProxyClean(proxy);
        } finally {
          unregisterProxy();
          await proxy.close();
          for (const temporaryPath of temporaryConfigs) {
            try {
              unlinkSync(temporaryPath);
            } catch {
              // Generated outside the repository; cleanup is best effort.
            }
          }
        }
      }
    }
  }
}

async function main(): Promise<number> {
  assertSafeParentEnvironment(process.env);
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw safetyError("VS_COMMAND", "command-required");

  if (command === "public") return runPlaywright("public", args);
  if (command === "local-authenticated") {
    return runPlaywright("local-authenticated", args);
  }

  const mode =
    command === "public-lighthouse" ? "public" : parseMode(process.env.VISUAL_SAFETY_MODE);
  const commandEnvironment = nonSensitiveEnvironment(process.env);
  commandEnvironment.VISUAL_SAFETY_MODE = mode;
  for (const name of ["VISUAL_SAFETY_APP_ORIGIN", "BASE_URL"] as const) {
    const requested = commandEnvironment[name];
    if (requested !== undefined && requested !== APP_ORIGIN) {
      throw safetyError("VS_APP_ORIGIN", "owned-application-origin-mismatch");
    }
    commandEnvironment[name] = APP_ORIGIN;
  }
  if (mode === "local-authenticated") {
    commandEnvironment.VISUAL_SAFETY_SUPABASE_ORIGIN = (
      await discoverLocalSupabaseOrigin(path.join(repositoryRoot, "supabase", "config.toml"))
    ).origin;
  } else {
    commandEnvironment.VISUAL_SAFETY_BUILD_SUPABASE_ORIGIN = (
      await discoverLocalSupabaseOrigin(path.join(repositoryRoot, "supabase", "config.toml"))
    ).origin;
    commandEnvironment.VISUAL_SAFETY_BUILD_ADAPTER_ID = "loopback-placeholder-v1";
  }
  const contract = loadSafetyContractFromEnvironment(commandEnvironment);
  if (command === "preflight") {
    await preflightLocalEmulator(contract);
    return 0;
  }
  if (command === "build") {
    const localCredentials = await preflightLocalEmulator(contract);
    clearViolationMarker();
    const proxy = await startLoopbackEgressProxy({
      violationMarkerPath,
      contract,
      allowedConnectHostnames: REVIEWED_EXTERNAL_CONNECT_HOSTNAMES,
    });
    const unregisterProxy = registerOwnedCleanup(proxy.close);
    try {
      await cleanBuild(contract, localCredentials ?? undefined, proxy.origin);
      assertProxyClean(proxy);
    } finally {
      unregisterProxy();
      await proxy.close();
    }
    return 0;
  }
  if (command === "serve") {
    const localCredentials = await preflightLocalEmulator(contract);
    return serveCommand(contract, localCredentials ?? undefined);
  }
  if (command === "lighthouse" || command === "public-lighthouse") {
    return runLighthouse(contract, args);
  }
  if (command === "assert") {
    const localCredentials = await preflightLocalEmulator(contract);
    await assertCommand(contract, localCredentials);
    return 0;
  }
  throw safetyError("VS_COMMAND", "command-unrecognized");
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  installTerminationHandlers();
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(async (error: unknown) => {
      let cleanupError = false;
      try {
        await cleanupOwnedResources();
      } catch {
        cleanupError = true;
      }
      const message = cleanupError
        ? "[VS_CLEANUP] owned-resource-cleanup-failed"
        : error instanceof Error
          ? error.message
          : "[VS_UNKNOWN] failure";
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
