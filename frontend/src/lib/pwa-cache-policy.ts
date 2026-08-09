import type { PrecacheEntry } from "serwist";

import { ROUTE_CLASS, getRoutePolicy } from "./route-policy";

export const OFFLINE_FALLBACK_PATH = "/offline";

/**
 * Runtime caches that may contain responses whose cache keys predate the
 * private-response policy. These exact names come from Serwist's checked-in
 * default cache contract and TryVit's former product-RPC cache.
 */
export const PRIVATE_LEGACY_RUNTIME_CACHE_NAMES = new Set([
  "apis",
  "cross-origin",
  "next-data",
  "others",
  "pages",
  "pages-rsc",
  "pages-rsc-prefetch",
  "product-api-v3",
  "static-data-assets",
]);

type CachePolicyRequest = Pick<Request, "destination" | "headers" | "method" | "mode">;

export interface CachePolicyMatchContext {
  readonly request: CachePolicyRequest;
  readonly sameOrigin: boolean;
  readonly url: URL;
}

const PRIVATE_SUPABASE_NAMESPACE =
  /^\/(?:auth|functions|graphql|realtime|rest|storage)\/v1(?:\/|$)/u;

const TOKEN_GATED_METADATA_ROUTE_IDS = new Set([
  "public-shared-comparison-metadata",
  "public-shared-list-metadata",
]);

function isHttpOrigin(url: URL): boolean {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.username === "" &&
    url.password === ""
  );
}

/** Returns one exact configured origin, including a non-default local port. */
export function getConfiguredSupabaseOrigin(configuredUrl: string | undefined): string | null {
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    return isHttpOrigin(url) ? url.origin : null;
  } catch {
    return null;
  }
}

function isAppRouterPageDataRequest(request: CachePolicyRequest): boolean {
  return (
    request.mode === "navigate" ||
    request.destination === "document" ||
    request.destination === "" ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    request.headers.has("Next-Router-State-Tree")
  );
}

export function isSupabaseApiNamespace(pathname: string): boolean {
  return PRIVATE_SUPABASE_NAMESPACE.test(pathname);
}

function bearerCredential(headers: Headers): string | null {
  const authorization = headers.get("Authorization");
  if (!authorization) return null;
  const match = /^Bearer ([^\s]+)$/u.exec(authorization);
  return match?.[1] ?? "";
}

function isReviewedPublicStorageRequest(
  context: CachePolicyMatchContext,
  configuredPublicKey: string | undefined,
): boolean {
  const { request, url } = context;
  if (!url.pathname.startsWith("/storage/v1/object/public/")) return false;
  if (url.searchParams.has("token") || url.searchParams.has("signature")) {
    return false;
  }

  const apiKey = request.headers.get("apikey");
  const bearer = bearerCredential(request.headers);
  if (apiKey === null && bearer === null) return true;
  if (!configuredPublicKey) return false;

  return (
    (apiKey === null || apiKey === configuredPublicKey) &&
    (bearer === null || bearer === configuredPublicKey)
  );
}

/**
 * Fail-closed matcher for request classes that must never reach a runtime
 * cache. Serwist evaluates runtime routes in order, so this matcher belongs
 * before every CacheFirst/NetworkFirst/default rule.
 */
export function mustUseNetworkOnly(
  context: CachePolicyMatchContext,
  configuredSupabaseUrl: string | undefined,
  configuredPublicKey?: string,
): boolean {
  const { request, sameOrigin, url } = context;
  if (request.method !== "GET") return false;

  const supabaseOrigin = getConfiguredSupabaseOrigin(configuredSupabaseUrl);
  if (
    supabaseOrigin === url.origin &&
    isReviewedPublicStorageRequest(context, configuredPublicKey)
  ) {
    return false;
  }

  // This is deny-only: a recognizable private API namespace never becomes
  // cache-authorized just because configuration is missing, stale, or invalid.
  if (isSupabaseApiNamespace(url.pathname)) return true;

  if (supabaseOrigin && !sameOrigin && url.origin === supabaseOrigin) {
    // Auth, PostgREST, GraphQL, Functions, and non-public Storage responses
    // can all be session-bound. No current browser GET on this origin has a
    // reviewed user-independent offline-cache contract.
    return true;
  }

  if (!sameOrigin) return false;

  const route = getRoutePolicy(url.pathname);
  if (route.routeClass === ROUTE_CLASS.api) {
    // `/api/flags` is user-contextual and `/api/health` must remain live.
    // Future same-origin APIs fail closed until individually reviewed.
    return true;
  }

  if (
    route.routeClass === ROUTE_CLASS.publicShare ||
    TOKEN_GATED_METADATA_ROUTE_IDS.has(route.id)
  ) {
    // Share tokens are anonymous credentials, not immutable public assets.
    // Revocation must take effect online and old content must not replay.
    return true;
  }

  if (!isAppRouterPageDataRequest(request)) return false;

  return (
    route.authenticationLookup !== "never" ||
    route.routeClass === ROUTE_CLASS.authCallback ||
    route.routeClass === ROUTE_CLASS.authRecovery
  );
}

