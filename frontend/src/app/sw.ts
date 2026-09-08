/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import {
  CacheFirst,
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";

import {
  OFFLINE_FALLBACK_PATH,
  ensureOfflineFallbackPrecache,
  migratePrivateRuntimeCaches,
  mustUseNetworkOnly,
} from "@/lib/pwa-cache-policy";

// This declares the service worker's global scope
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// ─── Cache version ──────────────────────────────────────────────────────────
// Bump this whenever a new deployment must invalidate all runtime caches
// (e.g. layout / viewport fixes that are invisible to precache hashing).
const CACHE_VERSION = "v3";

// ─── Private-response exclusion and public image caching ────────────────────
const privateResponseNetworkOnly = new NetworkOnly();

const imageCache = new CacheFirst({
  cacheName: `product-images-${CACHE_VERSION}`,
  matchOptions: { ignoreSearch: true },
});

const serwist = new Serwist({
  precacheEntries: ensureOfflineFallbackPrecache(self.__SW_MANIFEST ?? []),
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // This rule must remain first. Generic Serwist page/API/cross-origin rules
    // key responses by URL and must never see private request classes.
    {
      matcher: (context) =>
        mustUseNetworkOnly(
          context,
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        ),
      handler: privateResponseNetworkOnly,
    },
    // Cache-first for product images from Open Food Facts
    {
      matcher: ({ url }) =>
        url.hostname === "images.openfoodfacts.org" || url.hostname.endsWith(".openfoodfacts.org"),
      handler: imageCache,
    },
    // Default caching for everything else
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: OFFLINE_FALLBACK_PATH,
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Unsupported score-change payloads are ignored; do not read or display old claims.
self.addEventListener("push", () => {});
// A previously displayed notification may survive deployment. Never trust its URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/app/settings/notifications"));
});
// Intentionally do not renew or broadcast retired push subscriptions.

// ─── Purge legacy private-bearing runtime caches on activate ────────────────
// The former broad cleanup removed the live precache and still did not express
// a privacy boundary. Delete only known private-bearing/obsolete cache names;
// public static assets, the current image cache, and unrelated storage survive.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    migratePrivateRuntimeCaches(
      caches,
      CACHE_VERSION,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      self.location.origin,
    ),
  );
});
