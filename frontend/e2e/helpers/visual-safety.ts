import { createHash, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { BrowserContext, Route } from "@playwright/test";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";

export type VisualSafetyMode = "public" | "local-authenticated";

export const VISUAL_SAFETY_SCHEMA_VERSION = "tryvit-visual-safety/v1";
export const VISUAL_SAFETY_INVOCATION_SCHEMA_VERSION =
  "tryvit-visual-safety-invocation/v1";

export const VISUAL_SAFETY_ENV = Object.freeze({
  mode: "VISUAL_SAFETY_MODE",
  appOrigin: "VISUAL_SAFETY_APP_ORIGIN",
  supabaseOrigin: "VISUAL_SAFETY_SUPABASE_ORIGIN",
  publicBuildSupabaseOrigin: "VISUAL_SAFETY_BUILD_SUPABASE_ORIGIN",
  publicBuildAdapterId: "VISUAL_SAFETY_BUILD_ADAPTER_ID",
} as const);

const DEFAULT_HOSTED_SUPABASE_ORIGINS = Object.freeze([
  "https://uskvezwftkkudvksmken.supabase.co",
  "https://rxtaicdpnaqigowdbmsb.supabase.co",
]);

const DEFAULT_HOSTED_PROJECT_REFERENCES = Object.freeze([
  "uskvezwftkkudvksmken",
  "rxtaicdpnaqigowdbmsb",
]);

const REVIEWED_SDK_DOCUMENTATION_ORIGINS = new Set([
  "https://example.supabase.co",
  "https://myproject.supabase.co",
  "https://project-id.supabase.co",
  "https://realtime.supabase.co",
  "https://xyzcompany.supabase.co",
]);
const CONCRETE_HOSTED_ORIGIN_PATTERN =
  /(?:https?|wss?):\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.supabase\.co(?=$|[^a-z0-9.-])/gu;

const LOOPBACK_ORIGIN_PATTERN =
  /^(http|https):\/\/(localhost|127\.0\.0\.1|\[::1\])(?::([0-9]{1,5}))?\/?$/;

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const PUBLIC_FORBIDDEN_SUPABASE_ENV_NAMES = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY_STAGING",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY_STAGING",
  "SUPABASE_URL",
  "SUPABASE_URL_STAGING",
  "STAGING_URL",
  "STAGING_SERVICE_KEY",
  "PRODUCTION_URL",
  "PRODUCTION_SERVICE_KEY",
]);
const SUPABASE_SERVICE_PREFIXES = Object.freeze([
  "/auth/v1",
  "/rest/v1",
  "/graphql/v1",
  "/realtime/v1",
  "/storage/v1",
  "/functions/v1",
]);

/**
 * The only non-loopback HTTP request deliberately represented during visual
 * tests.  The real Turnstile script is never fetched: the route guard serves
 * a local inert response for precisely the script injected by
 * @marsidev/react-turnstile.  This avoids Chromium's URL-less
 * ERR_BLOCKED_BY_CLIENT console noise without allowing arbitrary egress.
 */
const TURNSTILE_SCRIPT_HOST = "challenges.cloudflare.com";
const TURNSTILE_SCRIPT_PATH = "/turnstile/v0/api.js";
const TURNSTILE_ONLOAD_CALLBACK = "onloadTurnstileCallback";
const TURNSTILE_RENDER_MODE = "explicit";
const CONTAINED_TURNSTILE_SCRIPT =
  "/* TryVit visual-safety: Cloudflare Turnstile intentionally contained. */";

export class VisualSafetyError extends Error {
  readonly code: string;
  readonly category: string;
  readonly redactedHostname?: string;

  constructor(code: string, category: string, hostname?: string) {
    const redactedHostname = hostname ? redactHostname(hostname) : undefined;
    super(
      redactedHostname
        ? `${code}:${category}:${redactedHostname}`
        : `${code}:${category}`,
    );
    this.name = "VisualSafetyError";
    this.code = code;
    this.category = category;
    this.redactedHostname = redactedHostname;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      ...(this.redactedHostname
        ? { redactedHostname: this.redactedHostname }
        : {}),
    };
  }
}

export interface CanonicalLoopbackOrigin {
  readonly origin: string;
  readonly protocol: "http:" | "https:";
  readonly hostname: "localhost" | "127.0.0.1" | "[::1]";
  readonly effectivePort: number;
}

export interface PublicBuildAdapter {
  readonly id: string;
  readonly supabaseOrigin: string;
}

interface BaseSafetyContract {
  readonly mode: VisualSafetyMode;
  readonly appOrigin: string;
  readonly supabaseOrigin: string | null;
  readonly publicBuildAdapter: PublicBuildAdapter | null;
  readonly knownHostedSupabaseOrigins: readonly string[];
}

export interface PublicSafetyContract extends BaseSafetyContract {
  readonly mode: "public";
  readonly supabaseOrigin: null;
}

export interface LocalAuthenticatedSafetyContract extends BaseSafetyContract {
  readonly mode: "local-authenticated";
  readonly supabaseOrigin: string;
  readonly publicBuildAdapter: null;
}

export type VisualSafetyContract =
  | PublicSafetyContract
  | LocalAuthenticatedSafetyContract;

export interface VisualSafetyInvocationProof {
  readonly schemaVersion: typeof VISUAL_SAFETY_INVOCATION_SCHEMA_VERSION;
  readonly ownerToken: string;
  readonly launcherPid: number;
  readonly serverPid: number;
  readonly mode: VisualSafetyMode;
  readonly appOrigin: string;
  readonly proxyOrigin: string;
}

