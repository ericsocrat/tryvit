import type { AchievementsResponse } from "@/lib/types";

const RETIRED_SCORE_MILESTONES = new Set(["first_low_score", "low_score_10", "all_health"]);

/** Also protects a client resuming a legacy cached gallery during deployment. */
export function activityWithoutHealthClaims(data: AchievementsResponse): AchievementsResponse {
  const archived = new Map((data.retired_achievements ?? []).map((entry) => [entry.id, entry]));
  for (const entry of data.achievements) {
    if (RETIRED_SCORE_MILESTONES.has(entry.slug) && (entry.progress > 0 || entry.unlocked_at)) {
      archived.set(entry.id, { id: entry.id, slug: entry.slug, progress: entry.progress, unlocked_at: entry.unlocked_at, status: "retired" });
    }
  }
  const achievements = data.achievements.filter((entry) => !RETIRED_SCORE_MILESTONES.has(entry.slug)).map((entry) => ({
    ...entry,
    category: entry.category === "health" ? "exploration" as const : entry.category,
    ...(entry.slug === "allergen_filter" ? { title_key: "evidenceActivity.allergenFilterTitle", desc_key: "evidenceActivity.allergenFilterDescription" } : {}),
  }));
  return { ...data, achievements, total: achievements.length, unlocked: achievements.filter((entry) => entry.unlocked_at !== null).length, retired_achievements: [...archived.values()] };
}
