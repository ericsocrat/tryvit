import "server-only";
import { z } from "zod";
import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import { EVIDENCE_POLICY_VERSION, ProductReadModelSchema } from "@/lib/evidence/product-read-model";

const Token = z.string().regex(/^[-A-Za-z0-9+/_=]{16,128}$/);
const Language = z.enum(["en", "pl", "de"]);
const common = {
  api_version: z.literal("2"),
  policy_version: z.literal(EVIDENCE_POLICY_VERSION),
  title: z.string().max(500).nullable(),
  unavailable_count: z.number().int().nonnegative(),
  products: z.array(ProductReadModelSchema),
};
export const PublicListSchema = z.object({
  ...common, kind: z.literal("list"), total_count: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(50), offset: z.number().int().min(0).max(10_000),
}).strict().superRefine((list, context) => {
  if (list.products.length > list.limit || list.products.length > list.total_count ||
      new Set(list.products.map((product) => product.product_id)).size !== list.products.length) {
    context.addIssue({ code: "custom", message: "Invalid shared-list page" });
  }
});
export const PublicComparisonSchema = z.object({
  ...common, kind: z.literal("comparison"), product_count: z.number().int().min(0).max(4),
}).strict().superRefine((comparison, context) => {
  if (comparison.product_count !== comparison.products.length ||
      comparison.product_count + comparison.unavailable_count > 4 ||
      new Set(comparison.products.map((product) => product.product_id)).size !== comparison.products.length) {
    context.addIssue({ code: "custom", message: "Invalid shared comparison" });
  }
});
export type PublicSharedList = z.infer<typeof PublicListSchema>;
export type PublicSharedComparison = z.infer<typeof PublicComparisonSchema>;
export type PublicShareRead<T> =
  | { readonly status: "ok"; readonly data: T }
  | { readonly status: "invalid" }
  | { readonly status: "unavailable" };

type PublicShareRpc = "api_get_shared_list_v2" | "api_get_shared_comparison_v2";
async function fetchPublicRpc<T>(rpc: PublicShareRpc, body: Record<string, string | number>, schema: z.ZodType<T>): Promise<PublicShareRead<T>> {
  if (getDeploymentReadiness().dataBackend !== "available") return { status: "unavailable" };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: "unavailable" };
  try {
    const response = await fetch(`${url.replace(/\/$/u, "")}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      // A token is a revocable capability. Never store its contents in a
      // cross-request Next/CDN cache or include it in diagnostic output.
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { status: "unavailable" };
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && "error" in payload) {
      return "api_version" in payload && payload.api_version === "2" && payload.error === "invalid_share" ? { status: "invalid" } : { status: "unavailable" };
    }
    const parsed = schema.safeParse(payload);
    return parsed.success ? { status: "ok", data: parsed.data } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

/** One token-gated page; no owner identity, notes, description or legacy score. */
export function readPublicSharedList(token: string, language = "en", offset = 0): Promise<PublicShareRead<PublicSharedList>> {
  if (!Token.safeParse(token).success) return Promise.resolve({ status: "invalid" });
  if (!Language.safeParse(language).success || !Number.isSafeInteger(offset) || offset < 0 || offset > 10_000) return Promise.resolve({ status: "unavailable" });
  return fetchPublicRpc("api_get_shared_list_v2", { p_share_token: token, p_language: language, p_limit: 50, p_offset: offset }, PublicListSchema);
}
export function readPublicSharedComparison(token: string, language = "en"): Promise<PublicShareRead<PublicSharedComparison>> {
  if (!Token.safeParse(token).success) return Promise.resolve({ status: "invalid" });
  if (!Language.safeParse(language).success) return Promise.resolve({ status: "unavailable" });
  return fetchPublicRpc("api_get_shared_comparison_v2", { p_share_token: token, p_language: language }, PublicComparisonSchema);
}

/** Compatibility helpers for server callers; no fallback to a legacy contract. */
export function fetchPublicSharedList(token: string, language = "en"): Promise<PublicSharedList | null> {
  return readPublicSharedList(token, language).then((result) => result.status === "ok" ? result.data : null);
}
export function fetchPublicSharedComparison(token: string, language = "en"): Promise<PublicSharedComparison | null> {
  return readPublicSharedComparison(token, language).then((result) => result.status === "ok" ? result.data : null);
}
