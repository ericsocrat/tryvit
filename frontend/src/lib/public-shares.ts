import { getDeploymentReadiness } from "@/lib/deployment-readiness";
import type { CompareProduct, SharedComparisonResponse, SharedListResponse } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isSharedListItem(value: unknown): value is SharedListResponse["items"][number] {
  return (
    isRecord(value) &&
    isFiniteNumber(value.product_id) &&
    isFiniteNumber(value.position) &&
    typeof value.product_name === "string" &&
    typeof value.brand === "string" &&
    typeof value.category === "string" &&
    isFiniteNumber(value.unhealthiness_score) &&
    typeof value.nutri_score_label === "string" &&
    (value.calories === null || isFiniteNumber(value.calories))
  );
}

function isSharedListResponse(value: unknown): value is SharedListResponse {
  return (
    isRecord(value) &&
    typeof value.api_version === "string" &&
    typeof value.list_name === "string" &&
    isNullableString(value.description) &&
    (value.list_type === "favorites" ||
      value.list_type === "avoid" ||
      value.list_type === "custom") &&
    Number.isInteger(value.total_count) &&
    isFiniteNumber(value.total_count) &&
    value.total_count >= 0 &&
    Number.isInteger(value.limit) &&
    isFiniteNumber(value.limit) &&
    value.limit >= 0 &&
    Number.isInteger(value.offset) &&
    isFiniteNumber(value.offset) &&
    value.offset >= 0 &&
    Array.isArray(value.items) &&
    value.items.length <= value.total_count &&
    value.items.every(isSharedListItem)
  );
}

function isCompareProduct(value: unknown): value is CompareProduct {
  if (!isRecord(value)) return false;

  const numericFields = [
    "product_id",
    "unhealthiness_score",
    "data_completeness_pct",
  ] as const;
  const nullableNumericFields = [
    "calories",
    "total_fat_g",
    "saturated_fat_g",
    "carbs_g",
    "sugars_g",
    "protein_g",
    "salt_g",
    "additives_count",
    "ingredient_count",
    "allergen_count",
  ] as const;
  const stringFields = [
    "product_name",
    "brand",
    "category",
    "category_display",
    "category_icon",
    "nova_group",
    "processing_risk",
    "confidence",
  ] as const;
  const booleanFields = ["high_salt", "high_sugar", "high_sat_fat", "high_additive_load"] as const;

  return (
    numericFields.every((field) => isFiniteNumber(value[field])) &&
    nullableNumericFields.every(
      (field) => value[field] === null || isFiniteNumber(value[field]),
    ) &&
    stringFields.every((field) => typeof value[field] === "string") &&
    booleanFields.every((field) => typeof value[field] === "boolean") &&
    isNullableString(value.ean) &&
    (value.score_band === "low" ||
      value.score_band === "moderate" ||
      value.score_band === "high" ||
      value.score_band === "very_high") &&
    (value.nutri_score === null ||
      value.nutri_score === "A" ||
      value.nutri_score === "B" ||
      value.nutri_score === "C" ||
      value.nutri_score === "D" ||
      value.nutri_score === "E") &&
    (value.trans_fat_g === null || isFiniteNumber(value.trans_fat_g)) &&
    (value.fibre_g === null || isFiniteNumber(value.fibre_g)) &&
    isNullableString(value.allergen_tags) &&
    isNullableString(value.trace_tags)
  );
}

function isSharedComparisonResponse(value: unknown): value is SharedComparisonResponse {
  return (
    isRecord(value) &&
    typeof value.api_version === "string" &&
    typeof value.comparison_id === "string" &&
    isNullableString(value.title) &&
    Number.isInteger(value.product_count) &&
    isFiniteNumber(value.product_count) &&
    value.product_count >= 0 &&
    typeof value.created_at === "string" &&
    Number.isFinite(Date.parse(value.created_at)) &&
    Array.isArray(value.products) &&
    value.products.length === value.product_count &&
    value.products.every(isCompareProduct)
  );
}

export type PublicShareRead<T> =
  | { readonly status: "ok"; readonly data: T }
  | { readonly status: "invalid" }
  | { readonly status: "unavailable" };

type PublicShareRpc = "api_get_shared_list" | "api_get_shared_comparison";

const INVALID_SHARE_ERRORS: Readonly<Record<PublicShareRpc, readonly string[]>> = {
  api_get_shared_list: ["shared list not found or link expired"],
  api_get_shared_comparison: ["comparison not found or link has expired"],
};

function isInvalidShareError(value: unknown, rpc: PublicShareRpc): boolean {
  if (!isRecord(value) || typeof value.error !== "string") return false;
  const normalizedError = value.error.trim().replace(/\s+/g, " ").toLowerCase();
  return INVALID_SHARE_ERRORS[rpc].includes(normalizedError);
}

async function fetchPublicRpc<T>(
  rpc: PublicShareRpc,
  body: Record<string, string>,
  validate: (value: unknown) => value is T,
): Promise<PublicShareRead<T>> {
  if (getDeploymentReadiness().dataBackend !== "available") return { status: "unavailable" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: "unavailable" };

  try {
    const response = await fetch(`${url}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      // Share revocation must take effect immediately; never retain token-gated
      // user content in the Next.js data cache.
      cache: "no-store",
    });

    if (!response.ok) return { status: "unavailable" };
    const payload: unknown = await response.json();
    // These two read-only RPCs use a documented HTTP-200 business error for a
    // missing, revoked, or expired token. Other error payloads, response-shape
    // drift, and transport failures are service failures, not proof that a
    // visitor's link is invalid.
    if (isInvalidShareError(payload, rpc)) return { status: "invalid" };
    if (isRecord(payload) && "error" in payload) return { status: "unavailable" };
    return validate(payload) ? { status: "ok", data: payload } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Read a public list with a truthful invalid-vs-unavailable result. */
export function readPublicSharedList(token: string): Promise<PublicShareRead<SharedListResponse>> {
  if (!token) return Promise.resolve({ status: "invalid" });
  return fetchPublicRpc<SharedListResponse>(
    "api_get_shared_list",
    { p_share_token: token },
    isSharedListResponse,
  );
}

/** Read a public comparison with a truthful invalid-vs-unavailable result. */
export function readPublicSharedComparison(
  token: string,
): Promise<PublicShareRead<SharedComparisonResponse>> {
  if (!token) return Promise.resolve({ status: "invalid" });
  return fetchPublicRpc<SharedComparisonResponse>(
    "api_get_shared_comparison",
    { p_share_token: token },
    isSharedComparisonResponse,
  );
}

/** Read a public list only when the deployment explicitly declares data ready. */
export function fetchPublicSharedList(token: string): Promise<SharedListResponse | null> {
  return readPublicSharedList(token).then((result) =>
    result.status === "ok" ? result.data : null,
  );
}

/** Read a public comparison only when the deployment explicitly declares data ready. */
export function fetchPublicSharedComparison(
  token: string,
): Promise<SharedComparisonResponse | null> {
  return readPublicSharedComparison(token).then((result) =>
    result.status === "ok" ? result.data : null,
  );
}
