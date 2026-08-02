import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPublicSharedComparison,
  fetchPublicSharedList,
  readPublicSharedComparison,
  readPublicSharedList,
} from "@/lib/public-shares";

const validListItem = {
  product_id: 1,
  position: 0,
  product_name: "Example product",
  brand: "Example brand",
  category: "Snacks",
  unhealthiness_score: 42,
  nutri_score_label: "C",
  calories: 123,
};

const validListPayload = {
  api_version: "1.0",
  list_name: "Shared",
  description: null,
  list_type: "custom",
  total_count: 1,
  limit: 50,
  offset: 0,
  items: [validListItem],
};

const validCompareProduct = {
  product_id: 1,
  ean: "5901234123457",
  product_name: "Example product",
  brand: "Example brand",
  category: "Snacks",
  category_display: "Snacks",
  category_icon: "📦",
  unhealthiness_score: 42,
  score_band: "moderate",
  nutri_score: "C",
  nova_group: "3",
  processing_risk: "moderate",
  calories: 123,
  total_fat_g: 4,
  saturated_fat_g: 1,
  trans_fat_g: null,
  carbs_g: 20,
  sugars_g: 3,
  fibre_g: null,
  protein_g: 5,
  salt_g: 0.4,
  high_salt: false,
  high_sugar: false,
  high_sat_fat: false,
  high_additive_load: false,
  additives_count: 0,
  ingredient_count: 4,
  allergen_count: 0,
  allergen_tags: null,
  trace_tags: null,
  confidence: "high",
  data_completeness_pct: 100,
};

const validComparisonPayload = {
  api_version: "1.0",
  comparison_id: "comparison-id",
  title: null,
  created_at: "2026-08-02T12:00:00Z",
  product_count: 1,
  products: [validCompareProduct],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public share reads", () => {
  it("does not contact Supabase in demo mode", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "demo");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicSharedList("list-token")).resolves.toBeNull();
    await expect(fetchPublicSharedComparison("comparison-token")).resolves.toBeNull();
    await expect(readPublicSharedList("list-token")).resolves.toEqual({
      status: "unavailable",
    });
    await expect(readPublicSharedComparison("comparison-token")).resolves.toEqual({
      status: "unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the existing anonymous RPC only in declared live mode", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validListPayload),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchPublicSharedList("safe-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:55001/rest/v1/rpc/api_get_shared_list",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty("next");
  });

  it("classifies the documented shared-list invalid-token business error", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            api_version: "1.0",
            error: "Shared list not found or link expired",
          }),
      }),
    );

    await expect(readPublicSharedList("expired-token")).resolves.toEqual({ status: "invalid" });
  });

  it("classifies the documented shared-comparison invalid-token business error", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            api_version: "1.0",
            error: "Comparison not found or link has expired",
          }),
      }),
    );

    await expect(readPublicSharedComparison("expired-token")).resolves.toEqual({
      status: "invalid",
    });
  });

  it("does not classify a similarly worded service error as an invalid link", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ api_version: "1.0", error: "Invalid backend configuration" }),
      }),
    );

    await expect(readPublicSharedList("safe-token")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("does not mislabel an unknown live RPC failure as an invalid link", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ api_version: "1", error: "Temporary read failure" }),
      }),
    );

    await expect(readPublicSharedList("safe-token")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("rejects a successful HTTP response with the wrong payload shape", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ api_version: "1", list_name: "Broken" }),
      }),
    );

    await expect(readPublicSharedList("broken-token")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("rejects malformed nested shared-list items", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...validListPayload, items: [null] }),
      }),
    );

    await expect(readPublicSharedList("broken-token")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("rejects malformed nested comparison products", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...validComparisonPayload, products: [null] }),
      }),
    );

    await expect(readPublicSharedComparison("broken-token")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("rejects unparseable comparison timestamps", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...validComparisonPayload, created_at: "not-a-date" }),
      }),
    );

    await expect(readPublicSharedComparison("broken-token")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("degrades on an unavailable live backend", async () => {
    vi.stubEnv("TRYVIT_DATA_BACKEND_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55001");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-public-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(readPublicSharedList("safe-token")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("rejects empty tokens before any request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPublicSharedList("")).resolves.toBeNull();
    await expect(readPublicSharedList("")).resolves.toEqual({ status: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
