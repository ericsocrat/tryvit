/** Stored preparation/cooking minutes are not a promise of elapsed completion time. */
export function preparationAndCookingMinutes(prep: number, cook: number): number | null {
  return Number.isFinite(prep) && Number.isFinite(cook) && prep >= 0 && cook >= 0
    ? prep + cook
    : null;
}

/** This authored recipe explicitly requires at least four hours in its second step. */
export function recipeWaitingNote(slug: string): string | null {
  return slug === "overnight-oats" ? "evidenceActivity.overnightWaiting" : null;
}