function manifestEntryIdentity(entry: PrecacheEntry | string): string {
  if (typeof entry === "string") return entry;
  return `${entry.url}:${entry.revision ?? ""}`;
}

function fingerprintManifest(entries: readonly (PrecacheEntry | string)[]): string {
  // A compact deterministic FNV-1a fingerprint avoids a constant revision and
  // changes whenever the injected build asset manifest changes.
  let fingerprint = 0x811c9dc5;
  for (const character of entries.map(manifestEntryIdentity).sort().join("\n")) {
    fingerprint ^= character.charCodeAt(0);
    fingerprint = Math.imul(fingerprint, 0x01000193) >>> 0;
  }
  return fingerprint.toString(16).padStart(8, "0");
}

/** Guarantees that Serwist's document fallback is actually precached. */
export function ensureOfflineFallbackPrecache(
  entries: readonly (PrecacheEntry | string)[],
): (PrecacheEntry | string)[] {
  if (
    entries.some((entry) =>
      typeof entry === "string"
        ? entry === OFFLINE_FALLBACK_PATH
        : entry.url === OFFLINE_FALLBACK_PATH,
    )
  ) {
    return [...entries];
  }

  return [
    ...entries,
    {
      url: OFFLINE_FALLBACK_PATH,
      revision: `build-${fingerprintManifest(entries)}`,
    },
  ];
}

/**
 * Select only known private or obsolete TryVit runtime caches. The current
 * precache, Serwist static caches, unrelated CacheStorage, and the current
 * public product-image cache deliberately survive.
 */
export function selectRuntimeCachesForMigration(
  cacheNames: readonly string[],
  currentCacheVersion: string,
): string[] {
  const currentImageCache = `product-images-${currentCacheVersion}`;

  return cacheNames.filter(
    (name) =>
      PRIVATE_LEGACY_RUNTIME_CACHE_NAMES.has(name) ||
      name.startsWith("product-api-") ||
      (name.startsWith("product-images-") && name !== currentImageCache),
  );
}

export function isLegacyPrivateRuntimeEntry(
  rawUrl: string,
  configuredSupabaseUrl: string | undefined,
  appOrigin: string,
): boolean {
  try {
    const url = new URL(rawUrl);
    if (isSupabaseApiNamespace(url.pathname)) return true;

    const configuredOrigin = getConfiguredSupabaseOrigin(configuredSupabaseUrl);
    return (
      configuredOrigin !== null && configuredOrigin !== appOrigin && url.origin === configuredOrigin
    );
  } catch {
    return false;
  }
}

/**
 * Deletes known mixed private caches and scrubs private entries from retained
 * type-specific caches. This preserves unrelated entries and current public
 * image/precache data while removing legacy Supabase objects by key.
 */
export async function migratePrivateRuntimeCaches(
  cacheStorage: Pick<CacheStorage, "delete" | "keys" | "open">,
  currentCacheVersion: string,
  configuredSupabaseUrl: string | undefined,
  appOrigin: string,
): Promise<void> {
  const names = await cacheStorage.keys();
  const deleteWhole = new Set(selectRuntimeCachesForMigration(names, currentCacheVersion));

  await Promise.all(
    names.map(async (name) => {
      if (deleteWhole.has(name)) {
        await cacheStorage.delete(name);
        return;
      }

      const cache = await cacheStorage.open(name);
      const keys = await cache.keys();
      await Promise.all(
        keys
          .filter((request) =>
            isLegacyPrivateRuntimeEntry(request.url, configuredSupabaseUrl, appOrigin),
          )
          .map((request) => cache.delete(request)),
      );
    }),
  );
}
