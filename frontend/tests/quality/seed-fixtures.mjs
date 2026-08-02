/**
 * QA Fixture Seeder — Seeds deterministic test products into Supabase
 *
 * Creates synthetic products with full nutrition, allergen, and ingredient
 * data so the quality-gate Playwright tests have real rendered DOM to audit.
 *
 * Usage:
 *   npm run visual-safety:fixtures-seed
 *   npm run visual-safety:fixtures-teardown
 *
 * Outputs KEY=VALUE lines to stdout for CI to capture into $GITHUB_ENV.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY values
 * supplied in-memory by the guarded launcher after it verifies the configured
 * local runtime. Hosted, redirected, and wrong-port targets are rejected.
 *
 * Missing credentials are always a hard failure so fixture coverage can never
 * pass through a silent skip.
 *
 * Idempotent — safe to run multiple times (upserts on unique constraints).
 *
 * @see https://github.com/ericsocrat/tryvit/issues/553
 */

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import ws from "ws";

// Node's type-stripping loader is provided by the visual-safety launcher.
// @ts-expect-error TS source is intentionally imported by this guarded test tool.
import {
  canonicalizeLoopbackOrigin,
  createGuardedFetch,
  discoverLocalSupabaseOrigin,
} from "../../e2e/helpers/visual-safety.ts";

/* ── Environment ─────────────────────────────────────────────────────────── */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Canonical brand used by all QA fixtures. Centralised so the teardown path
// and any future tooling reference a single source of truth.
const QA_FIXTURE_BRAND = "QA Test Brand";

// Hard safety guard. These QA fixtures must NEVER be written to the production
// Supabase project. In June 2026 four fixtures leaked into the production
// catalog because the CI seed step fell back to the production URL when the
// staging secret was unset. The seeder now refuses to run against production,
// regardless of how the URL was resolved.
const PRODUCTION_PROJECT_REF = "uskvezwftkkudvksmken";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "❌ Missing guarded local fixture credentials. Use the visual-safety fixture launcher."
  );
  process.exit(1);
}

if (SUPABASE_URL.includes(PRODUCTION_PROJECT_REF)) {
  console.error(
    `❌ Refusing to seed QA fixtures against the production project ` +
      `(${PRODUCTION_PROJECT_REF}). QA fixtures must only target a ` +
      `verified local Supabase instance.`
  );
  console.error(
    "    Resolved NEXT_PUBLIC_SUPABASE_URL points at production. " +
      "Use the guarded local fixture launcher instead."
  );
  process.exit(1);
}

if (process.env.VISUAL_SAFETY_MODE !== "local-authenticated") {
  console.error("❌ QA fixtures require explicit local-authenticated safety mode.");
  process.exit(1);
}

let requestedOrigin;
let configuredOrigin;
try {
  requestedOrigin = canonicalizeLoopbackOrigin(SUPABASE_URL).origin;
  configuredOrigin = (
    await discoverLocalSupabaseOrigin(
      fileURLToPath(new URL("../../../supabase/config.toml", import.meta.url)),
    )
  ).origin;
} catch {
  console.error("❌ QA fixture target is not the configured canonical loopback runtime.");
  process.exit(1);
}

if (requestedOrigin !== configuredOrigin) {
  console.error("❌ QA fixture target does not match the configured local API origin.");
  process.exit(1);
}

const guardedFetch = createGuardedFetch({
  allowedOrigin: configuredOrigin,
  fetchImpl: fetch,
  maxRedirects: 0,
});

// The seeder only performs REST queries (upsert/select) — it never opens a
// realtime channel. However, @supabase/supabase-js still constructs a
// RealtimeClient eagerly, and on Node 20 (no native global WebSocket) that
// throws "Node.js 20 detected without native WebSocket support". Passing the
// `ws` package as the realtime transport satisfies the constructor without
// changing any query behaviour. Node 22+ has a global WebSocket and ignores
// this, so the fix is forward-compatible.
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: guardedFetch },
  realtime: { transport: ws },
});

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/**
 * Upsert a product on (country, brand, product_name) and return its product_id.
 *
 * If a column doesn't exist on the remote schema (e.g., nutri_score_source
 * on a staging DB that hasn't had all migrations pushed), retry without the
 * offending column. This makes the seeder work against any schema version.
 */
