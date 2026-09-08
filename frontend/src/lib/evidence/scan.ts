import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod/mini";
import { EvidenceInteger } from "./integer";
import { callValidatedRpc } from "@/lib/rpc";
import { EVIDENCE_POLICY_VERSION, ProductReadModelSchema } from "./product-read-model";

const base = { api_version: z.literal("2"), policy_version: z.literal(EVIDENCE_POLICY_VERSION), scan_country: z.nullable(z.enum(["PL", "DE"])) };
export const EvidenceScanSchema = z.pipe(z.discriminatedUnion("found", [
  z.object({ ...base, found: z.literal(true), product: ProductReadModelSchema }),
  z.object({ ...base, found: z.literal(false), ean: z.string().check(z.regex(/^(?:[0-9]{8}|[0-9]{13})$/)), has_pending_submission: z.boolean() }),
]), z.transform((data) => data.found ? {
  ...data, product_id: data.product.product_id, product_name: data.product.product_name,
  product_name_display: data.product.product_name, brand: data.product.brand,
  product_country: data.product.country,
  is_cross_country: data.scan_country !== null && data.scan_country !== data.product.country,
} : data));
export type EvidenceScanResponse = z.infer<typeof EvidenceScanSchema>;
export type EvidenceScanFound = Extract<EvidenceScanResponse, { found: true }>;
export function recordEvidenceScan(client: SupabaseClient, ean: string, country?: string) {
  return callValidatedRpc(client, "api_record_scan_v2", EvidenceScanSchema, { p_ean: ean, p_scan_country: country ?? null });
}

export const ScanHistoryEvidenceSchema = z.object({
  api_version: z.literal("2"), policy_version: z.literal(EVIDENCE_POLICY_VERSION),
  total: EvidenceInteger.check(z.nonnegative()), page: EvidenceInteger.check(z.positive()), pages: EvidenceInteger.check(z.positive()),
  page_size: EvidenceInteger.check(z.minimum(1)).check(z.maximum(50)), filter: z.enum(["all", "found", "not_found"]),
  scans: z.array(z.object({
    scan_id: z.uuid(), ean: z.string(), found: z.boolean(), scanned_at: z.iso.datetime({ offset: true }),
    product_id: z.nullable(EvidenceInteger.check(z.positive())), product_name: z.nullable(z.string()),
    brand: z.nullable(z.string()), category: z.nullable(z.string()), submission_status: z.nullable(z.string()),
  })).check(z.maxLength(50)),
}).check(z.refine((data) => data.scans.length <= data.page_size && data.scans.length <= data.total, "Invalid history count"));
export type EvidenceScanHistoryItem = z.infer<typeof ScanHistoryEvidenceSchema>["scans"][number];
export function getEvidenceScanHistory(client: SupabaseClient, page = 1, pageSize = 20, filter = "all") {
  return callValidatedRpc(client, "api_get_scan_history_v2", ScanHistoryEvidenceSchema, { p_page: page, p_page_size: pageSize, p_filter: filter });
}
