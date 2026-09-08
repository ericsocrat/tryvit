import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProductReadModels, evidenceQueryKeys } from "./api";

vi.mock("../query-observer", () => ({ observeQuery: vi.fn() }));
const rpc = vi.fn();
const client = { rpc } as unknown as SupabaseClient;
beforeEach(() => { rpc.mockReset(); });

describe("evidence API boundary", () => {
  it.each([[0], [-1], [1.5], [Number.NaN], [Number.MAX_SAFE_INTEGER + 1], Array.from({ length: 101 }, (_, i) => i + 1)].map((ids) => ({ ids })))("rejects invalid or oversized selections before transport: $ids", async ({ ids }) => {
    expect((await getProductReadModels(client, ids, "en")).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("validates a complete empty envelope rather than inventing a product", async () => {
    rpc.mockResolvedValue({ error: null, data: { api_version: "2", policy_version: "evidence-first-v1", products: [], missing_ids: [628] } });
    expect((await getProductReadModels(client, [628, 628], "pl")).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("api_product_read_model", { p_product_ids: [628], p_language: "pl" });
  });
  it.each([null, {}, { api_version: "1", products: [] }, { api_version: "2", policy_version: "evidence-first-v1", products: [{ score: 96 }], missing_ids: [] }])("fails closed on malformed data", async (data) => {
    rpc.mockResolvedValue({ error: null, data });
    const result = await getProductReadModels(client, [628], "en");
    expect(result).toEqual({ ok: false, error: { code: "CONTRACT_MISMATCH", message: "Product information could not be validated. Please try again." } });
  });
  it("retains transport failure as failure", async () => {
    rpc.mockResolvedValue({ error: { code: "503", message: "Unavailable" }, data: null });
    expect((await getProductReadModels(client, [628], "en")).ok).toBe(false);
  });
  it("keys language-dependent reads separately without embedding user data", () => {
    expect(evidenceQueryKeys.products([628], "en")).not.toEqual(evidenceQueryKeys.products([628], "pl"));
    expect(evidenceQueryKeys.products([628, 628], "en")).toEqual(evidenceQueryKeys.products([628], "en"));
  });
});
