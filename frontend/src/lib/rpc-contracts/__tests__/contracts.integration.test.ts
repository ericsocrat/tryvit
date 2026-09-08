/**
 * Local RPC integration checks. Retired public APIs must explicitly fail closed;
 * historical payload schemas remain unit-tested as historical contracts only.
 * Protected-user endpoints distinguish an observed auth boundary from a real
 * payload validation. Guarded authenticated E2E/pgTAP prove their user behavior.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { z } from "zod";
import { RetiredPublicRpcSchema } from "@/lib/evidence/retired-public-rpc";
import { HealthProfileActiveContract, HealthProfileListContract, ListsContract, SavedSearchesContract, UserPreferencesContract } from "@/lib/rpc-contracts/index";

const INTEGRATION = process.env.INTEGRATION === "1";
const describeIntegration = INTEGRATION ? describe : describe.skip;
const QA_PRODUCT_ID = Number(process.env.QA_PRODUCT_ID ?? 1);
let supabase: SupabaseClient;
beforeAll(() => {
  if (!INTEGRATION) return;
  const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)) throw new Error("RPC integration checks require an explicit local Supabase runtime.");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!key) throw new Error("Local RPC integration credential is unavailable.");
  supabase = createClient(endpoint.toString(), key, { auth: { autoRefreshToken: false, persistSession: false } });
});

const RETIRED_RPCS: Array<{ name: string; params: Record<string, unknown> }> = [
  { name: "api_product_detail", params: { p_product_id: QA_PRODUCT_ID } },
  { name: "api_product_detail_by_ean", params: { p_ean: "9910000000990", p_country: "PL" } },
  { name: "api_get_product_profile", params: { p_product_id: QA_PRODUCT_ID } },
  { name: "api_get_product_profile_by_ean", params: { p_ean: "9910000000990" } },
  { name: "api_search_products", params: { p_query: "fixture" } },
  { name: "api_search_autocomplete", params: { p_query: "fixture" } },
  { name: "api_search_did_you_mean", params: { p_query: "fixture" } },
  { name: "api_get_filter_options", params: { p_country: "PL" } },
  { name: "api_category_listing", params: { p_category: "Dairy" } },
  { name: "api_category_overview", params: { p_country: "PL" } },
  { name: "api_get_products_for_compare", params: { p_product_ids: [QA_PRODUCT_ID] } },
  { name: "api_better_alternatives", params: { p_product_id: QA_PRODUCT_ID } },
  { name: "api_better_alternatives_v2", params: { p_product_id: QA_PRODUCT_ID } },
  { name: "api_score_explanation", params: { p_product_id: QA_PRODUCT_ID } },
  { name: "api_data_confidence", params: { p_product_id: QA_PRODUCT_ID } },
  { name: "api_product_provenance", params: { p_product_id: QA_PRODUCT_ID } },
  { name: "api_get_score_history", params: { p_product_id: QA_PRODUCT_ID } },
  { name: "api_score_history", params: { p_product_id: QA_PRODUCT_ID } },
  { name: "api_get_recently_viewed", params: { p_limit: 5 } },
  { name: "api_get_watchlist", params: { p_page: 1, p_page_size: 5 } },
  { name: "api_dashboard_insights", params: {} },
  { name: "api_get_cross_country_links", params: { p_product_id: QA_PRODUCT_ID } },
  { name: "api_store_products", params: { p_store_slug: "fixture", p_country: "PL" } },
  { name: "api_product_health_warnings", params: { p_product_id: QA_PRODUCT_ID } },
];

describeIntegration("Retired consumer RPC boundaries", () => {
  it.each(RETIRED_RPCS)("$name returns only an explicit refresh-required contract", async ({ name, params }) => {
    const { data, error } = await supabase.rpc(name, params);
    expect(error).toBeNull();
    expect(RetiredPublicRpcSchema.safeParse(data).success).toBe(true);
  });
  it("legacy Home has no success-shaped statistics", async () => {
    const { data, error } = await supabase.rpc("api_get_dashboard_data");
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "refresh_required" });
    expect(data).not.toHaveProperty("stats");
  });
  it("legacy scan history requires refresh and returns no graded history", async () => {
    const { data, error } = await supabase.rpc("api_get_scan_history", { p_page: 1, p_page_size: 5, p_filter: "all" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ error: "refresh_required" });
    expect(data).not.toHaveProperty("items");
  });
});

function assertProtectedResponse<T>(data: unknown, contract: z.ZodType<T>) {
  // An observed unauthenticated refusal is a boundary assertion, not a claim
  // that a user's data contract was exercised or that absent data passed.
  if (data && typeof data === "object" && "error" in data) {
    expect(data.error).toMatch(/^Authentication required\.?$/);
    return;
  }
  expect(data).not.toBeNull();
  expect(contract.safeParse(data).success).toBe(true);
}

describeIntegration("Unchanged protected RPC payload or auth-refusal boundary", () => {
  it.each([
    { name: "api_get_saved_searches", contract: SavedSearchesContract },
    { name: "api_get_lists", contract: ListsContract },
    { name: "api_list_health_profiles", contract: HealthProfileListContract },
    { name: "api_get_active_health_profile", contract: HealthProfileActiveContract },
    { name: "api_get_user_preferences", contract: UserPreferencesContract },
  ])("$name does not silently accept null, malformed data or transport failure", async ({ name, contract }) => {
    const { data, error } = await supabase.rpc(name);
    expect(error).toBeNull();
    assertProtectedResponse(data, contract);
  });
});
