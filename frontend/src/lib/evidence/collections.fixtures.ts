import { legacyProduct } from "@/components/evidence/product-evidence.fixtures";
import type { SavedListEnvelope, WatchedProductsEnvelope } from "./collections";

export const fixtureListId = "aaaaaaaa-1111-4111-8111-111111111111";
export function savedListFixture(): SavedListEnvelope {
  const archived = legacyProduct(2); archived.is_deprecated = true;
  return { api_version: "2", policy_version: "evidence-first-v1", list_id: fixtureListId, list_name: "Morning list", list_type: "custom", description: "Keep these notes", share_enabled: false, share_token: null, total_count: 2, limit: 20, offset: 0,
    items: [
      { item_id: "bbbbbbbb-1111-4111-8111-111111111111", product_id: 2, position: 10, notes: "Morning note", added_at: "2025-01-01T12:00:00Z", product: archived },
      { item_id: "bbbbbbbb-2222-4222-8222-222222222222", product_id: 1, position: 20, notes: "Second note", added_at: "2025-01-02T12:00:00Z", product: legacyProduct(1) },
    ],
  };
}
export function watchedFixture(): WatchedProductsEnvelope {
  const product = legacyProduct(1); product.is_deprecated = true;
  return { api_version: "2", policy_version: "evidence-first-v1", total: 1, page: 1, page_size: 20, total_pages: 1, items: [{ watch_id: 7, product_id: 1, watched_since: "2025-01-01T12:00:00Z", product }] };
}