export interface EgressViolation {
  readonly transport: "http" | "websocket";
  readonly category:
    | "invalid-url"
    | "hosted-supabase-origin"
    | "known-hosted-supabase-origin"
    | "non-loopback-supabase-service";
}

export interface EgressAuditSummary {
  readonly total: number;
  readonly categories: Readonly<Record<string, number>>;
}

export interface EgressAudit {
  readonly record: (violation: EgressViolation) => void;
  readonly summary: () => EgressAuditSummary;
}

export interface BuildProvenance {
  readonly schemaVersion: string;
  readonly mode: VisualSafetyMode;
  readonly appOrigin: string;
  readonly supabaseOrigin: string | "none";
  readonly publicBuildAdapterId: string | "none";
  readonly sourceGitSha: string;
  readonly buildId: string;
  readonly buildInputIds: readonly string[];
  readonly fingerprint: string;
}

function equalOpaqueText(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function validateInvocationProof(
  value: unknown,
  expected: {
    readonly ownerToken: string;
    readonly launcherPid: number;
    readonly contract: VisualSafetyContract;
    readonly proxyOrigin: string;
  },
): VisualSafetyInvocationProof {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("VS_INVOCATION_PROOF", "proof.invalid");
  }
  const proof = value as Record<string, unknown>;
  const expectedKeys = [
    "appOrigin",
    "launcherPid",
    "mode",
    "ownerToken",
    "proxyOrigin",
    "schemaVersion",
    "serverPid",
  ];
  if (
    JSON.stringify(Object.keys(proof).sort()) !== JSON.stringify(expectedKeys)
  ) {
    fail("VS_INVOCATION_PROOF", "proof.shape");
  }
  if (
    proof.schemaVersion !== VISUAL_SAFETY_INVOCATION_SCHEMA_VERSION ||
    typeof proof.ownerToken !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      proof.ownerToken,
    ) ||
    !equalOpaqueText(proof.ownerToken, expected.ownerToken) ||
    proof.launcherPid !== expected.launcherPid ||
    !Number.isSafeInteger(proof.launcherPid) ||
    !Number.isSafeInteger(proof.serverPid) ||
    (proof.serverPid as number) <= 0 ||
    proof.mode !== expected.contract.mode ||
    proof.appOrigin !== expected.contract.appOrigin ||
    typeof proof.proxyOrigin !== "string" ||
    canonicalizeLoopbackOrigin(proof.proxyOrigin).origin !==
      canonicalizeLoopbackOrigin(expected.proxyOrigin).origin
  ) {
    fail("VS_INVOCATION_PROOF", "proof.mismatch");
  }
  return Object.freeze(proof as unknown as VisualSafetyInvocationProof);
}

export interface BuildProvenanceInput {
  readonly contract: VisualSafetyContract;
  readonly sourceGitSha: string;
  readonly buildId: string;
  readonly buildInputIds?: readonly string[];
  readonly schemaVersion?: string;
}

export interface GeneratedAssetScanOptions {
  readonly knownHostedProjectReferences?: readonly string[];
  readonly forbiddenHostedOrigins?: readonly string[];
}

export interface GeneratedAssetScanResult {
  readonly filesScanned: number;
  readonly bytesScanned: number;
}

function redactHostname(hostname: string): string {
  const normalized = hostname.toLowerCase();
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]"
  ) {
    return normalized;
  }
  return "[redacted]";
}

function fail(code: string, category: string, hostname?: string): never {
  throw new VisualSafetyError(code, category, hostname);
}

function isCanonicalLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

export function canonicalizeLoopbackOrigin(
  rawOrigin: string,
): CanonicalLoopbackOrigin {
  if (typeof rawOrigin !== "string" || rawOrigin !== rawOrigin.trim()) {
    fail("VS_ORIGIN_INVALID", "origin.syntax");
  }

  const match = LOOPBACK_ORIGIN_PATTERN.exec(rawOrigin);
  if (!match) fail("VS_ORIGIN_INVALID", "origin.noncanonical");

  const explicitPort = match[3] ? Number(match[3]) : undefined;
  if (
    explicitPort !== undefined &&
    (!Number.isSafeInteger(explicitPort) ||
      explicitPort < 1 ||
      explicitPort > 65_535)
  ) {
    fail("VS_ORIGIN_INVALID", "origin.port");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    fail("VS_ORIGIN_INVALID", "origin.syntax");
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    !isCanonicalLoopbackHostname(parsed.hostname)
  ) {
    fail("VS_ORIGIN_INVALID", "origin.components", parsed.hostname);
  }

  const effectivePort =
    explicitPort ?? (parsed.protocol === "https:" ? 443 : 80);

  return Object.freeze({
    origin: parsed.origin,
    protocol: parsed.protocol,
    hostname: parsed.hostname as CanonicalLoopbackOrigin["hostname"],
    effectivePort,
  });
}

function stripTomlComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if ((character === '"' || character === "'") && line[index - 1] !== "\\") {
      quote = quote === character ? null : quote ?? character;
    } else if (character === "#" && quote === null) {
      return line.slice(0, index);
    }
  }
  return line;
}

