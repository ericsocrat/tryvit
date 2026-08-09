import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  OFFLINE_FALLBACK_PATH,
  ensureOfflineFallbackPrecache,
  getConfiguredSupabaseOrigin,
  isLegacyPrivateRuntimeEntry,
  migratePrivateRuntimeCaches,
  mustUseNetworkOnly,
  selectRuntimeCachesForMigration,
} from "./pwa-cache-policy";

const APP_ORIGIN = "https://tryvit.example";
const SUPABASE_URL = "http://127.0.0.1:54321/auth/v1";
const SUPABASE_PUBLIC_KEY = "public-anon-key";

function requestContext(
  pathnameOrUrl: string,
  options: {
    destination?: RequestDestination;
    headers?: HeadersInit;
    method?: string;
    mode?: RequestMode;
  } = {},
) {
  const url = new URL(pathnameOrUrl, APP_ORIGIN);
  return {
    request: {
      destination: options.destination ?? "",
      headers: new Headers(options.headers),
      method: options.method ?? "GET",
      mode: options.mode ?? "cors",
    },
    sameOrigin: url.origin === APP_ORIGIN,
    url,
  };
}

describe("private PWA cache policy", () => {
  it("derives an exact configured Supabase origin, including a local port", () => {
    expect(getConfiguredSupabaseOrigin(SUPABASE_URL)).toBe("http://127.0.0.1:54321");
    expect(getConfiguredSupabaseOrigin("https://project.supabase.co/")).toBe(
      "https://project.supabase.co",
    );
    expect(getConfiguredSupabaseOrigin("https://user:secret@example.com")).toBeNull();
    expect(getConfiguredSupabaseOrigin("not a URL")).toBeNull();
    expect(getConfiguredSupabaseOrigin(undefined)).toBeNull();
  });

  it.each([
    ["protected document", "/app", { mode: "navigate" as const }],
    ["protected nested document", "/app/settings", { destination: "document" as const }],
    ["admin RSC", "/app/admin/monitoring", { headers: { RSC: "1" } }],
    ["protected RSC prefetch", "/app/search", { headers: { "Next-Router-Prefetch": "1" } }],
    ["protected state-tree fetch", "/app/lists", { headers: { "Next-Router-State-Tree": "tree" } }],
    ["unknown route", "/future-private", { destination: "document" as const }],
    ["near-match route", "/learned", { destination: "document" as const }],
    ["auth recovery", "/auth/update-password", { destination: "document" as const }],
    ["auth callback", "/auth/callback?code=private", { mode: "navigate" as const }],
    ["login redirect contract", "/auth/login", { destination: "document" as const }],
    ["signup redirect contract", "/auth/signup", { headers: { RSC: "1" } }],
  ])("sends %s through NetworkOnly", (_label, path, options) => {
    expect(mustUseNetworkOnly(requestContext(path, options), SUPABASE_URL)).toBe(true);
  });

  it.each([
    ["landing", "/"],
    ["learn", "/learn/allergens"],
    ["offline fallback", "/offline"],
    ["forgot-password form", "/auth/forgot-password"],
  ])("keeps the public %s document eligible for existing caching", (_label, path) => {
    expect(
      mustUseNetworkOnly(requestContext(path, { destination: "document" }), SUPABASE_URL),
    ).toBe(false);
  });

  it.each([
    ["shared-list document", "/lists/shared/public-token", { destination: "document" as const }],
    ["shared-comparison RSC", "/compare/shared/public-token", { headers: { RSC: "1" } }],
    [
      "shared-list Open Graph image",
      "/lists/shared/public-token/opengraph-image",
      { destination: "image" as const },
    ],
    [
      "shared-comparison Open Graph image",
      "/compare/shared/public-token/opengraph-image",
      { destination: "image" as const },
    ],
  ])("keeps token-gated %s out of runtime cache", (_label, path, options) => {
    expect(mustUseNetworkOnly(requestContext(path, options), SUPABASE_URL)).toBe(true);
  });

  it("keeps public static assets and unrelated cross-origin requests eligible", () => {
    expect(
      mustUseNetworkOnly(
        requestContext("/_next/static/chunks/app.js", { destination: "script" }),
        SUPABASE_URL,
      ),
    ).toBe(false);
    expect(
      mustUseNetworkOnly(
        requestContext("https://images.openfoodfacts.org/image.jpg", {
          destination: "image",
        }),
        SUPABASE_URL,
      ),
    ).toBe(false);
  });

  it("sends every same-origin API GET through NetworkOnly", () => {
    expect(mustUseNetworkOnly(requestContext("/api/flags"), SUPABASE_URL)).toBe(true);
    expect(mustUseNetworkOnly(requestContext("/api/health"), SUPABASE_URL)).toBe(true);
  });

  it.each([
    "/auth/v1/user",
    "/rest/v1/user_preferences?select=*",
    "/rest/v1/rpc/api_get_product_profile?id=1",
    "/graphql/v1",
    "/functions/v1/private-function",
    "/storage/v1/object/private/user/photo.jpg",
  ])("sends configured Supabase GET %s through NetworkOnly", (path) => {
    expect(mustUseNetworkOnly(requestContext(`http://127.0.0.1:54321${path}`), SUPABASE_URL)).toBe(
      true,
    );
  });

  it("keeps only reviewed anonymous public Storage objects cache-eligible", () => {
    const publicObject = "http://127.0.0.1:54321/storage/v1/object/public/product-photos/photo.jpg";

    expect(
      mustUseNetworkOnly(requestContext(publicObject), SUPABASE_URL, SUPABASE_PUBLIC_KEY),
    ).toBe(false);
    expect(
      mustUseNetworkOnly(
        requestContext(publicObject, {
          headers: {
            apikey: SUPABASE_PUBLIC_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`,
          },
        }),
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY,
      ),
    ).toBe(false);
    expect(
      mustUseNetworkOnly(
        requestContext(publicObject, { headers: { apikey: SUPABASE_PUBLIC_KEY } }),
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY,
      ),
    ).toBe(false);
    expect(
      mustUseNetworkOnly(
        requestContext(publicObject, {
          headers: { Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}` },
        }),
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY,
      ),
    ).toBe(false);
    expect(
      mustUseNetworkOnly(
        requestContext(publicObject, {
          headers: {
            apikey: SUPABASE_PUBLIC_KEY,
            Authorization: "Bearer user-session-jwt",
          },
        }),
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY,
      ),
    ).toBe(true);
    expect(
      mustUseNetworkOnly(
        requestContext(publicObject, {
          headers: { apikey: "unexpected-public-key" },
        }),
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY,
      ),
    ).toBe(true);
    expect(
      mustUseNetworkOnly(
        requestContext(publicObject, {
          headers: { Authorization: `bearer ${SUPABASE_PUBLIC_KEY}` },
        }),
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY,
      ),
    ).toBe(true);
    expect(
      mustUseNetworkOnly(
        requestContext(publicObject, { headers: { apikey: SUPABASE_PUBLIC_KEY } }),
        SUPABASE_URL,
      ),
    ).toBe(true);
    expect(
      mustUseNetworkOnly(
        requestContext(`${publicObject}?token=signed-value`),
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY,
      ),
    ).toBe(true);
    expect(
      mustUseNetworkOnly(
        requestContext(`${publicObject}?signature=signed-value`),
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY,
      ),
    ).toBe(true);
    expect(
      mustUseNetworkOnly(
        requestContext(
          "http://127.0.0.1:54321/storage/v1/object/publicity/product-photos/photo.jpg",
        ),
        SUPABASE_URL,
        SUPABASE_PUBLIC_KEY,
      ),
    ).toBe(true);
  });

  it("uses known Supabase namespaces only as a deny rule", () => {
    expect(
      mustUseNetworkOnly(requestContext("https://attacker.example/auth/v1/user"), SUPABASE_URL),
    ).toBe(true);
    expect(
      mustUseNetworkOnly(requestContext("http://127.0.0.1:54322/auth/v1/user"), SUPABASE_URL),
    ).toBe(true);
    expect(
      mustUseNetworkOnly(
        requestContext("https://attacker.example/authentication/v1/user"),
        SUPABASE_URL,
      ),
    ).toBe(false);
  });

  it("fails closed for known namespaces when configuration is absent or invalid", () => {
    const authRequest = requestContext("https://project.supabase.co/auth/v1/user");
    expect(mustUseNetworkOnly(authRequest, undefined)).toBe(true);
    expect(mustUseNetworkOnly(authRequest, "not a URL")).toBe(true);
    expect(
      mustUseNetworkOnly(
        requestContext("https://project.supabase.co/storage/v1/object/public/products/photo.jpg"),
        undefined,
        SUPABASE_PUBLIC_KEY,
      ),
    ).toBe(true);
    expect(
      mustUseNetworkOnly(
        requestContext("https://project.supabase.co/unrelated-public.txt"),
        undefined,
      ),
    ).toBe(false);

    // Same-origin application policy continues to fail closed independently.
    expect(mustUseNetworkOnly(requestContext("/api/flags"), undefined)).toBe(true);
  });

  it("does not disable public app caching when Supabase shares the app origin", () => {
    expect(mustUseNetworkOnly(requestContext("/", { destination: "document" }), APP_ORIGIN)).toBe(
      false,
    );
    expect(
      mustUseNetworkOnly(
        requestContext("/_next/static/chunks/app.js", { destination: "script" }),
        APP_ORIGIN,
      ),
    ).toBe(false);
    expect(mustUseNetworkOnly(requestContext("/auth/v1/user"), APP_ORIGIN)).toBe(true);
  });

  it("does not claim to cache POST RPCs or server actions", () => {
    expect(
      mustUseNetworkOnly(
        requestContext("http://127.0.0.1:54321/rest/v1/rpc/api_search_products", {
          method: "POST",
        }),
        SUPABASE_URL,
      ),
    ).toBe(false);
    expect(mustUseNetworkOnly(requestContext("/app", { method: "POST" }), SUPABASE_URL)).toBe(
      false,
    );
  });
});

