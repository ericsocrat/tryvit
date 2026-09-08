import { describe, expect, it } from "vitest";
import { RetiredPublicRpcSchema } from "./retired-public-rpc";
const retired = { api_version: "2", policy_version: "evidence-first-v1", error: "refresh_required", status: "refresh_required", message: "Refresh TryVit to use source-backed product evidence." };
describe("retired public RPC contract", () => {
  it("requires an explicit refresh failure, not a success-shaped empty payload", () => {
    expect(RetiredPublicRpcSchema.safeParse(retired).success).toBe(true);
    for (const payload of [null, {}, { products: [] }, { ...retired, error: undefined }, { ...retired, status: "ok" }]) expect(RetiredPublicRpcSchema.safeParse(payload).success).toBe(false);
  });
  it("rejects current scores, reassuring defaults or historical data riding along", () => {
    for (const extra of [{ score: 0 }, { healthy: true }, { products: [] }, { confidence: 100 }]) expect(RetiredPublicRpcSchema.safeParse({ ...retired, ...extra }).success).toBe(false);
  });
});
