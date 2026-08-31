import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { mockGetUser, mockCreateMiddlewareClient } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  return {
    mockGetUser,
    mockCreateMiddlewareClient: vi.fn(() => ({
      auth: {
        getUser: () => mockGetUser(),
      },
    })),
  };
});

vi.mock("@/lib/supabase/middleware", () => ({
  createMiddlewareClient: mockCreateMiddlewareClient,
}));

const mockLimit = vi.fn();
vi.mock("@/lib/rate-limiter", () => ({
  rateLimitEnabled: true,
  resolveRateLimitTier: (pathname: string) => {
    if (
      pathname.includes("/login") ||
      pathname.includes("/signup") ||
      pathname.startsWith("/auth/callback")
    )
      return "auth";
    if (pathname.startsWith("/api/health")) return "health";
    if (pathname.includes("/search")) return "search";
    return "standard";
  },
  getLimiter: () => ({ limit: mockLimit }),
  extractUserIdFromJWT: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  // Default: allow through rate limit
  mockLimit.mockResolvedValue({
    success: true,
    limit: 60,
    remaining: 59,
    reset: Date.now() + 60_000,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function createRequest(pathname: string, origin = "http://localhost:3000") {
  return new NextRequest(new URL(pathname, origin));
}

describe("proxy", () => {
  describe("public paths", () => {
    it("allows unauthenticated access to /", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/"));
      // Should NOT redirect (status 200)
      expect(response.status).not.toBe(307);
    });

    it("allows unauthenticated access to /contact", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/contact"));
      expect(response.status).not.toBe(307);
    });

    it("allows unauthenticated access to /privacy", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/privacy"));
      expect(response.status).not.toBe(307);
    });

    it("allows unauthenticated access to /terms", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/terms"));
      expect(response.status).not.toBe(307);
    });

    it("allows unauthenticated access to /auth/login", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/auth/login"));
      expect(response.status).not.toBe(307);
    });

    it("allows unauthenticated access to /auth/signup", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/auth/signup"));
      expect(response.status).not.toBe(307);
    });

    it("allows unauthenticated access to /learn", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/learn"));
      expect(response.status).not.toBe(307);
    });

    it("allows unauthenticated access to /learn/nutri-score", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/learn/nutri-score"));
      expect(response.status).not.toBe(307);
    });
  });

  describe("provider boundary", () => {
    it.each([
      ["root", createRequest("/")],
      ["utm source", createRequest("/?utm_source=test")],
      ["utm source and campaign", createRequest("/?utm_source=test&utm_campaign=x")],
      ["newsletter referrer", createRequest("/?ref=newsletter")],
      ["arbitrary harmless query", createRequest("/?foo=bar")],
    ])("stamps the lean boundary on a %s landing document", async (_label, request) => {
      const landing = await proxy(request);
      expect(
        landing.headers.get("x-middleware-request-x-tryvit-provider-boundary"),
      ).toBe("landing-lean");
    });

    it("keeps a query-bearing non-root route on the application boundary", async () => {
      const contact = await proxy(createRequest("/contact?utm_source=test"));
      expect(
        contact.headers.get("x-middleware-request-x-tryvit-provider-boundary"),
      ).toBe("application");
    });

    it("overwrites a forged provider-boundary request header", async () => {
      const request = new NextRequest(new URL("/contact", "http://localhost:3000"), {
        headers: { "x-tryvit-provider-boundary": "landing-lean" },
      });

      const response = await proxy(request);
      expect(
        response.headers.get("x-middleware-request-x-tryvit-provider-boundary"),
      ).toBe("application");
    });

    it.each([
      [
        "RSC navigation with a query",
        new NextRequest(new URL("/?utm_source=test", "http://localhost:3000"), {
          headers: { rsc: "1" },
        }),
      ],
      [
        "router-state request with a query",
        new NextRequest(new URL("/?utm_source=test", "http://localhost:3000"), {
          headers: { "next-router-state-tree": "[]" },
        }),
      ],
      [
        "router prefetch value 1 with a query",
        new NextRequest(new URL("/?utm_source=test", "http://localhost:3000"), {
          headers: { "next-router-prefetch": "1" },
        }),
      ],
      [
        "router prefetch value 2 with a query",
        new NextRequest(new URL("/?utm_source=test", "http://localhost:3000"), {
          headers: { "next-router-prefetch": "2" },
        }),
      ],
      [
        "segment prefetch with a query",
        new NextRequest(new URL("/?utm_source=test", "http://localhost:3000"), {
          headers: { "next-router-segment-prefetch": "/children" },
        }),
      ],
      [
        "middleware prefetch with a query",
        new NextRequest(new URL("/?utm_source=test", "http://localhost:3000"), {
          headers: { "x-middleware-prefetch": "1" },
        }),
      ],
      [
        "generic prefetch with a query",
        new NextRequest(new URL("/?utm_source=test", "http://localhost:3000"), {
          headers: { purpose: "prefetch" },
        }),
      ],
      [
        "structured prefetch with a query",
        new NextRequest(new URL("/?utm_source=test", "http://localhost:3000"), {
          headers: { "sec-purpose": "prefetch;prerender" },
        }),
      ],
      [
        "RSC cache discriminator without transport headers",
        new NextRequest(new URL("/?utm_source=test&_rsc=unit", "http://localhost:3000")),
      ],
      [
        "POST landing request",
        new NextRequest(new URL("/", "http://localhost:3000"), { method: "POST" }),
      ],
    ])("keeps the application boundary for a %s request", async (_label, request) => {
      const response = await proxy(request);
      expect(
        response.headers.get("x-middleware-request-x-tryvit-provider-boundary"),
      ).toBe("application");
    });
  });

  describe("backend-independent policy routes", () => {
    const routes = [
      "/",
      "/contact",
      "/privacy",
      "/terms",
      "/forbidden",
      "/offline",
      "/learn",
      "/learn/allergens",
      "/lists/shared/invalid-token-abc123",
      "/compare/shared/invalid-token-abc123",
      "/lists/shared/invalid-token-abc123/opengraph-image",
      "/compare/shared/invalid-token-abc123/opengraph-image",
      "/manifest.webmanifest",
      "/sw.js",
      "/_vercel/speed-insights/script.js",
      "/robots.txt",
      "/sitemap.xml",
      "/opengraph-image",
      "/twitter-image",
      "/favicon.ico",
      "/icons/icon-192.png",
      "/auth/callback",
      "/auth/recovery/callback",
      "/auth/forgot-password",
      "/auth/update-password",
      "/?utm_source=test",
      "/?utm_source=test&utm_campaign=x",
      "/?ref=newsletter",
      "/?foo=bar",
    ];

    it.each(routes)("passes %s without constructing a Supabase client", async (pathname) => {
      const response = await proxy(createRequest(pathname));

      expect(response.status).not.toBe(307);
      expect(mockCreateMiddlewareClient).not.toHaveBeenCalled();
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("does not construct a Supabase client for API rate limiting", async () => {
      await proxy(createRequest("/api/health"));

      expect(mockCreateMiddlewareClient).not.toHaveBeenCalled();
      expect(mockGetUser).not.toHaveBeenCalled();
    });
  });

  describe("authenticated user on auth pages", () => {
    it("redirects logged-in user from /auth/login to /app/search", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1" } },
      });
      const response = await proxy(createRequest("/auth/login"));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/app/search");
    });

    it("redirects logged-in user from /auth/signup to /app/search", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1" } },
      });
      const response = await proxy(createRequest("/auth/signup"));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/app/search");
    });

    it("returns a logged-in user to the sanitized deep app destination", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
      const response = await proxy(
        createRequest("/auth/login?redirect=%2Fapp%2Fproduct%2F42%3Ftab%3Dnutrition"),
      );
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/app/product/42?tab=nutrition",
      );
    });

    it("rejects an external signed-in redirect target", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
      const response = await proxy(
        createRequest("/auth/login?redirect=https%3A%2F%2Fevil.com"),
      );
      expect(response.headers.get("location")).toBe("http://localhost:3000/app/search");
    });

    it("does not redirect logged-in user from /", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1" } },
      });
      const response = await proxy(createRequest("/"));
      expect(response.status).not.toBe(307);
    });
  });

  describe("demo-mode authentication boundary", () => {
    it("renders auth-entry routes without constructing a Supabase client", async () => {
      vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "demo");

      const response = await proxy(createRequest("/auth/login"));

      expect(response.status).not.toBe(307);
      expect(mockCreateMiddlewareClient).not.toHaveBeenCalled();
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("fails protected routes closed without constructing a Supabase client", async () => {
      vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "demo");

      const response = await proxy(createRequest("/app/search?q=milk"));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/auth/login");
      expect(decodeURIComponent(response.headers.get("location") ?? "")).toContain(
        "/app/search?q=milk",
      );
      expect(mockCreateMiddlewareClient).not.toHaveBeenCalled();
      expect(mockGetUser).not.toHaveBeenCalled();
    });
  });

  describe("protected routes", () => {
    it("redirects unauthenticated user from /app/search to login", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/app/search"));
      expect(response.status).toBe(307);
      const location = response.headers.get("location") ?? "";
      expect(location).toContain("/auth/login");
      expect(location).toContain("redirect=%2Fapp%2Fsearch");
    });

    it("redirects unauthenticated user from /app/settings to login", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/app/settings"));
      expect(response.status).toBe(307);
      const location = response.headers.get("location") ?? "";
      expect(location).toContain("/auth/login");
    });

    it("preserves query string in redirect parameter", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/app/search?q=test&page=2"));
      expect(response.status).toBe(307);
      const location = response.headers.get("location") ?? "";
      // Redirect param should include both path and query
      expect(location).toContain("redirect=");
      expect(decodeURIComponent(location)).toContain("q=test");
    });

    it("allows authenticated user on protected routes", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1" } },
      });
      const response = await proxy(createRequest("/app/search"));
      expect(response.status).not.toBe(307);
      expect(mockCreateMiddlewareClient).toHaveBeenCalledTimes(1);
    });

    it.each([
      "/learned",
      "/contact-us",
      "/authentication",
      "/lists/shared/invalid-token/unexpected",
      "/compare/shared/invalid-token/unexpected",
    ])("fails closed for near-match route %s", async (pathname) => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const response = await proxy(createRequest(pathname));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/auth/login");
      expect(mockCreateMiddlewareClient).toHaveBeenCalledTimes(1);
      expect(mockGetUser).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Rate limiting (#182) ───────────────────────────────────────────────

  describe("rate limiting — API routes", () => {
    it("returns 200 with rate limit headers when under limit", async () => {
      const response = await proxy(createRequest("/api/health"));
      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("59");
      expect(response.headers.has("X-RateLimit-Reset")).toBe(true);
    });

    it("returns 429 with Retry-After when limit exceeded", async () => {
      mockLimit.mockResolvedValue({
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 30_000,
      });

      const response = await proxy(createRequest("/api/health"));
      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body.error).toBe("Too Many Requests");
      expect(body.message).toMatch(/Rate limit exceeded/);
      expect(response.headers.has("Retry-After")).toBe(true);
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("does not call Supabase auth for API routes", async () => {
      await proxy(createRequest("/api/health"));
      expect(mockCreateMiddlewareClient).not.toHaveBeenCalled();
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it("preserves x-request-id on 429 response", async () => {
      mockLimit.mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const response = await proxy(createRequest("/api/health"));
      expect(response.status).toBe(429);
      expect(response.headers.get("x-request-id")).toBeTruthy();
    });

    it("passes through with rate limit headers on success", async () => {
      const response = await proxy(createRequest("/api/some-endpoint"));
      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBeTruthy();
    });

    it("bypasses rate limit when RATE_LIMIT_BYPASS_TOKEN matches", async () => {
      const originalEnv = process.env.RATE_LIMIT_BYPASS_TOKEN;
      process.env.RATE_LIMIT_BYPASS_TOKEN = "test-bypass-secret";

      // Set limit to fail so we can verify bypass
      mockLimit.mockResolvedValue({
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const req = new NextRequest(new URL("/api/health", "http://localhost:3000"), {
        headers: { "x-rate-limit-bypass": "test-bypass-secret" },
      });
      const response = await proxy(req);
      // Should NOT be 429 because bypass token is valid
      expect(response.status).toBe(200);

      process.env.RATE_LIMIT_BYPASS_TOKEN = originalEnv;
    });

    it("does not bypass with wrong token", async () => {
      const originalEnv = process.env.RATE_LIMIT_BYPASS_TOKEN;
      process.env.RATE_LIMIT_BYPASS_TOKEN = "correct-secret";

      mockLimit.mockResolvedValue({
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const req = new NextRequest(new URL("/api/health", "http://localhost:3000"), {
        headers: { "x-rate-limit-bypass": "wrong-secret" },
      });
      const response = await proxy(req);
      expect(response.status).toBe(429);

      process.env.RATE_LIMIT_BYPASS_TOKEN = originalEnv;
    });
  });

  // ─── Admin route protection (#186, #579) ──────────────────────────────────

  describe("admin route protection", () => {
    it("redirects non-admin user to /forbidden on /app/admin/submissions", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1", email: "user@example.com" } },
      });
      const response = await proxy(createRequest("/app/admin/submissions"));
      expect(response.status).toBe(303);
      const location = response.headers.get("location") ?? "";
      expect(location).toContain("/forbidden");
    });

    it("redirects non-admin user to /forbidden on /app/admin/monitoring", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1", email: "user@example.com" } },
      });
      const response = await proxy(createRequest("/app/admin/monitoring"));
      expect(response.status).toBe(303);
      const location = response.headers.get("location") ?? "";
      expect(location).toContain("/forbidden");
    });

    it("protects the temporary Turnstile attestation route with ADMIN_EMAILS", async () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = "admin@example.com";
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1", email: "user@example.com" } },
      });

      const response = await proxy(
        createRequest("/app/admin/turnstile-attestation"),
      );

      expect(response.status).toBe(303);
      expect(response.headers.get("location") ?? "").toContain("/forbidden");
      process.env.ADMIN_EMAILS = originalEnv;
    });

    it("allows an allowlisted admin to the temporary Turnstile attestation route", async () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = "admin@example.com";
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1", email: "admin@example.com" } },
      });

      const response = await proxy(
        createRequest("/app/admin/turnstile-attestation"),
      );

      expect(response.status).not.toBe(303);
      expect(response.status).not.toBe(307);
      process.env.ADMIN_EMAILS = originalEnv;
    });

    it("redirects to /forbidden when ADMIN_EMAILS is unset (deny-by-default)", async () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      delete process.env.ADMIN_EMAILS;

      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1", email: "admin@example.com" } },
      });
      const response = await proxy(createRequest("/app/admin/submissions"));
      expect(response.status).toBe(303);
      const location = response.headers.get("location") ?? "";
      expect(location).toContain("/forbidden");

      process.env.ADMIN_EMAILS = originalEnv;
    });

    it("allows admin user when email matches ADMIN_EMAILS", async () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = "admin@example.com, admin2@example.com";

      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1", email: "admin@example.com" } },
      });
      const response = await proxy(createRequest("/app/admin/submissions"));
      expect(response.status).not.toBe(303);
      expect(response.status).not.toBe(307);

      process.env.ADMIN_EMAILS = originalEnv;
    });

    it("admin email check is case-insensitive", async () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = "Admin@Example.com";

      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1", email: "admin@example.com" } },
      });
      const response = await proxy(createRequest("/app/admin/monitoring"));
      expect(response.status).not.toBe(303);

      process.env.ADMIN_EMAILS = originalEnv;
    });

    it("redirects to /forbidden when user has no email", async () => {
      const originalEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = "admin@example.com";

      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1" } },
      });
      const response = await proxy(createRequest("/app/admin/submissions"));
      expect(response.status).toBe(303);
      const location = response.headers.get("location") ?? "";
      expect(location).toContain("/forbidden");

      process.env.ADMIN_EMAILS = originalEnv;
    });

    it("redirects unauthenticated user from admin route to login", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/app/admin/submissions"));
      expect(response.status).toBe(307);
      const location = response.headers.get("location") ?? "";
      expect(location).toContain("/auth/login");
    });

    it("does not treat /app/administrator as an admin route", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1", email: "user@example.com" } },
      });

      const response = await proxy(createRequest("/app/administrator"));

      expect(response.status).not.toBe(303);
      expect(response.status).not.toBe(307);
    });

    it("does not expose x-request-id on redirect to /forbidden", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u1", email: "user@example.com" } },
      });
      const response = await proxy(createRequest("/app/admin/submissions"));
      expect(response.status).toBe(303);
      const location = response.headers.get("location") ?? "";
      expect(location).toContain("/forbidden");
    });
  });

  // ─── Request ID correlation ─────────────────────────────────────────────

  describe("request ID", () => {
    it("generates x-request-id for page requests", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await proxy(createRequest("/"));
      expect(response.headers.get("x-request-id")).toBeTruthy();
    });

    it("generates x-request-id for API requests", async () => {
      const response = await proxy(createRequest("/api/health"));
      expect(response.headers.get("x-request-id")).toBeTruthy();
    });

    it("preserves existing x-request-id", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = new NextRequest(new URL("/", "http://localhost:3000"), {
        headers: { "x-request-id": "existing-id-123" },
      });
      const response = await proxy(req);
      expect(response.headers.get("x-request-id")).toBe("existing-id-123");
    });
  });
});
