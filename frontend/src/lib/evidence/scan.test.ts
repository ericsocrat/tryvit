import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evidenceProduct } from "@/components/evidence/product-evidence.fixtures";
import { EvidenceScanSchema, recordEvidenceScan, ScanHistoryEvidenceSchema } from "./scan";
const rpc = vi.fn();
const client = { rpc } as unknown as SupabaseClient;
beforeEach(() => rpc.mockReset());
describe("canonical scan contract", () => {
  it("validates history counts and strips historical grade fields from a v2 read", () => {
    const row = { scan_id: "eeeeeeee-5555-4555-8555-555555555555", ean: "5901234123457", found: true,
      scanned_at: "2026-09-05T12:00:00Z", product_id: 1, product_name: "Fixture", brand: null, category: null,
      submission_status: null, unhealthiness_score: 4, nutri_score: "A" };
    const data = { api_version: "2", policy_version: "evidence-first-v1", total: 1, page: 1, pages: 1, page_size: 20, filter: "all", scans: [row] };
    expect(ScanHistoryEvidenceSchema.parse(data).scans[0]).not.toHaveProperty("unhealthiness_score");
    expect(ScanHistoryEvidenceSchema.safeParse({ ...data, total: 0 }).success).toBe(false);
    expect(ScanHistoryEvidenceSchema.safeParse({ ...data, scans: [{ ...row, scanned_at: "invalid" }] }).success).toBe(false);
  });
  it("derives identity and cross-market disclosure from the canonical product", () => {
    const data = EvidenceScanSchema.parse({ api_version: "2", policy_version: "evidence-first-v1", found: true, product: evidenceProduct(5), scan_country: "DE" });
    expect(data).toMatchObject({ found: true, product_id: 5, product_country: "PL", is_cross_country: true });
    expect(data).not.toHaveProperty("unhealthiness_score");
    expect(data).not.toHaveProperty("nutri_score");
  });
  it.each([{}, { found: true }, { api_version: "1.0", found: true, unhealthiness_score: 4 }, { ok: false }])("rejects incomplete or retired success payloads", async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    expect((await recordEvidenceScan(client, "5901234123457", "PL")).ok).toBe(false);
  });
  it("preserves a real not-found result without inventing a product or warning clearance", () => {
    const data = { api_version: "2", policy_version: "evidence-first-v1", found: false, ean: "5901234123457", scan_country: "PL", has_pending_submission: false };
    expect(EvidenceScanSchema.parse(data)).toEqual(data);
  });
  it("propagates transport failure rather than treating it as a lookup miss", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "503", message: "Unavailable" } });
    expect((await recordEvidenceScan(client, "5901234123457", "PL")).ok).toBe(false);
    expect(rpc).toHaveBeenCalledWith("api_record_scan_v2", { p_ean: "5901234123457", p_scan_country: "PL" });
  });
});
