import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  RecordScanFoundResponse,
  RecordScanNotFoundResponse,
} from "@/lib/types";
import { describe, expect, expectTypeOf, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "..",
    "supabase",
    "migrations",
    "20260904150300_restore_region_preferred_scan_matching.sql",
  ),
  "utf8",
);

describe("scanner truth contract", () => {
  const regionPreferredResponse = {
    api_version: "1.0",
    found: true,
    product_id: 999991,
    product_name: "pgTAP Dual-EAN DE",
    product_name_en: null,
    product_name_display: "pgTAP Dual-EAN DE",
    brand: "Dual Brand",
    category: "pgtap-test-cat",
    category_display: "pgTAP Test",
    category_icon: "📦",
    unhealthiness_score: 30,
    nutri_score: "B",
    scan_country: "DE",
    product_country: "DE",
    is_cross_country: false,
  } satisfies RecordScanFoundResponse;

  const deprecatedOnlyResponse = {
    api_version: "1.0",
    found: false,
    ean: "4015000969611",
    has_pending_submission: false,
    scan_country: "PL",
  } satisfies RecordScanNotFoundResponse;

  it("keeps deprecated products out of deterministic region-preferred matching", () => {
    expect(migration).toContain("AND p.is_deprecated IS NOT TRUE");
    expect(migration).toMatch(
      /ORDER BY CASE\s+WHEN v_scan_country IS NOT NULL AND p\.country = v_scan_country THEN 0\s+ELSE 1\s+END,\s+p\.product_id/u,
    );
  });

  it("returns cross-country disposition without losing country-scoped pending lookup", () => {
    expect(migration).toContain("'is_cross_country'");
    expect(migration).toContain("v_product.country IS DISTINCT FROM v_scan_country");
    expect(migration).toContain("suggested_country = v_scan_country");
  });

  it("keeps scan-country and cross-country fields in the client response types", () => {
    expectTypeOf<RecordScanFoundResponse>().toHaveProperty("scan_country");
    expectTypeOf<RecordScanFoundResponse>().toHaveProperty("product_country");
    expectTypeOf<RecordScanFoundResponse>().toHaveProperty("is_cross_country");
    expectTypeOf<RecordScanNotFoundResponse>().toHaveProperty("scan_country");
    expect(regionPreferredResponse.is_cross_country).toBe(false);
    expect(deprecatedOnlyResponse.found).toBe(false);
  });
});