export function parseLocalSupabaseConfig(configToml: string): {
  readonly apiPort: number;
  readonly apiTlsEnabled: boolean;
} {
  let section = "";
  let apiPort: number | undefined;
  let apiTlsEnabled = false;
  let sawTlsEnabled = false;

  for (const rawLine of configToml.replace(/^\uFEFF/, "").split(/\r?\n/u)) {
    const line = stripTomlComment(rawLine).trim();
    if (!line) continue;

    const sectionMatch = /^\[([^\]]+)\]$/u.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }

    if (section === "api") {
      const portMatch = /^port\s*=\s*([0-9]+)$/u.exec(line);
      if (portMatch) {
        if (apiPort !== undefined) {
          fail("VS_CONFIG_INVALID", "config.api-port-duplicate");
        }
        apiPort = Number(portMatch[1]);
      } else if (/^port\s*=/u.test(line)) {
        fail("VS_CONFIG_INVALID", "config.api-port");
      }
    } else if (section === "api.tls") {
      const tlsMatch = /^enabled\s*=\s*(true|false)$/u.exec(line);
      if (tlsMatch) {
        if (sawTlsEnabled) {
          fail("VS_CONFIG_INVALID", "config.api-tls-duplicate");
        }
        sawTlsEnabled = true;
        apiTlsEnabled = tlsMatch[1] === "true";
      } else if (/^enabled\s*=/u.test(line)) {
        fail("VS_CONFIG_INVALID", "config.api-tls");
      }
    }
  }

  if (
    apiPort === undefined ||
    !Number.isSafeInteger(apiPort) ||
    apiPort < 1 ||
    apiPort > 65_535
  ) {
    fail("VS_CONFIG_INVALID", "config.api-port");
  }

  return Object.freeze({ apiPort, apiTlsEnabled });
}

export async function discoverLocalSupabaseOrigin(
  configTomlPath: string,
): Promise<CanonicalLoopbackOrigin> {
  let configToml: string;
  try {
    configToml = await fs.readFile(configTomlPath, "utf8");
  } catch {
    fail("VS_CONFIG_UNAVAILABLE", "config.read");
  }

  const config = parseLocalSupabaseConfig(configToml);
  const scheme = config.apiTlsEnabled ? "https" : "http";
  return canonicalizeLoopbackOrigin(
    `${scheme}://127.0.0.1:${config.apiPort}`,
  );
}

function normalizeKnownHostedOrigins(
  origins: readonly string[] | undefined,
): readonly string[] {
  const normalized = new Set<string>(DEFAULT_HOSTED_SUPABASE_ORIGINS);
  for (const value of origins ?? []) {
    try {
      const parsed = new URL(value);
      if (
        (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
        parsed.username ||
        parsed.password
      ) {
        fail("VS_POLICY_INVALID", "policy.hosted-origin");
      }
      normalized.add(parsed.origin);
    } catch (error) {
      if (error instanceof VisualSafetyError) throw error;
      fail("VS_POLICY_INVALID", "policy.hosted-origin");
    }
  }
  return Object.freeze([...normalized].sort());
}

export function createPublicSafetyContract(input: {
  readonly appOrigin: string;
  readonly publicBuildAdapter?: {
    readonly id?: string;
    readonly supabaseOrigin: string;
  } | null;
  readonly knownHostedSupabaseOrigins?: readonly string[];
}): PublicSafetyContract {
  const appOrigin = canonicalizeLoopbackOrigin(input.appOrigin).origin;
  let publicBuildAdapter: PublicBuildAdapter | null = null;

  if (input.publicBuildAdapter) {
    const id = input.publicBuildAdapter.id ?? "loopback-placeholder-v1";
    assertSafeIdentifier(id, "contract.build-adapter-id");
    if (
      !/^(?:loopback-placeholder|[a-z][a-z0-9-]*-loopback)-v[1-9][0-9]*$/u.test(
        id,
      )
    ) {
      fail("VS_PROVENANCE_INVALID", "contract.build-adapter-id");
    }
    publicBuildAdapter = Object.freeze({
      id,
      supabaseOrigin: canonicalizeLoopbackOrigin(
        input.publicBuildAdapter.supabaseOrigin,
      ).origin,
    });
  }

  return Object.freeze({
    mode: "public",
    appOrigin,
    supabaseOrigin: null,
    publicBuildAdapter,
    knownHostedSupabaseOrigins: normalizeKnownHostedOrigins(
      input.knownHostedSupabaseOrigins,
    ),
  });
}

export function createLocalAuthenticatedSafetyContract(input: {
  readonly appOrigin: string;
  readonly supabaseOrigin: string;
  readonly knownHostedSupabaseOrigins?: readonly string[];
}): LocalAuthenticatedSafetyContract {
  return Object.freeze({
    mode: "local-authenticated",
    appOrigin: canonicalizeLoopbackOrigin(input.appOrigin).origin,
    supabaseOrigin: canonicalizeLoopbackOrigin(input.supabaseOrigin).origin,
    publicBuildAdapter: null,
    knownHostedSupabaseOrigins: normalizeKnownHostedOrigins(
      input.knownHostedSupabaseOrigins,
    ),
  });
}

export function loadSafetyContractFromEnvironment(
  environment: NodeJS.ProcessEnv,
): VisualSafetyContract {
  const mode = environment[VISUAL_SAFETY_ENV.mode];
  const appOrigin =
    environment[VISUAL_SAFETY_ENV.appOrigin] ?? environment.BASE_URL;

  if (!appOrigin) fail("VS_ENV_MISSING", "environment.app-origin");

  if (mode === "public") {
    for (const forbiddenName of PUBLIC_FORBIDDEN_SUPABASE_ENV_NAMES) {
      if (environment[forbiddenName]) {
        fail("VS_ENV_FORBIDDEN", "environment.public-credential");
      }
    }

    const adapterOrigin =
      environment[VISUAL_SAFETY_ENV.publicBuildSupabaseOrigin];
    return createPublicSafetyContract({
      appOrigin,
      publicBuildAdapter: adapterOrigin
        ? {
            id:
              environment[VISUAL_SAFETY_ENV.publicBuildAdapterId] ??
              "loopback-placeholder-v1",
            supabaseOrigin: adapterOrigin,
          }
        : null,
    });
  }

  if (mode === "local-authenticated") {
    const supabaseOrigin = environment[VISUAL_SAFETY_ENV.supabaseOrigin];
    if (!supabaseOrigin) {
      fail("VS_ENV_MISSING", "environment.supabase-origin");
    }
    return createLocalAuthenticatedSafetyContract({
      appOrigin,
      supabaseOrigin,
    });
  }

  fail("VS_ENV_INVALID", "environment.mode");
}

function isHostedSupabaseHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "supabase.co" || normalized.endsWith(".supabase.co");
}

