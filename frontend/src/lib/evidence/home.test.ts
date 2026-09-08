import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { HomeReadModelSchema, getHomeReadModel, homeQueryKey } from "./home";
import { homeFixture } from "./home.fixtures";
import { findPreferencesFixture } from "./search.fixtures";
import { queryKeys } from "@/lib/query-keys";

describe("Home evidence contract", () => {
  it("keeps canonical recorded and legacy states with neutral membership counts", () => {
    const data = HomeReadModelSchema.parse(homeFixture());
    expect(data.recently_viewed.map((item) => item.product?.evidence.state)).toEqual(["recorded", "legacy_unverified"]);
    expect(data.stats.favorites_count).toBe(7);
    expect(data.recently_viewed.every((item) => item.product?.score.value === null)).toBe(true);
  });
  it("retains an archived or missing saved reference without dropping its count", () => {
    const data = homeFixture(); data.favorites_preview[0].product = null;
    expect(HomeReadModelSchema.parse(data).stats.favorites_count).toBe(7);
    data.recently_viewed[0].product!.is_deprecated = true;
    expect(HomeReadModelSchema.parse(data).recently_viewed[0].product!.is_deprecated).toBe(true);
  });
  it("rejects substituted identity, duplicate rows and incorrect membership counts", () => {
    const wrong = homeFixture(); wrong.recently_viewed[0].product_id = 999;
    expect(HomeReadModelSchema.safeParse(wrong).success).toBe(false);
    const duplicate = homeFixture(); duplicate.recently_viewed.push(duplicate.recently_viewed[0]);
    expect(HomeReadModelSchema.safeParse(duplicate).success).toBe(false);
    const counts = homeFixture(); counts.stats.favorites_count = 0;
    expect(HomeReadModelSchema.safeParse(counts).success).toBe(false);
  });
  it("rejects aggregate insights rather than silently accepting legacy API fields", () => {
    expect(HomeReadModelSchema.safeParse({ ...homeFixture(), avg_score: 0 }).success).toBe(false);
    expect(HomeReadModelSchema.safeParse({ ...homeFixture(), stats: { ...homeFixture().stats, healthy_count: 100 } }).success).toBe(false);
  });
  it("does not accept an unassessed or incomplete warning count as a completed zero", () => {
    const data = homeFixture(); data.saved_allergen_matches.count = 0;
    expect(HomeReadModelSchema.safeParse(data).success).toBe(false);
    data.saved_allergen_matches.state = "checked"; data.saved_allergen_matches.count = 1;
    expect(HomeReadModelSchema.safeParse(data).success).toBe(false);
    data.saved_allergen_matches.count = 0;
    expect(HomeReadModelSchema.safeParse(data).success).toBe(true);
  });
  it("requires warning assertions to match canonical source, kind and identity", () => {
    const data = homeFixture(), product = data.favorites_preview[0].product!;
    const id = product.sources[0].observation_id;
    product.allergens.contains = [{ name: "milk", state: "recorded", observation_id: id }];
    data.saved_allergen_matches = { state: "checked", count: 1, includes_traces: false, products: [{ product_id: product.product_id, product, matches: [{ allergen: "milk", kind: "contains", state: "recorded", observation_id: id }] }] };
    expect(HomeReadModelSchema.safeParse(data).success).toBe(true);
    data.saved_allergen_matches.products[0].matches[0].allergen = "tree-nuts";
    expect(HomeReadModelSchema.safeParse(data).success).toBe(false);
    data.saved_allergen_matches.products[0].matches[0].allergen = "milk";
    data.saved_allergen_matches.products[0].matches[0].kind = "traces";
    expect(HomeReadModelSchema.safeParse(data).success).toBe(false);
  });
  it("isolates cache identity by user, country, language and allergen preference version", () => {
    const base = homeQueryKey(findPreferencesFixture, "en");
    expect(base.slice(0, queryKeys.dashboard.length)).toEqual(queryKeys.dashboard);
    for (const preferences of [{ ...findPreferencesFixture, user_id: "another-user" }, { ...findPreferencesFixture, country: "DE" }, { ...findPreferencesFixture, avoid_allergens: ["milk"] }, { ...findPreferencesFixture, treat_may_contain_as_unsafe: true }, { ...findPreferencesFixture, updated_at: "2026-09-05T00:00:00Z" }]) expect(homeQueryKey(preferences, "en")).not.toEqual(base);
    expect(homeQueryKey(findPreferencesFixture, "de")).not.toEqual(base);
  });
  it("uses one validated endpoint and rejects a mismatched response language", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: homeFixture(), error: null });
    const client = { rpc } as unknown as SupabaseClient;
    expect((await getHomeReadModel(client, "en")).ok).toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("api_home_read_model", { p_language: "en" });
    expect((await getHomeReadModel(client, "de")).ok).toBe(false);
  });
});
