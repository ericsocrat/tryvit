import { beforeEach, describe, expect, it, vi } from "vitest";
import { findContext, findHref, findProducts, findQueryKeys, parseFindParams } from "./search";
import { findPreferencesFixture } from "./search.fixtures";

const mockRpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rpc", () => ({ callValidatedRpc: mockRpc }));
const parse = (query: string) => parseFindParams(new URLSearchParams(query));
beforeEach(() => vi.clearAllMocks());

describe("URL-owned Find contract", () => {
  it("preserves repeated supported filters and contextual ordering", () => {
    const { request, problems } = parse("q=skyr&category=Dairy&category=Drinks&nova_group=1&nova_group=2&allergen_free=milk&country=DE&sort=name&order=desc&page=2&show_avoided=true");
    expect(problems).toEqual([]);
    expect(request).toEqual({ q: "skyr", filters: { category: ["Dairy", "Drinks"], nova_group: ["1", "2"], allergen_free: ["milk"], country: "DE", sort_by: "name", sort_order: "desc" }, page: 2, showAvoided: true });
    expect(parse(new URL(findHref(request), "https://example.org").search).request).toEqual(request);
  });

  it("opens presentation-only category/filter panels without changing the request", () => {
    expect(parse("q=milk&panel=categories").request).toEqual(parse("q=milk").request);
    expect(findHref(parse("q=milk").request, "categories")).toContain("panel=categories");
  });

  it("reads a legacy saved search without changing its stored record", () => {
    const filters = JSON.stringify({ category: ["Dairy"], max_unhealthiness: 20, sort_by: "unhealthiness" });
    const params = new URLSearchParams({ q: "skyr", filters });
    const result = parseFindParams(params);
    expect(result.problems).toContain("unsupported_filters");
    expect(result.request.q).toBe("skyr");
    expect(result.request.filters.category).toEqual(["Dairy"]);
    expect(params.get("filters")).toBe(filters);
    const recovery = parse(new URL(findHref(result.request), "https://example.org").search);
    expect(recovery.problems).toEqual([]);
    expect(recovery.request.filters.category).toEqual(["Dairy"]);
  });

  it("explicit URL filters override supported saved-filter values but do not waive retired ones", () => {
    const params = new URLSearchParams({ filters: JSON.stringify({ category: ["Dairy"], nutri_score: ["A"] }), category: "Drinks" });
    const result = parseFindParams(params);
    expect(result.request.filters.category).toEqual(["Drinks"]);
    expect(result.problems).toEqual(["unsupported_filters"]);
  });

  it.each(["filters=bad", "filters=%5B%5D", "nova_group=5", "allergen_free=imaginary", "show_avoided=maybe", "country=XX", "category="])("rejects invalid settings %s", (query) => {
    expect(parse(query).problems.length).toBeGreaterThan(0);
  });

  it.each(["0", "-1", "1.5", "10001", "Infinity"])("recovers invalid page %s without executing it", (page) => {
    expect(parse(`q=milk&page=${page}`)).toMatchObject({ request: { page: 1, q: "milk" }, problems: ["invalid_page"] });
  });

  it("normalizes legacy allergen prefixes without inventing labels", () => {
    expect(parse("allergen_free=en%3Amilk").request.filters.allergen_free).toEqual(["milk"]);
  });

  it("retains valid Unicode query content and rejects overlong query execution", () => {
    expect(parse("q=%20%C5%81aciate%20%26%20Skyr%20").request.q).toBe("Łaciate & Skyr");
    expect(parse(`q=${"x".repeat(201)}`).problems).toContain("invalid_query");
  });
});

describe("Find request and cache identity", () => {
  it("varies by every response-affecting preference/market/language/avoid context", () => {
    const request = parse("q=milk").request;
    const baseline = findQueryKeys.results(request, findContext(findPreferencesFixture, "en"));
    for (const change of [{ user_id: "other" }, { country: "DE" }, { updated_at: "later" }, { avoid_allergens: ["milk"] }, { strict_diet: true }, { strict_allergen: true }, { treat_may_contain_as_unsafe: true }, { diet_preference: "vegan" }]) {
      expect(findQueryKeys.results(request, findContext({ ...findPreferencesFixture, ...change }, "en"))).not.toEqual(baseline);
    }
    expect(findQueryKeys.results(request, findContext(findPreferencesFixture, "de"))).not.toEqual(baseline);
    expect(findQueryKeys.results(request, findContext(findPreferencesFixture, "en", [1]))).not.toEqual(baseline);
    expect(findQueryKeys.results({ ...request, showAvoided: true }, findContext(findPreferencesFixture, "en"))).not.toEqual(baseline);
  });

  it("sends bounded v2 requests without private context in the payload", () => {
    const client = {} as Parameters<typeof findProducts>[0];
    findProducts(client, parse("q=milk&page=2").request, "pl", "PL");
    expect(mockRpc).toHaveBeenCalledWith(client, "api_find_products", expect.anything(), { p_query: "milk", p_filters: { country: "PL" }, p_page: 2, p_page_size: 20, p_show_avoided: false, p_language: "pl" });
  });
});
