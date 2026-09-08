import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ALLERGEN_TAGS } from "@/lib/constants";
import type { UserPreferences } from "@/lib/types";
import { callValidatedRpc } from "@/lib/rpc";
import { EVIDENCE_POLICY_VERSION, ProductReadModelSchema } from "./product-read-model";

const Values = z.array(z.string().min(1).max(100)).max(30);
export const FindFiltersSchema = z.object({
  category: Values.optional(), nova_group: z.array(z.enum(["1", "2", "3", "4"])).max(4).optional(),
  allergen_free: Values.refine((values) => values.every((value) => ALLERGEN_TAGS.some((tag) => tag.tag === value))).optional(),
  country: z.enum(["PL", "DE"]).optional(), sort_by: z.enum(["relevance", "name"]).optional(), sort_order: z.enum(["asc", "desc"]).optional(),
}).strict();
export type FindFilters = z.infer<typeof FindFiltersSchema>;
export interface FindRequest { q: string; filters: FindFilters; page: number; showAvoided: boolean; }
export type FindProblem = "unsupported_filters" | "invalid_filters" | "invalid_query" | "invalid_page";
export const FindEnvelopeSchema = z.object({
  api_version: z.literal("2"), policy_version: z.literal(EVIDENCE_POLICY_VERSION), query: z.string().nullable(),
  country: z.enum(["PL", "DE"]), language: z.enum(["en", "pl", "de"]),
  total: z.number().int().nonnegative(), page: z.number().int().positive(), pages: z.number().int().positive(), page_size: z.number().int().min(1).max(50),
  filters_applied: FindFiltersSchema, preferences_applied: z.boolean(), results: z.array(ProductReadModelSchema),
});
export type FindEnvelope = z.infer<typeof FindEnvelopeSchema>;

const FILTER_KEYS = new Set(["category", "nova_group", "allergen_free", "country", "sort_by", "sort_order"]);
const PARAM_KEYS = new Set(["q", "filters", "category", "nova_group", "allergen_free", "country", "sort", "order", "page", "show_avoided", "panel"]);

/** Old saved JSON filters remain stored; this parser never writes a saved record. */
export function parseFindParams(params: URLSearchParams): { request: FindRequest; problems: FindProblem[] } {
  const problems = new Set<FindProblem>();
  const candidate: Record<string, unknown> = {};
  const raw = params.get("filters");
  if (raw) {
    try {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) problems.add("invalid_filters");
      else for (const [key, entry] of Object.entries(value)) {
        if (FILTER_KEYS.has(key)) candidate[key] = entry;
        else problems.add("unsupported_filters");
      }
    } catch { problems.add("invalid_filters"); }
  }
  for (const key of ["category", "nova_group", "allergen_free"] as const) {
    if (params.has(key)) candidate[key] = [...new Set(params.getAll(key))];
  }
  if (Array.isArray(candidate.allergen_free)) candidate.allergen_free = candidate.allergen_free.map((value: unknown) => typeof value === "string" ? value.replace(/^en:/, "") : value);
  for (const [parameter, filter] of [["country", "country"], ["sort", "sort_by"], ["order", "sort_order"]] as const) {
    if (params.has(parameter)) candidate[filter] = params.get(parameter);
  }
  for (const key of params.keys()) if (!PARAM_KEYS.has(key) && !key.startsWith("utm_")) problems.add("unsupported_filters");
  if (params.has("show_avoided") && !["true", "false"].includes(params.get("show_avoided") ?? "")) problems.add("invalid_filters");
  const filters: FindFilters = {};
  for (const [key, value] of Object.entries(candidate)) {
    const parsed = FindFiltersSchema.safeParse({ [key]: value });
    if (parsed.success) Object.assign(filters, parsed.data);
    else problems.add(key === "sort_by" ? "unsupported_filters" : "invalid_filters");
  }
  const q = (params.get("q") ?? "").trim();
  if (q.length > 200) problems.add("invalid_query");
  const rawPage = params.get("page") ?? "1";
  const validPage = /^[1-9][0-9]*$/.test(rawPage) && Number(rawPage) <= 10000;
  if (!validPage) problems.add("invalid_page");
  return { request: { q: q.slice(0, 200), filters, page: validPage ? Number(rawPage) : 1, showAvoided: params.get("show_avoided") === "true" }, problems: [...problems] };
}

export function findHref(request: FindRequest, panel?: "categories" | "filters"): string {
  const params = new URLSearchParams();
  if (request.q.trim()) params.set("q", request.q.trim());
  for (const key of ["category", "nova_group", "allergen_free"] as const) for (const value of request.filters[key] ?? []) params.append(key, value);
  if (request.filters.country) params.set("country", request.filters.country);
  if (request.filters.sort_by && request.filters.sort_by !== "relevance") params.set("sort", request.filters.sort_by);
  if (request.filters.sort_order && request.filters.sort_by === "name") params.set("order", request.filters.sort_order);
  if (request.page > 1) params.set("page", String(request.page));
  if (request.showAvoided) params.set("show_avoided", "true");
  if (panel) params.set("panel", panel);
  return `/app/search${params.size ? `?${params.toString()}` : ""}`;
}

export function findContext(preferences: UserPreferences, language: string, avoidedIds: readonly number[] = []) {
  return {
    user: preferences.user_id, country: preferences.country, language, version: preferences.updated_at,
    diet: preferences.diet_preference, allergens: [...preferences.avoid_allergens].sort(),
    strictDiet: preferences.strict_diet, strictAllergen: preferences.strict_allergen, traces: preferences.treat_may_contain_as_unsafe,
    avoided: [...avoidedIds].sort((a, b) => a - b),
  };
}
export const findQueryKeys = {
  results: (request: FindRequest, context: ReturnType<typeof findContext> | null) => ["evidence-find-v2", request, context] as const,
  filters: (country: string, language: string, user: string) => ["evidence-find-filters-v2", { country, language, user }] as const,
};

export function findProducts(client: SupabaseClient, request: FindRequest, language: string, country: string) {
  return callValidatedRpc(client, "api_find_products", FindEnvelopeSchema, {
    p_query: request.q || null, p_filters: { ...request.filters, country: request.filters.country ?? country },
    p_page: request.page, p_page_size: 20, p_show_avoided: request.showAvoided, p_language: language,
  });
}

const FilterOptionsSchema = z.object({ api_version: z.literal("2"), country: z.enum(["PL", "DE"]), language: z.enum(["en", "pl", "de"]), categories: z.array(z.object({ value: z.string(), label: z.string(), slug: z.string().min(1) })) });
export function findFilterOptions(client: SupabaseClient, country: string | null, language: string) {
  return callValidatedRpc(client, "api_find_filter_options", FilterOptionsSchema, { p_country: country, p_language: language });
}