async function upsertProduct(product) {
  const payload = { ...product };
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, error } = await supabase
      .from("products")
      .upsert(payload, { onConflict: "country,brand,product_name" })
      .select("product_id")
      .single();

    if (!error) return data.product_id;

    // Handle missing column: strip it and retry
    const match = error.message.match(
      /Could not find the '(\w+)' column/
    );
    if (match) {
      const col = match[1];
      console.warn(
        `  ⚠️  Column '${col}' not in remote schema — removing from payload`
      );
      delete payload[col];
      continue;
    }

    throw new Error(
      `Failed to upsert product "${product.product_name}": ${error.message}`
    );
  }

  throw new Error(
    `Failed to upsert product "${product.product_name}" after ${MAX_RETRIES} retries`
  );
}

/**
 * Upsert a nutrition_facts row on product_id.
 * Handles missing columns the same way as upsertProduct.
 */
async function upsertNutrition(nutrition) {
  const payload = { ...nutrition };
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { error } = await supabase
      .from("nutrition_facts")
      .upsert(payload, { onConflict: "product_id" });

    if (!error) return;

    const match = error.message.match(
      /Could not find the '(\w+)' column/
    );
    if (match) {
      const col = match[1];
      console.warn(
        `  ⚠️  Column '${col}' not in nutrition_facts — removing from payload`
      );
      delete payload[col];
      continue;
    }

    throw new Error(
      `Failed to upsert nutrition for product ${nutrition.product_id}: ${error.message}`
    );
  }
}

/**
 * Upsert allergen info on (product_id, tag, type).
 */
async function upsertAllergen(allergen) {
  const { error } = await supabase
    .from("product_allergen_info")
    .upsert(allergen, { onConflict: "product_id,tag,type" });

  if (error) {
    throw new Error(
      `Failed to upsert allergen for product ${allergen.product_id}: ${error.message}`
    );
  }
}

/**
 * Look up an ingredient_ref by name_en. Returns ingredient_id or null.
 */
async function findIngredient(nameEn) {
  const { data } = await supabase
    .from("ingredient_ref")
    .select("ingredient_id")
    .eq("name_en", nameEn)
    .limit(1)
    .maybeSingle();

  return data?.ingredient_id ?? null;
}

/**
 * Upsert a product_ingredient row on (product_id, ingredient_id, position).
 */
async function upsertIngredient(row) {
  const { error } = await supabase
    .from("product_ingredient")
    .upsert(row, { onConflict: "product_id,ingredient_id,position" });

  if (error) {
    // Non-fatal — ingredient data is nice-to-have for QA
    console.warn(
      `⚠️  Failed to upsert ingredient (pos ${row.position}) for product ${row.product_id}: ${error.message}`
    );
  }
}

/* ── Fixture Definitions ─────────────────────────────────────────────────── */

/**
 * Product 1: Full data — nutrition, scores, allergens, ingredients.
 * Used for: QA_PRODUCT_ID, QA_PRODUCT_WITH_ALT, QA_PRODUCT_WITH_ALLERGENS.
 * Score ~45 means healthier alternatives exist in Dairy.
 */
const PRODUCT_FULL = {
  country: "PL",
  brand: "QA Test Brand",
  product_name: "QA Dairy Milk Gouda 45%",
  category: "Dairy",
  product_type: "cheese",
  prep_method: "not-applicable",
  controversies: "none",
  unhealthiness_score: 45,
  nutri_score_label: "D",
  nutri_score_source: "manual",
  nova_classification: "3",
  confidence: "verified",
  data_completeness_pct: 90,
  high_sugar_flag: "NO",
  high_salt_flag: "YES",
  high_sat_fat_flag: "YES",
  high_additive_load: "NO",
  ingredient_concern_score: 5,
  source_type: "manual",
  is_deprecated: false,
};

const NUTRITION_FULL = {
  calories: 356,
  total_fat_g: 27.0,
  saturated_fat_g: 17.5,
  trans_fat_g: 0.5,
  carbs_g: 0.0,
  sugars_g: 0.0,
  fibre_g: 0.0,
  protein_g: 25.0,
  salt_g: 1.8,
};

/**
 * Product 2: Healthiest dairy — very low score, no better alternatives.
 * Used for: QA_PRODUCT_NO_ALT.
 */
