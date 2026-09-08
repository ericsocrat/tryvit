import type { UserPreferences } from "@/lib/types";

/** Synthetic preferences shared only by component/contract tests. */
export const findPreferencesFixture: UserPreferences = {
  api_version: "1.0", user_id: "fixture-user", country: "PL", preferred_language: "en", diet_preference: "none", avoid_allergens: [],
  strict_allergen: false, strict_diet: false, treat_may_contain_as_unsafe: false, health_goals: [], favorite_categories: [],
  onboarding_complete: true, onboarding_completed: true, onboarding_skipped: false, notification_score_changes: false, notification_frequency: "weekly_digest",
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
};
