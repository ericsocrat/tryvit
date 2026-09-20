import { expect, test } from "./fixtures/safe-test";
import { getAdminClient, getScopedTestSession } from "./helpers/test-user";
import { loadSafetyContractFromEnvironment } from "./helpers/visual-safety";
import { translate } from "../src/lib/i18n-core";

const safety = loadSafetyContractFromEnvironment(process.env);
if (safety.mode !== "local-authenticated") throw new Error("Find exclusion coverage requires guarded local authentication");
test.describe("authenticated Find exclusion explanation", () => {
  test("Find explains an exact EAN hidden by a saved allergen preference", async ({ page }) => {
    const { userId } = await getScopedTestSession("authenticated");
    const admin = getAdminClient();
    const product = await admin.from("products").select("product_id,ean").eq("country", "PL").eq("is_deprecated", false).not("ean", "is", null).order("product_id").limit(1).maybeSingle();
    if (product.error || !product.data?.ean) throw new Error("[FIND_EXCLUSION_FIXTURE] barcode-product-unavailable");
    const productId = product.data.product_id;
    const original = await admin.from("user_preferences").select("avoid_allergens,diet_preference,strict_allergen,strict_diet,treat_may_contain_as_unsafe").eq("user_id", userId).single();
    if (original.error || !original.data) throw new Error("[FIND_EXCLUSION_FIXTURE] preferences-unavailable");
    const tag = "lupin";
    const existing = await admin.from("product_allergen_info").select("product_id").eq("product_id", productId).eq("tag", tag).eq("type", "contains");
    if (existing.error) throw new Error("[FIND_EXCLUSION_FIXTURE] allergen-read-unavailable");
    const insertedByTest = existing.data.length === 0;
    if (insertedByTest) {
      const inserted = await admin.from("product_allergen_info").insert({ product_id: productId, tag, type: "contains", evidence_basis: "legacy_unclassified" });
      if (inserted.error) throw new Error("[FIND_EXCLUSION_FIXTURE] allergen-write-unavailable");
    }
    const updated = await admin.from("user_preferences").update({ avoid_allergens: ["lupin"], diet_preference: "none", strict_allergen: false, strict_diet: false, treat_may_contain_as_unsafe: false }).eq("user_id", userId);
    if (updated.error) throw new Error("[FIND_EXCLUSION_FIXTURE] preference-write-unavailable");
    try {
      await page.goto(`/app/search?q=${encodeURIComponent(product.data.ean)}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: translate("en", "findUi.exactExcludedTitle") })).toBeVisible();
      await expect(page.getByText(translate("en", "findUi.exclusionAllergenEvidence", { allergens: translate("en", "allergens.lupin") }))).toBeVisible();
      await expect(page.getByRole("link", { name: translate("en", "findUi.openExactProduct") })).toHaveAttribute("href", `/app/product/${productId}`);
      await expect(page.locator(`main [data-testid="product-register-card"]`)).toHaveCount(0);
    } finally {
      await admin.from("user_preferences").update(original.data).eq("user_id", userId);
      if (insertedByTest) await admin.from("product_allergen_info").delete().eq("product_id", productId).eq("tag", tag).eq("type", "contains");
    }
  });
});
