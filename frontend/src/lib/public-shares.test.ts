import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPublicSharedList, readPublicSharedComparison, readPublicSharedList } from "@/lib/public-shares";
import { evidenceProduct, legacyProduct } from "@/components/evidence/product-evidence.fixtures";

const token = "aaaabbbbccccddddeeeeffff";
const list = () => ({ api_version: "2", policy_version: "evidence-first-v1", kind: "list", title: "Shared selection", total_count: 1, unavailable_count: 0, limit: 50, offset: 0, products: [legacyProduct()] });
const comparison = () => ({ api_version: "2", policy_version: "evidence-first-v1", kind: "comparison", title: null, product_count: 2, unavailable_count: 0, products: [evidenceProduct(1), evidenceProduct(2)] });
const mockResponse = (data: unknown) => ({ ok: true, json: async () => data });
beforeEach(() => {
  vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("token-gated public v2 reads", () => {
  it("does not contact the backend in demo mode", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "demo");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await readPublicSharedList(token)).toEqual({ status: "unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the anonymous v2 RPC with language, bounded page and no caching", async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse(list())); vi.stubGlobal("fetch", fetch);
    expect((await readPublicSharedList(token, "pl", 50)).status).toBe("ok");
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:55001/rest/v1/rpc/api_get_shared_list_v2", expect.objectContaining({ method: "POST", cache: "no-store" }));
    const options = fetch.mock.calls[0][1];
    expect(JSON.parse(options.body)).toEqual({ p_share_token: token, p_language: "pl", p_limit: 50, p_offset: 50 });
    expect(options).not.toHaveProperty("next");
    expect(options.signal).toBeDefined();
  });
  it("accepts source-backed and explicitly unverified products without score fallbacks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(comparison())));
    const result = await readPublicSharedComparison(token);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.data.products[0].score.value).toBeNull();
  });
  it("honors revocation on the next read instead of caching user content", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(mockResponse(list())).mockResolvedValueOnce(mockResponse({ api_version: "2", error: "invalid_share" }));
    vi.stubGlobal("fetch", fetch);
    expect((await readPublicSharedList(token)).status).toBe("ok");
    expect(await readPublicSharedList(token)).toEqual({ status: "invalid" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([null, {}, { ...list(), user_id: "private-owner" }, { ...list(), description: "private notes" }, { ...list(), products: [null] }, { ...list(), api_version: "1" }])("rejects malformed/overexposed envelopes", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(payload)));
    expect(await readPublicSharedList(token)).toEqual({ status: "unavailable" });
  });
  it("rejects a numeric retired score", async () => {
    const payload = comparison();
    payload.products[0] = { ...payload.products[0], score: { ...payload.products[0].score, value: 96 } } as never;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(payload)));
    expect(await readPublicSharedComparison(token)).toEqual({ status: "unavailable" });
  });
  it.each([{ api_version: "2", error: "temporary_backend_failure" }, { api_version: "1", error: "invalid_share" }, { api_version: "2", error: "share_client_refresh_required" }])("does not mislabel service/contract failure as invalid token", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(payload)));
    expect(await readPublicSharedList(token)).toEqual({ status: "unavailable" });
  });
  it("handles network and non-success HTTP failures without logging a token", async () => {
    const log = vi.spyOn(console, "error");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await readPublicSharedComparison(token)).toEqual({ status: "unavailable" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchPublicSharedList(token)).toBeNull();
    expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
  it.each(["", "short", "x".repeat(129), "a".repeat(23) + " "])("rejects malformed tokens before fetch", async (bad) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await readPublicSharedList(bad)).toEqual({ status: "invalid" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("preserves existing base64 tokens and rejects invalid pagination", async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse(list())); vi.stubGlobal("fetch", fetch);
    expect((await readPublicSharedList("a".repeat(22) + "+/")).status).toBe("ok");
    expect(await readPublicSharedList(token, "en", -1)).toEqual({ status: "unavailable" });
    expect(await readPublicSharedList(token, "xx")).toEqual({ status: "unavailable" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