function safelyDecodedPathnames(pathname: string): readonly string[] {
  const paths = [pathname.toLowerCase().replace(/\/{2,}/gu, "/")];
  let current = pathname;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      paths.push(decoded.toLowerCase().replace(/\/{2,}/gu, "/"));
      current = decoded;
    } catch {
      break;
    }
  }
  return paths;
}

function pathUsesSupabaseService(
  pathname: string,
  transport: "http" | "websocket",
): boolean {
  const prefixes =
    transport === "websocket"
      ? ["/realtime/v1"]
      : SUPABASE_SERVICE_PREFIXES;

  return safelyDecodedPathnames(pathname).some((candidate) =>
    prefixes.some(
      (prefix) =>
        candidate === prefix ||
        candidate.startsWith(`${prefix}/`) ||
        candidate.startsWith(`${prefix};`),
    ),
  );
}

export function classifyForbiddenEgress(
  rawUrl: string,
  transport: "http" | "websocket",
  contract?: Pick<VisualSafetyContract, "knownHostedSupabaseOrigins">,
): EgressViolation | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return Object.freeze({ transport, category: "invalid-url" });
  }

  const expectedProtocols =
    transport === "websocket" ? ["ws:", "wss:"] : ["http:", "https:"];
  if (!expectedProtocols.includes(parsed.protocol)) {
    return Object.freeze({ transport, category: "invalid-url" });
  }

  if (isHostedSupabaseHostname(parsed.hostname)) {
    return Object.freeze({
      transport,
      category: "hosted-supabase-origin",
    });
  }

  const httpEquivalentOrigin =
    parsed.protocol === "ws:"
      ? parsed.origin.replace(/^ws:/u, "http:")
      : parsed.protocol === "wss:"
        ? parsed.origin.replace(/^wss:/u, "https:")
        : parsed.origin;

  if (
    contract?.knownHostedSupabaseOrigins.includes(httpEquivalentOrigin)
  ) {
    return Object.freeze({
      transport,
      category: "known-hosted-supabase-origin",
    });
  }

  if (
    !isCanonicalLoopbackHostname(parsed.hostname) &&
    pathUsesSupabaseService(parsed.pathname, transport)
  ) {
    return Object.freeze({
      transport,
      category: "non-loopback-supabase-service",
    });
  }

  return null;
}