const PRODUCT_NO_ALT = {
  country: "PL",
  brand: "QA Test Brand",
  product_name: "QA Jogurt Naturalny 0%",
  category: "Dairy",
  product_type: "yogurt",
  prep_method: "not-applicable",
  controversies: "none",
  unhealthiness_score: 5,
  nutri_score_label: "A",
  nutri_score_source: "manual",
  nova_classification: "1",
  confidence: "verified",
  data_completeness_pct: 85,
  high_sugar_flag: "NO",
  high_salt_flag: "NO",
  high_sat_fat_flag: "NO",
  high_additive_load: "NO",
  ingredient_concern_score: 0,
  source_type: "manual",
  is_deprecated: false,
};

const NUTRITION_NO_ALT = {
  calories: 40,
  total_fat_g: 0.1,
  saturated_fat_g: 0.05,
  trans_fat_g: 0.0,
  carbs_g: 5.8,
  sugars_g: 3.5,
  fibre_g: 0.0,
  protein_g: 4.5,
  salt_g: 0.12,
};

/**
 * Product 3: With allergens — multiple allergen declarations.
 * Used for: QA_PRODUCT_WITH_ALLERGENS (also has full data).
 */
const PRODUCT_ALLERGENS = {
  country: "PL",
  brand: "QA Test Brand",
  product_name: "QA Sernik z Orzechami",
  category: "Dairy",
  product_type: "dessert",
  prep_method: "baked",
  controversies: "none",
  unhealthiness_score: 52,
  nutri_score_label: "D",
  nutri_score_source: "manual",
  nova_classification: "4",
  confidence: "estimated",
  data_completeness_pct: 80,
  high_sugar_flag: "YES",
  high_salt_flag: "NO",
  high_sat_fat_flag: "YES",
  high_additive_load: "NO",
  ingredient_concern_score: 10,
  source_type: "manual",
  is_deprecated: false,
};

const NUTRITION_ALLERGENS = {
  calories: 320,
  total_fat_g: 18.0,
  saturated_fat_g: 10.0,
  trans_fat_g: 0.2,
  carbs_g: 28.0,
  sugars_g: 22.0,
  fibre_g: 1.0,
  protein_g: 12.0,
  salt_g: 0.5,
};

/**
 * Product 4: Unknown Nutri-Score — label set to UNKNOWN.
 * Used for: QA_PRODUCT_MISSING_NS.
 */
const PRODUCT_NO_NS = {
  country: "PL",
  brand: "QA Test Brand",
  product_name: "QA Kefir Tradycyjny",
  category: "Dairy",
  product_type: "kefir",
  prep_method: "not-applicable",
  controversies: "none",
  unhealthiness_score: 12,
  nutri_score_label: "UNKNOWN",
  nutri_score_source: "unknown",
  nova_classification: "1",
  confidence: "low",
  data_completeness_pct: 55,
  high_sugar_flag: "NO",
  high_salt_flag: "NO",
  high_sat_fat_flag: "NO",
  high_additive_load: "NO",
  ingredient_concern_score: 0,
  source_type: "manual",
  is_deprecated: false,
};

const NUTRITION_NO_NS = {
  calories: 55,
  total_fat_g: 2.5,
  saturated_fat_g: 1.5,
  trans_fat_g: 0.0,
  carbs_g: 4.0,
  sugars_g: 3.0,
  fibre_g: 0.0,
  protein_g: 3.3,
  salt_g: 0.1,
};

/**
 * Minimal deterministic catalog extension for the existing Nightly journeys.
 *
 * The authenticated functional suite predates Phase 5A.0a and exercises five
 * Polish categories, two comparable products in the first populated category,
 * cross-country Chips isolation, broad search terms, and three known scanner
 * EANs. These rows provide exactly that contract without loading product
 * pipelines, enrichment batches, or a full catalog.
 */