describe("PWA cache lifecycle", () => {
  it("adds the offline fallback exactly once with a build-derived revision", () => {
    const first = ensureOfflineFallbackPrecache([
      { url: "/_next/static/chunks/app-a.js", revision: null },
    ]);
    const second = ensureOfflineFallbackPrecache([
      { url: "/_next/static/chunks/app-b.js", revision: null },
    ]);

    const firstOffline = first.find(
      (entry) => typeof entry !== "string" && entry.url === OFFLINE_FALLBACK_PATH,
    );
    const secondOffline = second.find(
      (entry) => typeof entry !== "string" && entry.url === OFFLINE_FALLBACK_PATH,
    );

    expect(firstOffline).toMatchObject({ url: OFFLINE_FALLBACK_PATH });
    expect(firstOffline?.revision).toMatch(/^build-[a-f0-9]{8}$/u);
    expect(secondOffline?.revision).not.toBe(firstOffline?.revision);
    expect(ensureOfflineFallbackPrecache(first)).toEqual(first);
  });

  it("derives the same offline revision from every manifest permutation", () => {
    const manifest = [
      "/_next/static/chunks/café.js",
      { url: "/_next/static/chunks/cafe\u0301.js", revision: "decomposed" },
      { url: "/_next/static/chunks/app.js", revision: null },
    ] as const;
    const permutations = [
      manifest,
      [...manifest].reverse(),
      [manifest[1], manifest[2], manifest[0]],
    ];

    const revisions = permutations.map((entries) => {
      const offline = ensureOfflineFallbackPrecache(entries).find(
        (entry) => typeof entry !== "string" && entry.url === OFFLINE_FALLBACK_PATH,
      );
      return offline && typeof offline !== "string" ? offline.revision : undefined;
    });

    expect(new Set(revisions)).toEqual(new Set([revisions[0]]));
    expect(revisions[0]).toMatch(/^build-[a-f0-9]{8}$/u);
  });

  it("purges only legacy private or obsolete TryVit runtime caches", () => {
    expect(
      selectRuntimeCachesForMigration(
        [
          "apis",
          "cross-origin",
          "next-data",
          "others",
          "pages",
          "pages-rsc",
          "pages-rsc-prefetch",
          "product-api-v3",
          "product-api-v2",
          "product-images-v2",
          "product-images-v3",
          "static-data-assets",
          "serwist-precache-v2-scope",
          "static-js-assets",
          "unrelated-cache-v3",
        ],
        "v3",
      ),
    ).toEqual([
      "apis",
      "cross-origin",
      "next-data",
      "others",
      "pages",
      "pages-rsc",
      "pages-rsc-prefetch",
      "product-api-v3",
      "product-api-v2",
      "product-images-v2",
      "static-data-assets",
    ]);
  });

  it("recognizes private legacy entries without trusting a pathname to grant access", () => {
    expect(
      isLegacyPrivateRuntimeEntry(
        "https://project.supabase.co/custom-private-get",
        "https://project.supabase.co",
        APP_ORIGIN,
      ),
    ).toBe(true);
    expect(
      isLegacyPrivateRuntimeEntry(
        "https://old-project.example/auth/v1/user",
        undefined,
        APP_ORIGIN,
      ),
    ).toBe(true);
    expect(
      isLegacyPrivateRuntimeEntry(
        "https://images.openfoodfacts.org/image.jpg",
        "https://project.supabase.co",
        APP_ORIGIN,
      ),
    ).toBe(false);
  });

  it("deletes mixed private caches and scrubs retained caches by request key", async () => {
    const entries = new Map<string, string[]>([
      ["pages", [`${APP_ORIGIN}/app`]],
      [
        "static-image-assets",
        [
          `${APP_ORIGIN}/public-image.jpg`,
          "https://project.supabase.co/storage/v1/object/private/user.jpg",
          "https://old-project.example/auth/v1/user",
        ],
      ],
      ["product-images-v3", ["https://images.openfoodfacts.org/image.jpg"]],
      ["serwist-precache-v2-scope", [`${APP_ORIGIN}/offline`]],
    ]);
    const wholeCacheDeletes: string[] = [];
    const entryDeletes: string[] = [];
    const cacheStorage = {
      async delete(name: string) {
        wholeCacheDeletes.push(name);
        return entries.delete(name);
      },
      async keys() {
        return [...entries.keys()];
      },
      async open(name: string) {
        return {
          async delete(request: Request) {
            entryDeletes.push(request.url);
            const urls = entries.get(name) ?? [];
            entries.set(
              name,
              urls.filter((url) => url !== request.url),
            );
            return true;
          },
          async keys() {
            return (entries.get(name) ?? []).map((url) => new Request(url));
          },
        } as Cache;
      },
    } satisfies Pick<CacheStorage, "delete" | "keys" | "open">;

    await migratePrivateRuntimeCaches(
      cacheStorage,
      "v3",
      "https://project.supabase.co",
      APP_ORIGIN,
    );

    expect(wholeCacheDeletes).toEqual(["pages"]);
    expect(entryDeletes).toEqual([
      "https://project.supabase.co/storage/v1/object/private/user.jpg",
      "https://old-project.example/auth/v1/user",
    ]);
    expect(entries.get("static-image-assets")).toEqual([`${APP_ORIGIN}/public-image.jpg`]);
    expect(entries.get("product-images-v3")).toEqual([
      "https://images.openfoodfacts.org/image.jpg",
    ]);
    expect(entries.get("serwist-precache-v2-scope")).toEqual([`${APP_ORIGIN}/offline`]);
  });

  it("keeps the private NetworkOnly rule ahead of public and generic caches", () => {
    const workerSource = readFileSync(join(process.cwd(), "src/app/sw.ts"), "utf8");
    const runtimeStart = workerSource.indexOf("runtimeCaching:");
    const privateRule = workerSource.indexOf("mustUseNetworkOnly(", runtimeStart);
    const publicImageRule = workerSource.indexOf(
      'url.hostname === "images.openfoodfacts.org"',
      runtimeStart,
    );
    const defaultRules = workerSource.indexOf("...defaultCache", runtimeStart);

    expect(runtimeStart).toBeGreaterThan(-1);
    expect(privateRule).toBeGreaterThan(runtimeStart);
    expect(privateRule).toBeLessThan(publicImageRule);
    expect(publicImageRule).toBeLessThan(defaultRules);
    expect(workerSource).toContain("new NetworkOnly()");
    expect(workerSource).not.toContain("new NetworkFirst(");
    expect(workerSource).not.toContain('!name.includes("v3")');
  });
});