export function createEgressAudit(): EgressAudit {
  const counts = new Map<string, number>();
  return Object.freeze({
    record(violation: EgressViolation) {
      const key = `${violation.transport}.${violation.category}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    },
    summary(): EgressAuditSummary {
      const categories = Object.fromEntries(
        [...counts.entries()].sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
      return Object.freeze({
        total: [...counts.values()].reduce((sum, count) => sum + count, 0),
        categories: Object.freeze(categories),
      });
    },
  });
}

export function assertNoEgressViolations(audit: EgressAudit): void {
  if (audit.summary().total > 0) {
    fail("VS_EGRESS_BLOCKED", "browser.egress");
  }
}

function isNonLoopbackNetworkTarget(rawUrl: string): boolean {
  try {
    return !isCanonicalLoopbackHostname(new URL(rawUrl).hostname);
  } catch {
    return true;
  }
}

/**
 * Returns true only for the exact script generated by the reviewed Turnstile
 * wrapper.  It deliberately rejects other resource types, query shapes, and
 * hosts so this exception cannot become a general external-resource allowlist.
 */
function isExpectedTurnstileScriptRequest(route: Route): boolean {
  const request = route.request();
  // The runtime method check keeps test doubles fail-closed as well.
  if (
    typeof request.resourceType !== "function" ||
    request.resourceType() !== "script"
  ) {
    return false;
  }

  let target: URL;
  try {
    target = new URL(request.url());
  } catch {
    return false;
  }

  const parameters = [...target.searchParams.entries()].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
  );
  const expectedParameters = [
    ["onload", TURNSTILE_ONLOAD_CALLBACK],
    ["render", TURNSTILE_RENDER_MODE],
  ];

  return (
    target.protocol === "https:" &&
    target.hostname === TURNSTILE_SCRIPT_HOST &&
    target.port === "" &&
    target.username === "" &&
    target.password === "" &&
    target.pathname === TURNSTILE_SCRIPT_PATH &&
    target.hash === "" &&
    JSON.stringify(parameters) === JSON.stringify(expectedParameters)
  );
}

export async function installBrowserEgressGuards(
  context: BrowserContext,
  contract: VisualSafetyContract,
  audit: EgressAudit,
): Promise<void> {
  if (context.pages().length > 0) {
    fail("VS_BROWSER_ORDER", "browser.page-exists");
  }
  if (context.serviceWorkers().length > 0) {
    fail("VS_BROWSER_SERVICE_WORKER", "browser.service-worker-active");
  }

  await context.route("**/*", async (route) => {
    const violation = classifyForbiddenEgress(
      route.request().url(),
      "http",
      contract,
    );
    if (violation) {
      audit.record(violation);
      await route.abort("blockedbyclient");
      return;
    }
    // The checked-in Turnstile wrapper injects exactly one public script.  We
    // keep it fully network-contained by answering locally with inert code,
    // rather than aborting it and suppressing Chromium's generic console
    // error.  Every non-exact external request continues to be aborted below.
    if (isExpectedTurnstileScriptRequest(route)) {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: CONTAINED_TURNSTILE_SCRIPT,
      });
      return;
    }
    // Keep safety runs network-contained even for unrelated public providers.
    // Those attempts are not Supabase violations, so they are contained without
    // poisoning the Supabase egress audit. The lower-level proxy remains fatal
    // if a non-loopback request bypasses this path-aware browser guard.
    if (isNonLoopbackNetworkTarget(route.request().url())) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  await context.routeWebSocket(/.*/u, async (webSocketRoute) => {
    const violation = classifyForbiddenEgress(
      webSocketRoute.url(),
      "websocket",
      contract,
    );
    if (violation) {
      audit.record(violation);
      await webSocketRoute.close({ code: 1008, reason: "visual safety" });
      return;
    }
    if (isNonLoopbackNetworkTarget(webSocketRoute.url())) {
      await webSocketRoute.close({ code: 1008, reason: "visual containment" });
      return;
    }
    webSocketRoute.connectToServer();
  });
}

function canonicalOriginFromInput(
  origin: string | CanonicalLoopbackOrigin,
): CanonicalLoopbackOrigin {
  return typeof origin === "string"
    ? canonicalizeLoopbackOrigin(origin)
    : canonicalizeLoopbackOrigin(origin.origin);
}

function validateAllowedFetchTarget(rawUrl: string, allowedOrigin: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fail("VS_FETCH_BLOCKED", "fetch.url");
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    parsed.origin !== allowedOrigin
  ) {
    fail("VS_FETCH_BLOCKED", "fetch.target", parsed.hostname);
  }
  return parsed;
}

function requestHeadersWithoutBody(headers: Headers): Headers {
  const nextHeaders = new Headers(headers);
  for (const name of [
    "content-encoding",
    "content-language",
    "content-length",
    "content-location",
    "content-type",
    "transfer-encoding",
  ]) {
    nextHeaders.delete(name);
  }
  return nextHeaders;
}

export function createGuardedFetch(options: {
  readonly allowedOrigin: string | CanonicalLoopbackOrigin;
  readonly fetchImpl?: typeof fetch;
  readonly maxRedirects?: number;
}): typeof fetch {
  const allowedOrigin = canonicalOriginFromInput(options.allowedOrigin).origin;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const maxRedirects = options.maxRedirects ?? 3;

  if (
    typeof fetchImpl !== "function" ||
    !Number.isSafeInteger(maxRedirects) ||
    maxRedirects < 0 ||
    maxRedirects > 10
  ) {
    fail("VS_FETCH_POLICY_INVALID", "fetch.policy");
  }

  return async (input, init) => {
    let initialRequest: Request;
    try {
      initialRequest = new Request(input, init);
    } catch {
      fail("VS_FETCH_BLOCKED", "fetch.request");
    }

    validateAllowedFetchTarget(initialRequest.url, allowedOrigin);

    let method = initialRequest.method;
    let headers = new Headers(initialRequest.headers);
    let body: ArrayBuffer | undefined;
    if (method !== "GET" && method !== "HEAD" && initialRequest.body) {
      try {
        body = await initialRequest.clone().arrayBuffer();
      } catch {
        fail("VS_FETCH_BLOCKED", "fetch.body-unreplayable");
      }
    }

    let currentUrl = initialRequest.url;
    const visited = new Set<string>();
    let redirectCount = 0;

    while (true) {
      const parsedTarget = validateAllowedFetchTarget(
        currentUrl,
        allowedOrigin,
      );
      const redirectIdentity = parsedTarget.href;
      if (visited.has(redirectIdentity)) {
        fail("VS_FETCH_REDIRECT", "fetch.redirect-loop");
      }
      visited.add(redirectIdentity);

      let outbound: Request;
      try {
        outbound = new Request(parsedTarget, {
          method,
          headers,
          body: method === "GET" || method === "HEAD" ? undefined : body,
          redirect: "manual",
          signal: initialRequest.signal,
        });
      } catch {
        fail("VS_FETCH_BLOCKED", "fetch.request");
      }

      let response: Response;
      try {
        response = await fetchImpl(outbound, { redirect: "manual" });
      } catch {
        fail("VS_FETCH_FAILED", "fetch.transport");
      }

      if (!REDIRECT_STATUS_CODES.has(response.status)) return response;

      const location = response.headers.get("location");
      if (!location) return response;
      if (redirectCount >= maxRedirects) {
        fail("VS_FETCH_REDIRECT", "fetch.redirect-limit");
      }

      let redirectTarget: URL;
      try {
        redirectTarget = new URL(location, parsedTarget);
      } catch {
        fail("VS_FETCH_REDIRECT", "fetch.redirect-target");
      }
      validateAllowedFetchTarget(redirectTarget.href, allowedOrigin);

      if (
        response.status === 303 ||
        ((response.status === 301 || response.status === 302) &&
          method === "POST")
      ) {
        method = "GET";
        body = undefined;
        headers = requestHeadersWithoutBody(headers);
      }

      currentUrl = redirectTarget.href;
      redirectCount += 1;
    }
  };
}

function websocketOriginFor(
  httpOrigin: CanonicalLoopbackOrigin,
): string {
  return httpOrigin.origin.replace(
    /^http(s?):/u,
    (_match, secure: string) => (secure ? "wss:" : "ws:"),
  );
}

function validateNodeWebSocketTarget(
  address: string | URL,
  allowedWebSocketOrigin: string,
): void {
  let target: URL;
  try {
    target = new URL(address);
  } catch {
    fail("VS_WEBSOCKET_BLOCKED", "websocket.url");
  }

  if (
    (target.protocol !== "ws:" && target.protocol !== "wss:") ||
    target.username ||
    target.password ||
    target.hash ||
    target.origin !== allowedWebSocketOrigin ||
    !pathUsesSupabaseService(target.pathname, "websocket")
  ) {
    fail("VS_WEBSOCKET_BLOCKED", "websocket.target", target.hostname);
  }
}

type GenericConstructor = new (...arguments_: unknown[]) => object;

export function createGuardedWebSocketConstructor(options: {
  readonly allowedOrigin: string | CanonicalLoopbackOrigin;
  readonly WebSocketImpl: WebSocketLikeConstructor;
}): WebSocketLikeConstructor {
  const allowedWebSocketOrigin = websocketOriginFor(
    canonicalOriginFromInput(options.allowedOrigin),
  );
  const Target = options.WebSocketImpl as unknown as GenericConstructor;

  return new Proxy(Target, {
    construct(target, argumentsList) {
      const address = argumentsList[0];
      if (!(typeof address === "string" || address instanceof URL)) {
        fail("VS_WEBSOCKET_BLOCKED", "websocket.url");
      }
      validateNodeWebSocketTarget(address, allowedWebSocketOrigin);
      return Reflect.construct(target, argumentsList);
    },
  }) as unknown as WebSocketLikeConstructor;
}

function comparablePath(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await fs.lstat(value);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    fail("VS_NEXT_PATH_UNPROVEN", "next-path.stat");
  }
}

export async function safeNextBuildPath(
  frontendRoot: string,
  proposedPath = path.join(frontendRoot, ".next"),
): Promise<string> {
  const lexicalRoot = path.resolve(frontendRoot);
  let realRoot: string;
  try {
    realRoot = await fs.realpath(lexicalRoot);
  } catch {
    fail("VS_NEXT_PATH_UNPROVEN", "next-path.root");
  }

  const lexicalCandidate = path.resolve(proposedPath);
  if (
    path.basename(lexicalCandidate) !== ".next" ||
    comparablePath(path.dirname(lexicalCandidate)) !==
      comparablePath(lexicalRoot)
  ) {
    fail("VS_NEXT_PATH_UNSAFE", "next-path.lexical");
  }

  const expectedRealCandidate = path.join(realRoot, ".next");
  if (!(await pathExists(lexicalCandidate))) return expectedRealCandidate;

  let candidateStat;
  let realCandidate: string;
  try {
    candidateStat = await fs.lstat(lexicalCandidate);
    if (candidateStat.isSymbolicLink()) {
      fail("VS_NEXT_PATH_UNSAFE", "next-path.reparse");
    }
    realCandidate = await fs.realpath(lexicalCandidate);
  } catch (error) {
    if (error instanceof VisualSafetyError) throw error;
    fail("VS_NEXT_PATH_UNPROVEN", "next-path.realpath");
  }

  if (
    !candidateStat.isDirectory() ||
    comparablePath(realCandidate) !== comparablePath(expectedRealCandidate) ||
    comparablePath(path.dirname(realCandidate)) !== comparablePath(realRoot)
  ) {
    fail("VS_NEXT_PATH_UNSAFE", "next-path.ownership");
  }

  return realCandidate;
}

function assertSafeIdentifier(value: string, category: string): void {
  if (
    !/^[a-zA-Z0-9._:+/-]{1,160}$/u.test(value) ||
    value.includes("://") ||
    /(?:secret|token|password|cookie|authorization|service[_-]?role|anon[_-]?key|api[_-]?key|bearer|canary)/iu.test(
      value,
    )
  ) {
    fail("VS_PROVENANCE_INVALID", category);
  }
}

function assertBuildInputIdentifier(value: string): void {
  if (
    !/^(?:assets:[0-9a-f]{64}|local-emulator-v[1-9][0-9]*|loopback-placeholder-v[1-9][0-9]*)$/u.test(
      value,
    )
  ) {
    fail("VS_PROVENANCE_INVALID", "provenance.input-id");
  }
}

function provenancePayload(
  provenance: Omit<BuildProvenance, "fingerprint">,
): string {
  return JSON.stringify({
    schemaVersion: provenance.schemaVersion,
    mode: provenance.mode,
    appOrigin: provenance.appOrigin,
    supabaseOrigin: provenance.supabaseOrigin,
    publicBuildAdapterId: provenance.publicBuildAdapterId,
    sourceGitSha: provenance.sourceGitSha,
    buildId: provenance.buildId,
    buildInputIds: [...provenance.buildInputIds],
  });
}

function calculateProvenanceFingerprint(
  provenance: Omit<BuildProvenance, "fingerprint">,
): string {
  return createHash("sha256")
    .update(provenancePayload(provenance), "utf8")
    .digest("hex");
}

export function createBuildProvenance(
  input: BuildProvenanceInput,
): BuildProvenance {
  const schemaVersion = input.schemaVersion ?? VISUAL_SAFETY_SCHEMA_VERSION;
  assertSafeIdentifier(schemaVersion, "provenance.schema");
  if (!/^tryvit-visual-safety\/v[1-9][0-9]*$/u.test(schemaVersion)) {
    fail("VS_PROVENANCE_INVALID", "provenance.schema");
  }
  if (!/^[0-9a-f]{7,64}$/u.test(input.sourceGitSha)) {
    fail("VS_PROVENANCE_INVALID", "provenance.source-sha");
  }
  assertSafeIdentifier(input.buildId, "provenance.build-id");

  const buildInputIds = [...new Set(input.buildInputIds ?? [])].sort();
  for (const identifier of buildInputIds) {
    assertBuildInputIdentifier(identifier);
  }

  const payload: Omit<BuildProvenance, "fingerprint"> = Object.freeze({
    schemaVersion,
    mode: input.contract.mode,
    appOrigin: input.contract.appOrigin,
    supabaseOrigin:
      input.contract.supabaseOrigin ??
      input.contract.publicBuildAdapter?.supabaseOrigin ??
      "none",
    publicBuildAdapterId: input.contract.publicBuildAdapter?.id ?? "none",
    sourceGitSha: input.sourceGitSha,
    buildId: input.buildId,
    buildInputIds: Object.freeze(buildInputIds),
  });
  const fingerprint = calculateProvenanceFingerprint(payload);

  return Object.freeze({ ...payload, fingerprint });
}

function fingerprintMatches(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/u.test(left) || !/^[0-9a-f]{64}$/u.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function verifyBuildProvenance(
  actual: BuildProvenance,
  expected: BuildProvenance | BuildProvenanceInput,
): void {
  let recomputedActual: string;
  let recomputedExpected: string;
  let expectedProvenance: BuildProvenance;
  try {
    const actualPayload = {
      schemaVersion: actual.schemaVersion,
      mode: actual.mode,
      appOrigin: actual.appOrigin,
      supabaseOrigin: actual.supabaseOrigin,
      publicBuildAdapterId: actual.publicBuildAdapterId,
      sourceGitSha: actual.sourceGitSha,
      buildId: actual.buildId,
      buildInputIds: actual.buildInputIds,
    } satisfies Omit<BuildProvenance, "fingerprint">;
    recomputedActual = calculateProvenanceFingerprint(actualPayload);
    expectedProvenance =
      "fingerprint" in expected ? expected : createBuildProvenance(expected);
    const expectedPayload = {
      schemaVersion: expectedProvenance.schemaVersion,
      mode: expectedProvenance.mode,
      appOrigin: expectedProvenance.appOrigin,
      supabaseOrigin: expectedProvenance.supabaseOrigin,
      publicBuildAdapterId: expectedProvenance.publicBuildAdapterId,
      sourceGitSha: expectedProvenance.sourceGitSha,
      buildId: expectedProvenance.buildId,
      buildInputIds: expectedProvenance.buildInputIds,
    } satisfies Omit<BuildProvenance, "fingerprint">;
    recomputedExpected = calculateProvenanceFingerprint(expectedPayload);
  } catch (error) {
    if (error instanceof VisualSafetyError) throw error;
    fail("VS_PROVENANCE_INVALID", "provenance.payload");
  }

  if (
    !fingerprintMatches(actual.fingerprint, recomputedActual) ||
    !fingerprintMatches(
      expectedProvenance.fingerprint,
      recomputedExpected,
    ) ||
    !fingerprintMatches(recomputedActual, recomputedExpected)
  ) {
    fail("VS_PROVENANCE_MISMATCH", "provenance.fingerprint");
  }
}

const SCANNED_ASSET_EXTENSIONS = new Set([
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

async function collectGeneratedAssetFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      fail("VS_ASSET_SCAN_FAILED", "asset-scan.read-directory");
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        fail("VS_ASSET_SCAN_FAILED", "asset-scan.reparse");
      }
      if (entry.isDirectory()) pending.push(entryPath);
      else if (
        entry.isFile() &&
        SCANNED_ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        files.push(entryPath);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function hostedOriginNeedles(origins: readonly string[]): string[] {
  const needles: string[] = [];
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      needles.push(parsed.hostname.toLowerCase());
    } catch {
      fail("VS_ASSET_SCAN_FAILED", "asset-scan.policy");
    }
  }
  return needles;
}

function sourceMapContainsOnlyReviewedSdkDocumentation(
  contents: string,
  reviewedBundledSourceDigests: ReadonlySet<string>,
): boolean {
  let parsed: { sources?: unknown; sourcesContent?: unknown };
  try {
    parsed = JSON.parse(contents) as typeof parsed;
  } catch {
    return false;
  }
  if (!Array.isArray(parsed.sources) || !Array.isArray(parsed.sourcesContent)) {
    return false;
  }
  const reviewedMatches: string[] = [];
  for (let index = 0; index < parsed.sourcesContent.length; index += 1) {
    const source = parsed.sources[index];
    const sourceContent = parsed.sourcesContent[index];
    if (typeof source !== "string" || typeof sourceContent !== "string") {
      continue;
    }
    const matches = sourceContent
      .toLowerCase()
      .match(CONCRETE_HOSTED_ORIGIN_PATTERN) ?? [];
    if (matches.length === 0) continue;
    const normalizedSource = source.toLowerCase().replaceAll("%40", "@");
    const directSupabaseSource = normalizedSource.includes(
      "node_modules/@supabase/",
    );
    const bundledTracingSource =
      /(?:^|\/)node_modules\/shared\/tracing\/dist\/(?:main|module)\/validate\.js$/u.test(
        normalizedSource,
      ) &&
      reviewedBundledSourceDigests.has(
        createHash("sha256").update(sourceContent, "utf8").digest("hex"),
      );
    if (!directSupabaseSource && !bundledTracingSource) return false;
    if (matches.some((origin) => !REVIEWED_SDK_DOCUMENTATION_ORIGINS.has(origin))) {
      return false;
    }
    reviewedMatches.push(...matches);
  }
  const rawMatches = contents.toLowerCase().match(CONCRETE_HOSTED_ORIGIN_PATTERN) ?? [];
  return (
    rawMatches.length > 0 &&
    rawMatches.sort().join("\0") === reviewedMatches.sort().join("\0")
  );
}

async function loadReviewedBundledSdkSourceDigests(
  frontendRoot: string,
): Promise<ReadonlySet<string>> {
  const digests = new Set<string>();
  for (const filename of ["index.mjs.map", "index.cjs.map"]) {
    const candidate = path.join(
      frontendRoot,
      "node_modules",
      "@supabase",
      "supabase-js",
      "dist",
      filename,
    );
    let parsed: { sources?: unknown; sourcesContent?: unknown };
    try {
      parsed = JSON.parse(await fs.readFile(candidate, "utf8")) as typeof parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      fail("VS_ASSET_SCAN_FAILED", "asset-scan.sdk-provenance");
    }
    if (!Array.isArray(parsed.sources) || !Array.isArray(parsed.sourcesContent)) {
      fail("VS_ASSET_SCAN_FAILED", "asset-scan.sdk-provenance");
    }
    for (let index = 0; index < parsed.sourcesContent.length; index += 1) {
      const source = parsed.sources[index];
      const sourceContent = parsed.sourcesContent[index];
      if (typeof source !== "string" || typeof sourceContent !== "string") {
        continue;
      }
      if (
        !/(?:^|\/)shared\/tracing\/dist\/(?:main|module)\/validate\.js$/u.test(
          source.toLowerCase(),
        )
      ) {
        continue;
      }
      const matches = sourceContent
        .toLowerCase()
        .match(CONCRETE_HOSTED_ORIGIN_PATTERN) ?? [];
      if (
        matches.length === 0 ||
        matches.some(
          (origin) => !REVIEWED_SDK_DOCUMENTATION_ORIGINS.has(origin),
        )
      ) {
        fail("VS_ASSET_SCAN_FAILED", "asset-scan.sdk-provenance");
      }
      digests.add(
        createHash("sha256").update(sourceContent, "utf8").digest("hex"),
      );
    }
  }
  return digests;
}

export async function scanGeneratedAssets(
  nextBuildPath: string,
  options: GeneratedAssetScanOptions = {},
): Promise<GeneratedAssetScanResult> {
  const verifiedNextPath = await safeNextBuildPath(
    path.dirname(nextBuildPath),
    nextBuildPath,
  );
  const assetRoots = [
    path.join(verifiedNextPath, "static"),
    path.join(verifiedNextPath, "server"),
  ];
  const forbiddenNeedles = [
    ...DEFAULT_HOSTED_PROJECT_REFERENCES,
    ...(options.knownHostedProjectReferences ?? []),
    ...hostedOriginNeedles(options.forbiddenHostedOrigins ?? []),
  ].map((value) => value.toLowerCase());
  const reviewedBundledSourceDigests =
    await loadReviewedBundledSdkSourceDigests(path.dirname(verifiedNextPath));

  let filesScanned = 0;
  let bytesScanned = 0;
  for (const assetRoot of assetRoots) {
    for (const file of await collectGeneratedAssetFiles(assetRoot)) {
      let contents: Buffer;
      try {
        contents = await fs.readFile(file);
      } catch {
        fail("VS_ASSET_SCAN_FAILED", "asset-scan.read-file");
      }
      filesScanned += 1;
      bytesScanned += contents.byteLength;
      const searchable = contents.toString("utf8").toLowerCase();
      const containsConcreteHostedOrigin =
        CONCRETE_HOSTED_ORIGIN_PATTERN.test(searchable);
      CONCRETE_HOSTED_ORIGIN_PATTERN.lastIndex = 0;
      const reviewedSdkSourceMap =
        path.extname(file).toLowerCase() === ".map" &&
        containsConcreteHostedOrigin &&
        sourceMapContainsOnlyReviewedSdkDocumentation(
          contents.toString("utf8"),
          reviewedBundledSourceDigests,
        );
      if (
        (containsConcreteHostedOrigin && !reviewedSdkSourceMap) ||
        forbiddenNeedles.some((needle) => searchable.includes(needle))
      ) {
        fail("VS_ASSET_FORBIDDEN", "asset-scan.hosted-supabase");
      }
    }
  }

  if (filesScanned === 0) {
    fail("VS_ASSET_SCAN_FAILED", "asset-scan.empty");
  }

  return Object.freeze({ filesScanned, bytesScanned });
}
