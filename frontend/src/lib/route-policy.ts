/**
 * Initial public/auth route policy for Phase 5A.0.
 *
 * This is deliberately the first slice of the broader route manifest planned
 * for Phase 5B. It owns only request-boundary policy: which routes may pass
 * through the proxy anonymously, which need a session lookup, and which must
 * remain protected. Navigation, labels, metadata, and loading-state ownership
 * stay out of this module until the full manifest is introduced.
 */

export const ROUTE_CLASS = {
  api: "api",
  authCallback: "auth-callback",
  authEntry: "auth-entry",
  authRecovery: "auth-recovery",
  protected: "protected",
  protectedAdmin: "protected-admin",
  publicPage: "public-page",
  publicShare: "public-share",
  publicSystem: "public-system",
} as const;

export type RouteClass = (typeof ROUTE_CLASS)[keyof typeof ROUTE_CLASS];

/**
 * Proxy-level authentication work allowed for a route. `signed-in-redirect`
 * is intentionally limited to login/signup, where the lookup has a documented
 * user-visible purpose. All other public routes must skip client construction.
 */
export type AuthenticationLookupPolicy =
  | "never"
  | "signed-in-redirect"
  | "required";

export type RouteMatcher =
  | Readonly<{ kind: "exact"; path: string }>
  | Readonly<{ kind: "segment-prefix"; path: string }>
  | Readonly<{ kind: "path-prefix"; path: string }>
  | Readonly<{ kind: "segments"; segments: readonly (string | ":token")[] }>;

export interface RoutePolicyRule {
  /** Stable identifier used by the proxy and coverage tests. */
  readonly id: string;
  readonly routeClass: RouteClass;
  readonly matcher: RouteMatcher;
  readonly authenticationLookup: AuthenticationLookupPolicy;
  readonly allowsSignedInRedirect: boolean;
  readonly requiresAnonymousAccess: boolean;
  readonly requiresGracefulBackendUnavailable: boolean;
  /**
   * Concrete audited paths for this rule. They are co-located with the rule so
   * policy coverage cannot drift into another hand-maintained route registry.
   */
  readonly auditPaths: readonly string[];
}

const publicPage = (
  id: string,
  path: string,
): RoutePolicyRule => ({
  id,
  routeClass: ROUTE_CLASS.publicPage,
  matcher: { kind: "exact", path },
  authenticationLookup: "never",
  allowsSignedInRedirect: false,
  requiresAnonymousAccess: true,
  requiresGracefulBackendUnavailable: true,
  auditPaths: [path],
});

const publicSystem = (
  id: string,
  matcher: RouteMatcher,
  auditPaths: readonly string[],
): RoutePolicyRule => ({
  id,
  routeClass: ROUTE_CLASS.publicSystem,
  matcher,
  authenticationLookup: "never",
  allowsSignedInRedirect: false,
  requiresAnonymousAccess: true,
  requiresGracefulBackendUnavailable: true,
  auditPaths,
});

/**
 * The authoritative route-policy rules. Rules are intentionally narrow:
 * generic path prefixes are reserved for segment-safe hierarchy boundaries,
 * while dynamic share routes require their complete path shape.
 */
