import { evidenceProduct, legacyProduct } from "@/components/evidence/product-evidence.fixtures";
import type { HomeReadModel } from "./home";

export function homeFixture(): HomeReadModel {
  const first = evidenceProduct(1); first.product_name = "Lay's Classic"; first.brand = "Lay's";
  const second = legacyProduct(2); second.product_name = "Pepsi Max"; second.brand = "Pepsi";
  const saved = evidenceProduct(3); saved.product_name = "Activia Natural"; saved.brand = "Danone";
  return {
    api_version: "2", policy_version: "evidence-first-v1", language: "en", country: "PL",
    recently_viewed: [{ product_id: 1, viewed_at: "2026-09-03T12:00:00.000Z", product: first }, { product_id: 2, viewed_at: "2026-09-02T12:00:00.000Z", product: second }],
    favorites_preview: [{ product_id: 3, added_at: "2026-09-01T12:00:00.000Z", product: saved }],
    stats: { total_scanned: 42, total_viewed: 15, lists_count: 3, custom_lists_count: 1, favorites_count: 7 },
    saved_allergen_matches: { state: "not_configured", count: null, includes_traces: false, products: [] },
  };
}
export function emptyHomeFixture(): HomeReadModel {
  return { ...homeFixture(), recently_viewed: [], favorites_preview: [], stats: { total_scanned: 0, total_viewed: 0, lists_count: 2, custom_lists_count: 0, favorites_count: 0 } };
}
