import { describe, expect, it } from "vitest";
import { z as classicZod } from "zod";
import { EvidenceInteger } from "@/lib/evidence/integer";
import * as product from "@/lib/evidence/product-read-model";
import * as home from "@/lib/evidence/home-schema";
import { EmptyHomeReadModelSchema } from "@/lib/evidence/home-common";
import * as search from "@/lib/evidence/search";
import * as collections from "@/lib/evidence/collections";
import * as scan from "@/lib/evidence/scan";
import * as classicProduct from "./fixtures/classic-evidence/product-read-model";
import * as classicHome from "./fixtures/classic-evidence/home";
import * as classicSearch from "./fixtures/classic-evidence/search";
import * as classicCollections from "./fixtures/classic-evidence/collections";
import * as classicScan from "./fixtures/classic-evidence/scan";
import { evidenceProduct, legacyProduct } from "@/components/evidence/product-evidence.fixtures";
import { homeFixture, emptyHomeFixture } from "@/lib/evidence/home.fixtures";
import { savedListFixture, watchedFixture } from "@/lib/evidence/collections.fixtures";

type Schema = { safeParse(value: unknown): { success: true; data: unknown } | { success: false } };
const version = { api_version: "2", policy_version: "evidence-first-v1" };
const positive = evidenceProduct();
const sourceId = positive.sources[0].observation_id;
positive.allergens = { state: "recorded", contains: [{ name: "milk", state: "recorded", observation_id: sourceId }], traces: [] };
positive.image = { url: "https://example.org/image", source: "Fixture", alt: "Fixture", state: "recorded", observation_id: sourceId, source_key: "fixture-source" };
const warnedHome = homeFixture();
warnedHome.saved_allergen_matches = { state: "checked", count: 1, includes_traces: false, products: [{ product_id: 1, product: positive, matches: [{ allergen: "milk", kind: "contains", state: "recorded", observation_id: sourceId }] }] };
const cases: [string, Schema, Schema, unknown][] = [
  ["product", product.ProductReadModelSchema, classicProduct.ProductReadModelSchema, positive],
  ["legacy", product.ProductReadModelSchema, classicProduct.ProductReadModelSchema, legacyProduct()],
  ["envelope", product.ProductReadEnvelopeSchema, classicProduct.ProductReadEnvelopeSchema, { ...version, products: [positive], missing_ids: [2] }],
  ["home", home.HomeReadModelSchema, classicHome.HomeReadModelSchema, warnedHome],
  ["home unassessed", home.HomeReadModelSchema, classicHome.HomeReadModelSchema, homeFixture()],
  ["empty Home subset", EmptyHomeReadModelSchema, classicHome.HomeReadModelSchema, emptyHomeFixture()],
  ["filters", search.FindFiltersSchema, classicSearch.FindFiltersSchema, { category: ["Dairy"], nova_group: ["1"], allergen_free: ["milk"], country: "PL", sort_by: "name", sort_order: "asc" }],
  ["find", search.FindEnvelopeSchema, classicSearch.FindEnvelopeSchema, { ...version, query: "milk", country: "PL", language: "en", total: 1, page: 1, pages: 1, page_size: 20, filters_applied: {}, preferences_applied: true, results: [positive] }],
  ["saved", collections.SavedListSchema, classicCollections.SavedListSchema, savedListFixture()],
  ["watched", collections.WatchedProductsSchema, classicCollections.WatchedProductsSchema, watchedFixture()],
  ["scan found", scan.EvidenceScanSchema, classicScan.EvidenceScanSchema, { ...version, found: true, product: positive, scan_country: "DE" }],
  ["scan absent", scan.EvidenceScanSchema, classicScan.EvidenceScanSchema, { ...version, found: false, ean: "5901234123457", scan_country: "PL", has_pending_submission: false }],
  ["history", scan.ScanHistoryEvidenceSchema, classicScan.ScanHistoryEvidenceSchema, { ...version, total: 1, page: 1, pages: 1, page_size: 20, filter: "all", scans: [{ scan_id: sourceId, ean: "5901234123457", found: true, scanned_at: "2026-09-05T12:00:00Z", product_id: 1, product_name: "Fixture", brand: null, category: null, submission_status: null }] }],
];

/** Frozen pre-migration classic contracts are a test-only independent oracle.
 * At every nested field: delete it, change its type/value, and probe numeric,
 * length, provenance, date, URL, unknown-key and duplicate-array boundaries.
 * Compare accepted parsed output too, including stripping and scan transforms.
 */
