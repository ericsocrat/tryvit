import { describe, expect, it } from "vitest";
import { preparationAndCookingMinutes, recipeWaitingNote } from "./recipe-presentation";
import en from "@/../messages/en.json";
import pl from "@/../messages/pl.json";
import de from "@/../messages/de.json";

describe("authored recipe timing", () => {
  it("does not convert invalid timing to zero", () => {
    expect(preparationAndCookingMinutes(0, 0)).toBe(0);
    expect(preparationAndCookingMinutes(5, 10)).toBe(15);
    for (const value of [NaN, Infinity, -1]) expect(preparationAndCookingMinutes(value, 5)).toBeNull();
  });
  it("adds a waiting note only to the identified recipe, not every recipe", () => {
    expect(recipeWaitingNote("overnight-oats")).toBe("evidenceActivity.overnightWaiting");
    expect(recipeWaitingNote("jajecznica")).toBeNull();
  });
  it.each([en, pl, de])("keeps the waiting note tied to the actual second instruction", (messages) => {
    expect(messages.recipes.items["overnight-oats"].steps["2"]).toContain("4");
    expect(messages.evidenceActivity.overnightWaiting).toContain("4");
    expect(messages.recipes.items["overnight-oats"].description).not.toMatch(/honey|miod|Honig/);
    expect(messages.recipes.items["overnight-oats"].steps["3"]).not.toMatch(/honey|miod|Honig/);
  });
});
