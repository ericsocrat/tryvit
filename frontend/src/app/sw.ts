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

// ─── Push notification handler ──────────────────────────────────────────────
// Receives push messages from the server (via Web Push API) and shows
// native notifications. Payload shape: { title, body, icon, badge, url, data }
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title ?? "Score Changed";
    const options: NotificationOptions = {
      body: data.body ?? "",
      icon: data.icon ?? "/icons/icon-192x192.png",
      badge: data.badge ?? "/icons/badge-72x72.png",
      tag: `score-change-${data.data?.product_id ?? "unknown"}`,
      data: { url: data.url ?? "/app/watchlist" },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Push event parse error:", err);
  }
});

// ─── Notification click handler ─────────────────────────────────────────────
// Opens the product detail page when a push notification is tapped/clicked.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? "/app/watchlist";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one matches
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow(url);
    }),
  );
});

// ─── Push subscription change handler ───────────────────────────────────────
// Re-subscribes if the browser changes the push subscription.
self.addEventListener("pushsubscriptionchange", ((event: Event) => {
  const pushEvent = event as Event & {
    oldSubscription?: PushSubscription;
    newSubscription?: PushSubscription;
    waitUntil: (promise: Promise<unknown>) => void;
  };

  pushEvent.waitUntil(
    (async () => {
      // If the browser provides a new subscription, post it to the main thread
      // so the app can save it to the backend.
      if (pushEvent.newSubscription) {
        const allClients = await self.clients.matchAll({ type: "window" });
        for (const client of allClients) {
          client.postMessage({
            type: "PUSH_SUBSCRIPTION_CHANGED",
            subscription: pushEvent.newSubscription.toJSON(),
          });
        }
      }
    })(),
  );
}) as EventListener);

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