function* mutations(value: unknown): Generator<unknown> {
  yield value;
  yield undefined; yield null; yield false; yield 0; yield {}; yield [];
  const replacements = [undefined, null, true, false, -1, 0, 1, 1.5, 9, 10, 50, 51, 100, 101, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "", "invalid", "0", "0.001", "-1", "1e3", "x".repeat(257), "22222222-2222-4222-8222-222222222222", "2026-10-01T00:00:00Z", "2026-09-01T12:00:00+02:00", "http://example.org", "https://user:pass@example.org", [], {}];
  function* walk(node: unknown, path: string[]): Generator<unknown> {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      const childPath = [...path, key];
      for (const replacement of replacements) {
        const copy = structuredClone(value);
        let parent = copy as Record<string, unknown>;
        for (const segment of path) parent = parent[segment] as Record<string, unknown>;
        parent[key] = replacement;
        yield copy;
      }
      const missing = structuredClone(value);
      let parent = missing as Record<string, unknown>;
      for (const segment of path) parent = parent[segment] as Record<string, unknown>;
      delete parent[key];
      yield missing;
      yield* walk(child, childPath);
    }
    const copy = structuredClone(value);
    let target = copy as Record<string, unknown>;
    for (const segment of path) target = target[segment] as Record<string, unknown>;
    if (Array.isArray(target) && target.length) target.push(...Array.from({ length: 101 }, () => structuredClone(target[0])));
    else target.unexpected_field = "must strip or reject as before";
    yield copy;
  }
  yield* walk(value, []);
}

describe("Zod Mini preserves the classic evidence contract", () => {
  it("preserves signed safe integers independently of field-specific ranges", () => {
    const classic = classicZod.int();
    for (const value of [Number.MIN_SAFE_INTEGER - 1, Number.MIN_SAFE_INTEGER, -1, -0, 0, 1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 0.1, NaN, Infinity, -Infinity, "1", null, undefined, true, 1n, Object(1)]) {
      const expected = classic.safeParse(value), actual = EvidenceInteger.safeParse(value);
      expect(actual.success).toBe(expected.success);
      if (actual.success && expected.success) expect(actual.data).toBe(expected.data);
    }
  });
  it.each([0, -0, 1, Number.MAX_SAFE_INTEGER])("preserves the safe count boundary for %s", (count) => {
    const value = emptyHomeFixture();
    value.stats.total_scanned = count;
    expect(EmptyHomeReadModelSchema.parse(value)).toEqual(classicHome.HomeReadModelSchema.parse(value));
  });
  it.each([false, true, "1", null, undefined, -1, 1.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MIN_VALUE, Number.MAX_VALUE, 1n, Object(1)])("rejects invalid count %s through both Zod contracts", (count) => {
    const value = { ...emptyHomeFixture(), stats: { ...emptyHomeFixture().stats, total_scanned: count } };
    expect(EmptyHomeReadModelSchema.safeParse(value).success).toBe(false);
    expect(classicHome.HomeReadModelSchema.safeParse(value).success).toBe(false);
  });
  it("never accepts product-bearing Home payloads through the empty subset", () => {
    expect(EmptyHomeReadModelSchema.safeParse(homeFixture()).success).toBe(false);
    for (const field of ["recently_viewed", "favorites_preview"] as const) {
      const value = emptyHomeFixture();
      Object.assign(value, { [field]: [homeFixture()[field][0]] });
      expect(EmptyHomeReadModelSchema.safeParse(value).success).toBe(false);
    }
    const value = emptyHomeFixture();
    value.saved_allergen_matches = warnedHome.saved_allergen_matches;
    expect(EmptyHomeReadModelSchema.safeParse(value).success).toBe(false);
  });
  it.each(cases)("%s accepts/rejects and parses the same mutation corpus", (_name, mini, classic, fixture) => {
    expect(classic.safeParse(fixture).success).toBe(true);
    let count = 0;
    for (const candidate of mutations(fixture)) {
      const parse = (schema: Schema) => {
        try { return { ...schema.safeParse(candidate), threw: null }; }
        catch (error) { return { success: false as const, threw: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }; }
      };
      const expected = parse(classic);
      const actual = parse(mini);
      // Classic's URL refinement throws for malformed URLs. Mini deliberately
      // turns that existing failure into a normal, sanitized contract rejection.
      expect(actual.threw, `mutation ${count}`).toBeNull();
      if (expected.threw) expect(expected.threw).toBe("TypeError: Invalid URL");
      expect(actual.success, `mutation ${count}`).toBe(expected.success);
      if (actual.success && expected.success) expect(actual.data).toEqual(expected.data);
      count++;
    }
    expect(count).toBeGreaterThan(100);
  }, 30_000);
});