export const ROUTE_POLICY_RULES: readonly RoutePolicyRule[] = [
  {
    id: "api-rate-limited",
    routeClass: ROUTE_CLASS.api,
    matcher: { kind: "path-prefix", path: "/api/" },
    authenticationLookup: "never",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: false,
    requiresGracefulBackendUnavailable: false,
    auditPaths: ["/api/health", "/api/flags"],
  },
  {
    id: "protected-admin",
    routeClass: ROUTE_CLASS.protectedAdmin,
    matcher: { kind: "segment-prefix", path: "/app/admin" },
    authenticationLookup: "required",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: false,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/app/admin/monitoring", "/app/admin/submissions"],
  },
  {
    id: "public-shared-list-metadata",
    routeClass: ROUTE_CLASS.publicSystem,
    matcher: {
      kind: "segments",
      segments: ["lists", "shared", ":token", "opengraph-image"],
    },
    authenticationLookup: "never",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/lists/shared/example-token/opengraph-image"],
  },
  {
    id: "public-shared-comparison-metadata",
    routeClass: ROUTE_CLASS.publicSystem,
    matcher: {
      kind: "segments",
      segments: ["compare", "shared", ":token", "opengraph-image"],
    },
    authenticationLookup: "never",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/compare/shared/example-token/opengraph-image"],
  },
  {
    id: "public-shared-list",
    routeClass: ROUTE_CLASS.publicShare,
    matcher: { kind: "segments", segments: ["lists", "shared", ":token"] },
    authenticationLookup: "never",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/lists/shared/invalid-token-abc123"],
  },
  {
    id: "public-shared-comparison",
    routeClass: ROUTE_CLASS.publicShare,
    matcher: { kind: "segments", segments: ["compare", "shared", ":token"] },
    authenticationLookup: "never",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/compare/shared/invalid-token-abc123"],
  },
  {
    id: "auth-login",
    routeClass: ROUTE_CLASS.authEntry,
    matcher: { kind: "exact", path: "/auth/login" },
    authenticationLookup: "signed-in-redirect",
    allowsSignedInRedirect: true,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/auth/login"],
  },
  {
    id: "auth-signup",
    routeClass: ROUTE_CLASS.authEntry,
    matcher: { kind: "exact", path: "/auth/signup" },
    authenticationLookup: "signed-in-redirect",
    allowsSignedInRedirect: true,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/auth/signup"],
  },
  {
    id: "auth-forgot-password",
    routeClass: ROUTE_CLASS.authEntry,
    matcher: { kind: "exact", path: "/auth/forgot-password" },
    authenticationLookup: "never",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/auth/forgot-password"],
  },
  {
    id: "auth-update-password",
    routeClass: ROUTE_CLASS.authRecovery,
    matcher: { kind: "exact", path: "/auth/update-password" },
    authenticationLookup: "never",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/auth/update-password"],
  },
  {
    id: "auth-callback",
    routeClass: ROUTE_CLASS.authCallback,
    matcher: { kind: "exact", path: "/auth/callback" },
    authenticationLookup: "never",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/auth/callback"],
  },
  {
    id: "auth-recovery-callback",
    routeClass: ROUTE_CLASS.authCallback,
    matcher: { kind: "exact", path: "/auth/recovery/callback" },
    authenticationLookup: "never",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/auth/recovery/callback"],
  },
  publicSystem(
    "pwa-manifest",
    { kind: "exact", path: "/manifest.webmanifest" },
    ["/manifest.webmanifest"],
  ),
  publicSystem(
    "pwa-service-worker",
    { kind: "exact", path: "/sw.js" },
    ["/sw.js"],
  ),
  publicSystem(
    "speed-insights-script",
    { kind: "exact", path: "/_vercel/speed-insights/script.js" },
    ["/_vercel/speed-insights/script.js"],
  ),
  publicSystem(
    "robots",
    { kind: "exact", path: "/robots.txt" },
    ["/robots.txt"],
  ),
  publicSystem(
    "sitemap",
    { kind: "exact", path: "/sitemap.xml" },
    ["/sitemap.xml"],
  ),
  publicSystem(
    "root-opengraph-image",
    { kind: "exact", path: "/opengraph-image" },
    ["/opengraph-image"],
  ),
  publicSystem(
    "root-twitter-image",
    { kind: "exact", path: "/twitter-image" },
    ["/twitter-image"],
  ),
  publicSystem(
    "favicon",
    { kind: "exact", path: "/favicon.ico" },
    ["/favicon.ico"],
  ),
  publicSystem(
    "pwa-icons",
    { kind: "segment-prefix", path: "/icons" },
    ["/icons/icon-192.png", "/icons/icon-512-maskable.png"],
  ),
  publicPage("landing", "/"),
  publicPage("contact", "/contact"),
  publicPage("privacy", "/privacy"),
  publicPage("terms", "/terms"),
  publicPage("forbidden", "/forbidden"),
  publicPage("offline", "/offline"),
  {
    id: "learn",
    routeClass: ROUTE_CLASS.publicPage,
    matcher: { kind: "segment-prefix", path: "/learn" },
    authenticationLookup: "never",
    allowsSignedInRedirect: false,
    requiresAnonymousAccess: true,
    requiresGracefulBackendUnavailable: true,
    auditPaths: ["/learn", "/learn/allergens", "/learn/healthy-choices"],
  },
];

const DEFAULT_PROTECTED_POLICY: RoutePolicyRule = {
  id: "default-protected",
  routeClass: ROUTE_CLASS.protected,
  matcher: { kind: "segment-prefix", path: "/" },
  authenticationLookup: "required",
  allowsSignedInRedirect: false,
  requiresAnonymousAccess: false,
  requiresGracefulBackendUnavailable: true,
  auditPaths: [],
};

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/u, 1)[0] ?? "";
  if (!withoutQuery.startsWith("/")) return withoutQuery;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

function matchesSegments(
  pathname: string,
  expectedSegments: readonly (string | ":token")[],
): boolean {
  const parts = pathname.slice(1).split("/");
  if (parts.length !== expectedSegments.length || parts.some((part) => !part)) {
    return false;
  }
  return expectedSegments.every(
    (expected, index) => expected === ":token" || parts[index] === expected,
  );
}

function matchesRouteMatcher(pathname: string, matcher: RouteMatcher): boolean {
  switch (matcher.kind) {
    case "exact":
      return pathname === matcher.path;
    case "segment-prefix":
      return pathname === matcher.path || pathname.startsWith(`${matcher.path}/`);
    case "path-prefix":
      return pathname.startsWith(matcher.path);
    case "segments":
      return matchesSegments(pathname, matcher.segments);
  }
}

/** Returns every explicit policy rule matching a canonical pathname. */
export function getMatchingRoutePolicyRules(pathname: string): readonly RoutePolicyRule[] {
  const normalized = normalizePathname(pathname);
  return ROUTE_POLICY_RULES.filter((rule) =>
    matchesRouteMatcher(normalized, rule.matcher),
  );
}

/**
 * Resolves exactly one effective policy. Unknown routes intentionally resolve
 * to the protected default rather than becoming public by string prefix.
 */
export function getRoutePolicy(pathname: string): RoutePolicyRule {
  const matches = getMatchingRoutePolicyRules(pathname);
  if (matches.length === 0) return DEFAULT_PROTECTED_POLICY;
  if (matches.length === 1) return matches[0];
  throw new Error(
    `Route policy overlap for ${normalizePathname(pathname)}: ${matches.map((rule) => rule.id).join(", ")}`,
  );
}

/** Concrete audit examples derived from the policy rules themselves. */
export const ROUTE_POLICY_AUDIT_PATHS = ROUTE_POLICY_RULES.flatMap((rule) =>
  rule.auditPaths.map((path) => ({ path, ruleId: rule.id })),
);
