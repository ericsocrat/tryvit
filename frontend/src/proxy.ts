// ─── Proxy: auth enforcement + rate limiting ─────────────────────────────────
// Renamed from `middleware.ts` in Next.js 16 (the `middleware.ts` filename and
// `middleware` function name were deprecated; `proxy.ts` + `proxy` is the new
// convention). Behavior is identical to the prior middleware.
//
// Auth: checks if user is logged in. Does NOT check onboarding_complete.
//       Onboarding redirect happens in /app/layout.tsx (server component).
//       Public routes: /, /contact, /privacy, /terms, /auth/*
//       Everything else requires a valid session.
//
// Rate limiting (#182): applied to /api/* routes via @upstash/ratelimit.
//       5 tiers: standard (60/min), auth (10/min), search (30/min),
//       health (120/min), authenticated (120/min). Sliding window.

import {
  extractUserIdFromJWT,
  getLimiter,
  rateLimitEnabled,
  resolveRateLimitTier,
} from "@/lib/rate-limiter";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import {
  APPLICATION_PROVIDER_BOUNDARY,
  LANDING_PROVIDER_BOUNDARY,
  PROVIDER_BOUNDARY_REQUEST_HEADER,
} from "@/lib/request-provider-boundary";
import { ROUTE_CLASS, getRoutePolicy } from "@/lib/route-policy";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

// ─── Auth Helpers ───────────────────────────────────────────────────────────

function isAdminUser(email: string | undefined): boolean {
  const allowlist = process.env.ADMIN_EMAILS;
  if (!allowlist || !email) return false;
  const emails = allowlist.split(",").map((e) => e.trim().toLowerCase());
  return emails.includes(email.toLowerCase());
}

// ─── Rate Limit Helpers ─────────────────────────────────────────────────────

function isBypassToken(request: NextRequest): boolean {
  const bypassToken = process.env.RATE_LIMIT_BYPASS_TOKEN;
  if (!bypassToken) return false;
  return request.headers.get("x-rate-limit-bypass") === bypassToken;
}

function resolveClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

/**
 * Apply rate limiting to a request. Returns a 429 NextResponse if the limit
 * is exceeded, otherwise adds X-RateLimit-* headers to the pass-through
 * response and returns it.
 */
async function applyRateLimit(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  // Rate limiting disabled (no Redis) or bypass token present
  if (!rateLimitEnabled || isBypassToken(request)) return response;

  const { pathname } = request.nextUrl;
  const baseTier = resolveRateLimitTier(pathname);

  // Resolve identifier: authenticated users keyed by user ID, anon by IP
  const authHeader = request.headers.get("authorization");
  const userId = extractUserIdFromJWT(authHeader);
  const identifier = userId ?? resolveClientIp(request);

  // Promote standard → authenticated when a valid JWT is present
  const effectiveTier = userId && baseTier === "standard" ? "authenticated" : baseTier;
  const limiter = getLimiter(effectiveTier);

  // Limiter is null when Redis is not configured (shouldn't happen if
  // rateLimitEnabled is true, but guard defensively)
  if (!limiter) return response;

  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  const rlHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(reset),
  };

  if (!success) {
    const retryAfter = Math.max(Math.ceil((reset - Date.now()) / 1000), 1);
    const body = {
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${retryAfter}s.`,
      tier: effectiveTier,
    };

    return NextResponse.json(body, {
      status: 429,
      headers: {
        ...rlHeaders,
        "Retry-After": String(retryAfter),
        "x-request-id": response.headers.get("x-request-id") ?? "",
      },
    });
  }

  // Attach rate-limit headers to the pass-through response
  for (const [key, value] of Object.entries(rlHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

// ─── Main Proxy ──────────────────────────────────────────────────────────────

function isColdLandingDocumentRequest(request: NextRequest): boolean {
  if (request.method !== "GET" || request.nextUrl.pathname !== "/" || request.nextUrl.search) {
    return false;
  }

  return ![
    request.headers.get("rsc") === "1",
    request.headers.has("next-router-state-tree"),
    request.headers.get("next-router-prefetch") === "1",
    request.headers.get("x-middleware-prefetch") === "1",
    request.headers.get("purpose")?.toLowerCase() === "prefetch",
  ].some(Boolean);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    PROVIDER_BOUNDARY_REQUEST_HEADER,
    isColdLandingDocumentRequest(request)
      ? LANDING_PROVIDER_BOUNDARY
      : APPLICATION_PROVIDER_BOUNDARY,
  );
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // ── Request ID correlation (#183) ─────────────────────────────────────────
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  response.headers.set("x-request-id", requestId);

  const routePolicy = getRoutePolicy(pathname);

  // ── API routes: rate limiting only (no auth enforcement) ──────────────────
  if (routePolicy.routeClass === ROUTE_CLASS.api) {
    return applyRateLimit(request, response);
  }

  // ── Backend-independent routes: no Supabase client or lookup ──────────────
  // Public pages, shared views, metadata, recovery, and callback routes must
  // remain reachable while the backend is paused. Auth login/signup are the
  // only public routes allowed to look up a user for their documented redirect.
  if (routePolicy.authenticationLookup === "never") {
    return response;
  }

  // Demo/paused deployments intentionally have no browser Supabase
  // configuration. Auth-entry pages must still render, while every protected
  // route remains fail-closed without attempting client construction.
  if (getDeploymentReadiness().dataBackend === "unavailable") {
    if (routePolicy.requiresAnonymousAccess) {
      return response;
    }

    const loginUrl = new URL("/auth/login", request.url);
    const redirectTo = request.nextUrl.pathname + request.nextUrl.search;
    loginUrl.searchParams.set("redirect", redirectTo);
    return NextResponse.redirect(loginUrl);
  }

  // ── Authenticated routes and signed-in auth entries ───────────────────────
  const supabase = createMiddlewareClient(request, response);

  // Refresh session token (important for @supabase/ssr)
  // Wrap in try/catch so pages still load when Supabase is unreachable
  // (e.g. paused free-tier project, CI without a real instance).
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unreachable — treat as unauthenticated
  }

  if (routePolicy.allowsSignedInRedirect && user) {
    return NextResponse.redirect(new URL("/app/search", request.url));
  }

  // Auth-entry routes are public to signed-out visitors.
  if (routePolicy.requiresAnonymousAccess) {
    return response;
  }

  // Protected routes require auth
  if (!user) {
    const loginUrl = new URL("/auth/login", request.url);
    // Preserve full path + querystring so login can redirect back
    const redirectTo = request.nextUrl.pathname + request.nextUrl.search;
    loginUrl.searchParams.set("redirect", redirectTo);
    return NextResponse.redirect(loginUrl);
  }

  // ── Admin routes: require admin email allowlist (#186, #579) ────────────────
  if (routePolicy.routeClass === ROUTE_CLASS.protectedAdmin && !isAdminUser(user.email)) {
    const forbiddenUrl = new URL("/forbidden", request.url);
    return NextResponse.redirect(forbiddenUrl, { status: 303 });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static assets (includes /api for rate limiting)

    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
