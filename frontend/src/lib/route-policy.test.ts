import { describe, expect, it } from "vitest";
import {
  ROUTE_CLASS,
  ROUTE_POLICY_AUDIT_PATHS,
  ROUTE_POLICY_RULES,
  getMatchingRoutePolicyRules,
  getRoutePolicy,
} from "./route-policy";

describe("route policy", () => {
  it("gives every audited policy example exactly one explicit classification", () => {
    for (const { path, ruleId } of ROUTE_POLICY_AUDIT_PATHS) {
      const matches = getMatchingRoutePolicyRules(path);
      expect(matches, path).toHaveLength(1);
      expect(matches[0]?.id, path).toBe(ruleId);
    }
  });

  it("keeps every policy rule covered by an audited concrete path", () => {
    for (const rule of ROUTE_POLICY_RULES) {
      expect(rule.auditPaths.length, rule.id).toBeGreaterThan(0);
    }
  });

  it("uses segment boundaries instead of permissive string startsWith checks", () => {
    for (const pathname of [
      "/learned",
      "/contact-us",
      "/authentication",
      "/app/administrator",
      "/lists/shared/example-token/unexpected",
      "/compare/shared/example-token/unexpected",
    ]) {
      expect(getRoutePolicy(pathname).routeClass, pathname).toBe(
        ROUTE_CLASS.protected,
      );
    }
  });

  it("keeps syntactically complete public shares anonymous while malformed paths fail closed", () => {
    expect(getRoutePolicy("/lists/shared/safe-token").routeClass).toBe(
      ROUTE_CLASS.publicShare,
    );
    expect(getRoutePolicy("/compare/shared/safe-token").routeClass).toBe(
      ROUTE_CLASS.publicShare,
    );
    expect(getRoutePolicy("/lists/shared").routeClass).toBe(
      ROUTE_CLASS.protected,
    );
    expect(getRoutePolicy("/compare/shared").routeClass).toBe(
      ROUTE_CLASS.protected,
    );
  });

  it("normalizes a trailing slash without treating a query string as a pathname", () => {
    expect(getRoutePolicy("/auth/login/").id).toBe("auth-login");
    expect(getRoutePolicy("/auth/recovery/callback/").id).toBe(
      "auth-recovery-callback",
    );
    expect(getRoutePolicy("/learn/allergens?source=policy").id).toBe("learn");
  });

  it("marks only login and signup as public routes that may look up a user", () => {
    const routesAllowedToLookup = ROUTE_POLICY_RULES.filter(
      (rule) => rule.authenticationLookup === "signed-in-redirect",
    ).map((rule) => rule.id);

    expect(routesAllowedToLookup).toEqual(["auth-login", "auth-signup"]);
  });
});
