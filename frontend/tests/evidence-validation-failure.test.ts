import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { evidenceProduct } from "@/components/evidence/product-evidence.fixtures";
import { ProductReadModelSchema } from "@/lib/evidence/product-read-model";
import { callValidatedRpc } from "@/lib/rpc";

it.each(["", "not a URL", "https://", "http://example.org", "https://user:secret@example.org"])("rejects malformed or disallowed source URL %s without throwing", (url) => {
  const product = evidenceProduct();
  product.sources[0].source_url = url;
  expect(ProductReadModelSchema.safeParse(product).success).toBe(false);
});

it("sanitizes parser exceptions without logging the payload or exception", async () => {
  const client = { rpc: vi.fn().mockResolvedValue({ data: { private: "private payload" }, error: null }) } as unknown as SupabaseClient;
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  const warnLog = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const schema = { safeParse: () => { throw new Error("private parser exception"); } };
    await expect(callValidatedRpc(client, "api_fixture", schema)).resolves.toEqual({ ok: false, error: { code: "CONTRACT_MISMATCH", message: "Product information could not be validated. Please try again." } });
    expect(errorLog).not.toHaveBeenCalled();
    expect(warnLog).not.toHaveBeenCalled();
  } finally {
    errorLog.mockRestore();
    warnLog.mockRestore();
  }
});

it("sanitizes asynchronous validator or schema-loading failure", async () => {
  const client = { rpc: vi.fn().mockResolvedValue({ data: {}, error: null }) } as unknown as SupabaseClient;
  const schema = { safeParse: async () => { throw new Error("schema chunk unavailable"); } };
  await expect(callValidatedRpc(client, "api_fixture", schema)).resolves.toMatchObject({ ok: false, error: { code: "CONTRACT_MISMATCH" } });
});
