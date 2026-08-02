import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { IMAGE_POLICY_CSP_DIRECTIVES } from "./src/lib/image-policy/enforcement";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Guarded browser tests deliberately block service workers. Keep producing
  // the worker for reachability checks, but do not inject auto-registration
  // into those isolated builds.
  register: !process.env.VISUAL_SAFETY_MODE,
});

// ── Content Security Policy (#56) ───────────────────────────────────────────
// Prevents accidental image uploads and restricts network destinations.
// connect-src: Supabase (HTTPS + realtime WSS), Tesseract CDN, and Sentry ingest
// worker-src:  Tesseract WASM workers
// form-action: self only (no external form submissions)
// img-src:     self + data URIs (display) + Open Food Facts CDN
const connectSrcAllowlist = [
  IMAGE_POLICY_CSP_DIRECTIVES.connectSrc,
  // Supabase realtime websocket endpoint
  "wss://*.supabase.co",
  // Sentry global and regional ingest domains
  "https://*.ingest.sentry.io",
  "https://*.ingest.de.sentry.io",
];

// The authenticated visual-safety runner builds an isolated app against the
// ephemeral Supabase emulator. Keep this exception opt-in and loopback-only;
// public/production builds retain the hosted-only CSP contract. The origin is
// supplied by the runner after it discovers the port from supabase/config.toml;
// this config must never duplicate that port.
function localVisualSafetySupabaseOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) throw new Error("local visual-safety Supabase origin is missing");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("local visual-safety Supabase origin is invalid");
  }
  if (
    parsed.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("local visual-safety Supabase origin must be loopback HTTP");
  }
  return parsed.origin;
}

if (process.env.VISUAL_SAFETY_MODE === "local-authenticated") {
  connectSrcAllowlist.push(localVisualSafetySupabaseOrigin());
}

if (process.env.NODE_ENV === "development") {
  // Dev tooling (e.g., HMR/logging extensions) may open localhost websockets.
  connectSrcAllowlist.push("ws://127.0.0.1:*", "ws://localhost:*");
}

const cspValue = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://va.vercel-scripts.com`,
  `frame-src 'self' https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src ${IMAGE_POLICY_CSP_DIRECTIVES.imgSrc}`,
  `connect-src ${connectSrcAllowlist.join(" ")}`,
  `worker-src ${IMAGE_POLICY_CSP_DIRECTIVES.workerSrc}`,
  `form-action ${IMAGE_POLICY_CSP_DIRECTIVES.formAction}`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
].join("; ");

const nextConfig: NextConfig = {
  // Enable View Transitions API for smoother page navigations (#61)
  experimental: {
    viewTransition: true,
    // TypeScript 7 does not expose the compiler API that Next.js normally uses.
    // Delegate type checking to the TypeScript CLI instead.
    useTypeScriptCli: true,
  },
  // Allow Open Food Facts product images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.openfoodfacts.org",
        pathname: "/images/products/**",
      },
    ],
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: cspValue,
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
      {
        // Camera permissions for barcode scanner
        source: "/app/scan",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
      // ── PWA asset caching ─────────────────────────────────────────────────
      {
        // Service worker must always be revalidated
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        // Manifest — revalidate daily
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Icons — long cache (content-addressed by build hash)
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, immutable",
          },
        ],
      },
      {
        // Favicon
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, immutable",
          },
        ],
      },
    ];
  },
};

// Wrap with Serwist (PWA service worker) then Sentry (error telemetry #183)
export default withSentryConfig(withSerwist(nextConfig), {
  // Sentry build-time options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps to Sentry, then delete from build output.
  // Disable uploads when authToken is missing/empty to avoid noisy CI errors.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },

  // Suppress Sentry build output (sourcemap reference warnings are not actionable)
  silent: true,

  // Disable Sentry telemetry about its own SDK usage
  telemetry: false,

  // Tree-shake Sentry debug logging in production
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