const SUPPORT_PRODUCTS = [
  {
    country: "PL",
    brand: QA_FIXTURE_BRAND,
    product_name: "QA Doritos Chips Sweet Chili",
    category: "Chips",
    product_type: "chips",
    ean: "5900320001303",
    unhealthiness_score: 62,
    nutri_score_label: "D",
    nova_classification: "4",
    high_salt_flag: "YES",
  },
  {
    country: "PL",
    brand: QA_FIXTURE_BRAND,
    product_name: "QA Classic Potato Chips",
    category: "Chips",
    product_type: "chips",
    ean: "9062300130833",
    unhealthiness_score: 38,
    nutri_score_label: "C",
    nova_classification: "3",
    high_salt_flag: "YES",
  },
  {
    country: "DE",
    brand: QA_FIXTURE_BRAND,
    product_name: "QA Chipsfrisch German Chips",
    category: "Chips",
    product_type: "chips",
    ean: "4003301069048",
    unhealthiness_score: 55,
    nutri_score_label: "D",
    nova_classification: "4",
    high_salt_flag: "YES",
  },
  {
    country: "PL",
    brand: QA_FIXTURE_BRAND,
    product_name: "QA Milk Protein Drink",
    category: "Drinks",
    product_type: "milk drink",
    unhealthiness_score: 18,
    nutri_score_label: "B",
    nova_classification: "2",
    high_sugar_flag: "YES",
  },
  {
    country: "PL",
    brand: QA_FIXTURE_BRAND,
    product_name: "QA Chocolate Sweets",
    category: "Sweets",
    product_type: "chocolate",
    unhealthiness_score: 70,
    nutri_score_label: "E",
    nova_classification: "4",
    high_sugar_flag: "YES",
  },
  {
    country: "PL",
    brand: QA_FIXTURE_BRAND,
    product_name: "QA Savoury Snacks",
    category: "Snacks",
    product_type: "snack",
    unhealthiness_score: 44,
    nutri_score_label: "C",
    nova_classification: "3",
    high_salt_flag: "YES",
  },
].map((product) => ({
  prep_method: "not-applicable",
  controversies: "none",
  nutri_score_source: "manual",
  confidence: "verified",
  data_completeness_pct: 85,
  high_sugar_flag: "NO",
  high_salt_flag: "NO",
  high_sat_fat_flag: "NO",
  high_additive_load: "NO",
  ingredient_concern_score: 0,
  source_type: "manual",
  is_deprecated: false,
  ...product,
}));

const NUTRITION_SUPPORT = {
  calories: 180,
  total_fat_g: 8.0,
  saturated_fat_g: 2.0,
  trans_fat_g: 0.0,
  carbs_g: 22.0,
  sugars_g: 5.0,
  fibre_g: 2.0,
  protein_g: 4.0,
  salt_g: 0.8,
};

/* ── Main ────────────────────────────────────────────────────────────────── */

