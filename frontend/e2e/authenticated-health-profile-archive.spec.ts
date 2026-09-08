import { expect, test } from "./fixtures/safe-test";
import { assertNoA11yViolations } from "./helpers/a11y";
import { createGuardedFetch, loadSafetyContractFromEnvironment } from "./helpers/visual-safety";
import { getAdminClient, getScopedTestSession } from "./helpers/test-user";
import { translate } from "../src/lib/i18n-core";

const safety = loadSafetyContractFromEnvironment(process.env);
if (safety.mode !== "local-authenticated") throw new Error("Archive verification requires the guarded local runtime");

test.describe("owned synthetic health profile archive", () => {
  test.describe.configure({ mode: "serial" });
  for (const [language, width] of [["pl", 390], ["de", 1440]] as const) {
    test(`${language} ${width}: inspect, failed delete, confirmed delete and empty archive`, async ({ page }, info) => {
      const session = await getScopedTestSession("authenticated");
      const admin = getAdminClient();
      const changed = await admin.from("user_preferences").update({ preferred_language: language }).eq("user_id", session.userId);
      if (changed.error) throw new Error("Synthetic fixture locale update failed");
      const request = createGuardedFetch({ allowedOrigin: safety.supabaseOrigin });
      const rpc = async (name: string, body: object = {}) => {
        const response = await request(`${safety.supabaseOrigin}/rest/v1/rpc/${name}`, { method: "POST",
          headers: { "Content-Type": "application/json", apikey: session.anonKey, authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify(body) });
        if (!response.ok) throw new Error("Synthetic owner RPC failed");
        return response.json();
      };
      const created = await rpc("api_create_health_profile", { p_profile_name: "SYNTHETIC archived profile", p_health_conditions: ["diabetes"], p_is_active: true, p_max_sugar_g: 0, p_notes: "SYNTHETIC saved record — not a medical recommendation" });
      expect(created.created).toBe(true);
      const profileId = created.profile_id as string;
      try {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
        await page.goto("/app/settings/nutrition", { waitUntil: "domcontentloaded" });
        const archive = page.getByTestId("health-profile-section");
        await expect(archive.getByRole("heading", { name: translate(language, "healthProfile.title") })).toBeVisible();
        await expect(archive).toContainText(translate(language, "healthProfile.archiveDescription"));
        await expect(archive).toContainText(translate(language, "healthProfile.allergenPreferencesNotice"));
        await archive.locator("summary").filter({ hasText: "SYNTHETIC archived profile" }).click();
        await expect(archive.getByText("SYNTHETIC saved record — not a medical recommendation")).toBeVisible();
        await expect(archive.locator("input, textarea, select, form")).toHaveCount(0);
        await expect(archive.getByRole("button")).toHaveCount(1);
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page).toHaveTitle(/\S/);
        expect((await assertNoA11yViolations(page)).blocking).toHaveLength(0);
        const image = info.outputPath(`health-profile-archive-${language}-${width}.png`);
        await archive.screenshot({ path: image, animations: "disabled" });
        await info.attach(`health-profile-archive-${language}-${width}`, { path: image, contentType: "image/png" });
        let rejected = false;
        await page.route(`${safety.supabaseOrigin}/rest/v1/rpc/api_delete_health_profile`, async (route) => {
          if (!rejected) { rejected = true; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ api_version: "1.0", profile_id: profileId, deleted: false }) }); }
          else await route.fallback();
        });
        const remove = archive.getByRole("button", { name: `${translate(language, "common.delete")} SYNTHETIC archived profile` });
        await remove.click();
        const dialog = page.getByRole("dialog", { name: translate(language, "healthProfile.archiveDeleteConfirm", { name: "SYNTHETIC archived profile" }) });
        await expect(dialog).toBeVisible();
        await dialog.evaluate(async (element) => {
          await Promise.all(element.getAnimations({ subtree: true }).filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map((animation) => animation.finished.catch(() => undefined)));
        });
        expect((await assertNoA11yViolations(page)).blocking).toHaveLength(0);
        await dialog.getByRole("button", { name: translate(language, "common.delete"), exact: true }).click();
        await expect(archive.getByRole("alert")).toContainText(translate(language, "healthProfile.archiveDeleteFailed"));
        expect((await rpc("api_list_health_profiles")).profiles.some((entry: { profile_id: string }) => entry.profile_id === profileId)).toBe(true);
        await remove.click();
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: translate(language, "common.delete"), exact: true }).click();
        await expect(archive).toContainText(translate(language, "healthProfile.emptyState"));
        expect((await rpc("api_list_health_profiles")).profiles.some((entry: { profile_id: string }) => entry.profile_id === profileId)).toBe(false);
        await expect(archive.getByRole("button")).toHaveCount(0);
      } finally {
        await rpc("api_delete_health_profile", { p_profile_id: profileId });
        const restored = await admin.from("user_preferences").update({ preferred_language: "en" }).eq("user_id", session.userId);
        if (restored.error) throw new Error("Synthetic fixture locale restore failed");
      }
    });
  }
});
