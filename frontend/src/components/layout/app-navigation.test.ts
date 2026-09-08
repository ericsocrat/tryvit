import { describe, expect, it } from "vitest";
import { HEADER_MORE_ITEMS, HEADER_PRIMARY_ITEMS, HOME_ITEM, isNavigationItemActive, MOBILE_PRIMARY_ITEMS, SIDEBAR_SECTIONS } from "./app-navigation";

describe("core-task navigation contract", () => {
  it("shares the same five primary tasks across desktop layouts", () => {
    const paths = ["/app", "/app/search", "/app/scan", "/app/lists", "/app/compare"];
    expect(HEADER_PRIMARY_ITEMS.map((item) => item.href)).toEqual(paths);
    expect(SIDEBAR_SECTIONS[0].items.map((item) => item.href)).toEqual(paths);
  });

  it("keeps mobile to four primary destinations and More without losing tools", () => {
    expect(MOBILE_PRIMARY_ITEMS.map((item) => item.href)).toEqual(["/app", "/app/search", "/app/scan", "/app/lists"]);
    expect(HEADER_MORE_ITEMS.map((item) => item.href)).toEqual(expect.arrayContaining(["/app/categories", "/app/image-search", "/app/watchlist", "/app/recipes", "/app/achievements"]));
  });

  it("does not treat absence of a route match as a destination", () => {
    expect(isNavigationItemActive({ ...HOME_ITEM, routeKey: null }, null)).toBe(false);
    expect(isNavigationItemActive(HOME_ITEM, "home")).toBe(true);
    expect(isNavigationItemActive(HOME_ITEM, null)).toBe(false);
  });
});
