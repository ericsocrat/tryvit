import { describe, expect, it } from "vitest";

import {
  assertNavigationContract,
  normalizePathAndQuery,
  routeExpectation,
  type NavigationHop,
} from "./route-destination";
import type { RouteEntry } from "../routes";

const APP_ORIGIN = "http://127.0.0.1:3000";
const route = (expectedRedirect?: RouteEntry["expectedRedirect"]): RouteEntry => ({
  path: "/app/search?q=milk&category=Dairy&category=Fresh",
  label: "search",
  requiresAuth: true,
  tags: ["full"],
  expectedRedirect,
});
const hop = (path: string, status = 200): NavigationHop => ({
  url: `${APP_ORIGIN}${path}`,
  status,
});

describe("quality route destination contracts", () => {
  it("normalizes the complete query multiset without depending on parameter order", () => {
    expect(normalizePathAndQuery("/find?b=2&a=3&a=1")).toBe("/find?a=1&a=3&b=2");
  });

  it("accepts one exact render response", () => {
    const expectation = routeExpectation(route(), "local-authenticated");
    expect(() =>
      assertNavigationContract({
        appOrigin: APP_ORIGIN,
        pageUrl: `${APP_ORIGIN}/app/search?category=Fresh&q=milk&category=Dairy`,
        hops: [hop("/app/search?category=Dairy&category=Fresh&q=milk")],
        expectation,
      }),
    ).not.toThrow();
  });

  it("rejects an undeclared redirect and an extra query parameter", () => {
    const expectation = routeExpectation(route(), "local-authenticated");
    expect(() =>
      assertNavigationContract({
        appOrigin: APP_ORIGIN,
        pageUrl: `${APP_ORIGIN}/app/search`,
        hops: [hop(route().path, 307), hop("/app/search")],
        expectation,
      }),
    ).toThrow("route-render-used-redirect");
    expect(() =>
      assertNavigationContract({
        appOrigin: APP_ORIGIN,
        pageUrl: `${APP_ORIGIN}${route().path}&page=2`,
        hops: [hop(`${route().path}&page=2`)],
        expectation,
      }),
    ).toThrow("route-navigation-chain-mismatch");
  });

  it("rejects an external origin", () => {
    const expectation = routeExpectation(route(), "local-authenticated");
    expect(() =>
      assertNavigationContract({
        appOrigin: APP_ORIGIN,
        pageUrl: "https://example.invalid/app/search",
        hops: [{ url: "https://example.invalid/app/search", status: 200 }],
        expectation,
      }),
    ).toThrow("route-navigation-origin-mismatch");
  });

  it("requires the exact declared redirect chain and an actual redirect", () => {
    const source = route({
      "local-authenticated": [route().path, "/app/search"],
    });
    const expectation = routeExpectation(source, "local-authenticated");
    expect(() =>
      assertNavigationContract({
        appOrigin: APP_ORIGIN,
        pageUrl: `${APP_ORIGIN}/app/search`,
        hops: [hop(source.path, 307), hop("/app/search")],
        expectation,
      }),
    ).not.toThrow();
    expect(() =>
      assertNavigationContract({
        appOrigin: APP_ORIGIN,
        pageUrl: `${APP_ORIGIN}/app/search`,
        hops: [hop("/app/search")],
        expectation,
      }),
    ).toThrow("route-navigation-chain-mismatch");
    expect(() =>
      assertNavigationContract({
        appOrigin: APP_ORIGIN,
        pageUrl: `${APP_ORIGIN}/app/search`,
        hops: [hop(source.path, 307), hop("/onboarding", 307), hop("/app/search")],
        expectation,
      }),
    ).toThrow("route-navigation-chain-mismatch");
  });

  it("rejects a non-redirect intermediate response", () => {
    const source = route({
      "local-authenticated": [route().path, "/app/search"],
    });
    expect(() =>
      assertNavigationContract({
        appOrigin: APP_ORIGIN,
        pageUrl: `${APP_ORIGIN}/app/search`,
        hops: [hop(source.path, 200), hop("/app/search")],
        expectation: routeExpectation(source, "local-authenticated"),
      }),
    ).toThrow("route-intermediate-status-invalid");
  });

  it("accepts only an explicitly declared client-side redirect transport", () => {
    const source = route({
      "local-authenticated": {
        transport: "client",
        chain: [route().path, "/app/search?panel=categories"],
      },
    });
    const expectation = routeExpectation(source, "local-authenticated");
    expect(() =>
      assertNavigationContract({
        appOrigin: APP_ORIGIN,
        pageUrl: `${APP_ORIGIN}/app/search?panel=categories`,
        hops: [hop(source.path)],
        expectation,
      }),
    ).not.toThrow();
    expect(() =>
      assertNavigationContract({
        appOrigin: APP_ORIGIN,
        pageUrl: `${APP_ORIGIN}/app/search?panel=categories`,
        hops: [hop(source.path, 307), hop("/app/search?panel=categories")],
        expectation,
      }),
    ).toThrow("route-navigation-chain-mismatch");
  });
});