async function main() {
  console.error("🌱 Seeding QA fixture data...\n");

  // ── Verify reference data exists ────────────────────────────────────────
  const { data: categoryCheck } = await supabase
    .from("category_ref")
    .select("category")
    .eq("category", "Dairy")
    .maybeSingle();

  if (!categoryCheck) {
    console.error(
      "❌ category_ref does not contain 'Dairy'. Run reference data seeds first."
    );
    process.exit(1);
  }

  // ── Upsert products ────────────────────────────────────────────────────
  const productFullId = await upsertProduct(PRODUCT_FULL);
  const productNoAltId = await upsertProduct(PRODUCT_NO_ALT);
  const productAllergensId = await upsertProduct(PRODUCT_ALLERGENS);
  const productNoNsId = await upsertProduct(PRODUCT_NO_NS);
  const supportProductIds = [];
  for (const product of SUPPORT_PRODUCTS) {
    supportProductIds.push(await upsertProduct(product));
  }

  console.error(`  ✅ Product (full):       ID ${productFullId}`);
  console.error(`  ✅ Product (no-alt):     ID ${productNoAltId}`);
  console.error(`  ✅ Product (allergens):  ID ${productAllergensId}`);
  console.error(`  ✅ Product (no-ns):      ID ${productNoNsId}`);
  console.error(`  ✅ Nightly support catalog: ${supportProductIds.length} products`);

  // ── Upsert nutrition ───────────────────────────────────────────────────
  await upsertNutrition({ product_id: productFullId, ...NUTRITION_FULL });
  await upsertNutrition({ product_id: productNoAltId, ...NUTRITION_NO_ALT });
  await upsertNutrition({
    product_id: productAllergensId,
    ...NUTRITION_ALLERGENS,
  });
  await upsertNutrition({ product_id: productNoNsId, ...NUTRITION_NO_NS });
  for (const productId of supportProductIds) {
    await upsertNutrition({ product_id: productId, ...NUTRITION_SUPPORT });
  }
  console.error(
    `  ✅ Nutrition facts seeded for ${4 + supportProductIds.length} products`,
  );

  // ── Upsert allergens for product 3 ─────────────────────────────────────
  const allergens = [
    { product_id: productAllergensId, tag: "milk", type: "contains" },
    { product_id: productAllergensId, tag: "eggs", type: "contains" },
    { product_id: productAllergensId, tag: "gluten", type: "contains" },
    { product_id: productAllergensId, tag: "tree-nuts", type: "traces" },
  ];

  for (const allergen of allergens) {
    await upsertAllergen(allergen);
  }
  console.error(`  ✅ Allergens seeded (${allergens.length} entries)`);

  // ── Also add allergens to product 1 (QA_PRODUCT_WITH_ALLERGENS = full) ─
  const fullAllergens = [
    { product_id: productFullId, tag: "milk", type: "contains" },
  ];
  for (const allergen of fullAllergens) {
    await upsertAllergen(allergen);
  }
  console.error("  ✅ Allergens seeded for full product (milk)");

  // ── Upsert ingredients (best-effort — requires ingredient_ref data) ────
  const ingredientNames = ["water", "milk", "sugar", "salt", "cream"];
  const ingredientIds = {};

  for (const name of ingredientNames) {
    const id = await findIngredient(name);
    if (id) ingredientIds[name] = id;
  }

  const foundCount = Object.keys(ingredientIds).length;
  if (foundCount >= 2) {
    const entries = Object.entries(ingredientIds);
    for (let i = 0; i < entries.length; i++) {
      const [, ingredientId] = entries[i];
      await upsertIngredient({
        product_id: productFullId,
        ingredient_id: ingredientId,
        position: i + 1,
        is_sub_ingredient: false,
      });
    }
    console.error(
      `  ✅ Ingredients seeded (${foundCount} linked to full product)`
    );
  } else {
    console.warn(
      `  ⚠️  Only ${foundCount} ingredients found in ingredient_ref — skipping ingredient seeding`
    );
  }

  // ── Also find an ingredient_id to export for QA_INGREDIENT_ID ──────────
  let ingredientIdForFixture = "1"; // fallback
  if (ingredientIds.milk) {
    ingredientIdForFixture = String(ingredientIds.milk);
  } else if (foundCount > 0) {
    ingredientIdForFixture = String(Object.values(ingredientIds)[0]);
  }

  // ── Output fixture IDs (stdout only — CI captures via >> $GITHUB_ENV) ──
  console.log(`QA_PRODUCT_ID=${productFullId}`);
  console.log(`QA_PRODUCT_WITH_ALT=${productFullId}`);
  console.log(`QA_PRODUCT_NO_ALT=${productNoAltId}`);
  console.log(`QA_PRODUCT_WITH_ALLERGENS=${productAllergensId}`);
  console.log(`QA_PRODUCT_MISSING_NS=${productNoNsId}`);
  console.log(`QA_CATEGORY_SLUG=dairy`);
  console.log(`QA_INGREDIENT_ID=${ingredientIdForFixture}`);

  console.error("\n🎉 QA fixture seeding complete!\n");
}

/* ── Teardown ────────────────────────────────────────────────────────────── */

/**
 * Soft-deprecate all QA fixture products instead of hard-deleting them.
 *
 * Soft-deprecation (is_deprecated = true) is reversible and matches the
 * project's "deprecate, never DELETE" data policy. v_master and the public
 * API filter out is_deprecated rows, so deprecated fixtures stop appearing in
 * any user-facing surface while remaining auditable in the table.
 *
 * Invoke through the guarded launcher only:
 *   npm run visual-safety:fixtures-teardown
 */
async function teardown() {
  console.error(
    `🧹 Soft-deprecating QA fixture products (brand="${QA_FIXTURE_BRAND}")...\n`
  );

  const { data, error } = await supabase
    .from("products")
    .update({
      is_deprecated: true,
      deprecated_reason: "qa-fixture teardown",
    })
    .eq("brand", QA_FIXTURE_BRAND)
    .eq("is_deprecated", false)
    .select("product_id");

  if (error) {
    throw new Error(`Teardown failed: ${error.message}`);
  }

  const count = data?.length ?? 0;
  console.error(
    `  ✅ Soft-deprecated ${count} QA fixture product(s) (reversible)\n`
  );
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

const isTeardown =
  process.argv.includes("--teardown") ||
  process.env.QA_FIXTURE_TEARDOWN === "1";

const run = isTeardown ? teardown : main;

run().catch((err) => {
  const action = isTeardown ? "teardown" : "seeding";
  console.error(`\n❌ QA fixture ${action} failed: ${err.message}`);
  process.exit(1);
});
