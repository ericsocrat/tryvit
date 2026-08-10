import { describe, expect, it } from "vitest";

import { tokenManifest } from "@/design-system/tokens/manifest";

import {
  borderColorVariables,
  borderWidths,
  breakpointPixels,
  breakpoints,
  elevation,
  elevationNames,
  fontAssay,
  motion,
  radii,
  sizing,
  spacing,
  typeRoles,
  zIndex,
} from "./index";

describe("Design System V2 foundations", () => {
  it("defines the approved 4px spacing scale", () => {
    expect(Object.keys(spacing)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "6",
      "8",
      "10",
      "12",
      "16",
      "20",
      "24",
    ]);
    for (const value of Object.values(spacing)) {
      if (value === "0") continue;
      expect((Number.parseFloat(value) * 16) % 4).toBe(0);
    }
  });

  it("defines control, touch, icon, avatar, media, and container sizing", () => {
    expect(Object.keys(sizing)).toEqual([
      "control",
      "touch",
      "icon",
      "avatar",
      "media",
      "container",
    ]);
    expect(sizing.touch.minimum).toBe("2.75rem");
    expect(Number.parseFloat(sizing.container.canvas) * 16).toBe(
      Number.parseFloat(breakpoints.canvas),
    );
  });

  it("defines the six intentional radii and four border widths", () => {
    expect(Object.keys(radii)).toEqual([
      "none",
      "small",
      "medium",
      "large",
      "label",
      "round",
    ]);
    expect(Object.keys(borderWidths)).toEqual([
      "hairline",
      "standard",
      "strong",
      "focus",
    ]);
    expect(borderWidths.focus).toBe("3px");
    expect(borderColorVariables.focus).toBe("--color-border-focus");
  });

  it("allows exactly four named elevations in both themes", () => {
    const elevationTokenIds = Object.keys(tokenManifest.primitive).filter(
      (tokenId) => tokenId.startsWith("elevation."),
    );
    expect(elevationNames).toEqual([
      "none",
      "raised",
      "overlay",
      "floating",
    ]);
    expect(elevationTokenIds).toHaveLength(4);
    expect(Object.keys(elevation("light"))).toEqual(elevationNames);
    expect(Object.keys(elevation("dark"))).toEqual(elevationNames);
    expect(elevation("light").none).toBe("none");
  });

  it("defines type roles without adopting the Manrope candidate", () => {
    expect(Object.keys(typeRoles)).toEqual([
      "displayHero",
      "display",
      "heading1",
      "heading2",
      "heading3",
      "bodyLarge",
      "body",
      "bodySmall",
      "label",
      "caption",
    ]);
    expect(fontAssay.production.status).toBe("pass");
    expect(fontAssay.production.runtimeFontHost).toBe(false);
    expect(fontAssay.production.preloadChanged).toBe(false);
    expect(fontAssay.candidate.status).toBe("candidate-not-adopted");
    expect(fontAssay.candidate.maximumCheckedInBytes).toBe(102400);
    expect(fontAssay.candidate.measuredBytes).toBeNull();
    expect(fontAssay.candidate.reason).toContain("adoption would require guessing");
  });

  it("defines bounded motion and a zero-duration reduced-motion contract", () => {
    expect(motion.duration).toEqual({
      instant: "0ms",
      feedback: "120ms",
      fast: "180ms",
      standard: "240ms",
      deliberate: "360ms",
      narrativeMax: "500ms",
    });
    expect(new Set(Object.values(motion.reducedDuration))).toEqual(
      new Set(["0ms"]),
    );
    expect(Object.keys(motion.displacement)).toEqual(["xs", "sm", "md", "lg"]);
    expect(motion.recipe.disclosureEnter).toMatchObject({
      duration: "standard",
      easing: "emphasizedDecelerate",
      properties: ["transform", "opacity"],
      reduced: "final-state-immediate",
    });
    expect(motion.recipe.disclosureExit).toMatchObject({
      duration: "fast",
      easing: "emphasizedAccelerate",
    });
    expect(motion.recipe.spatialContinuity.duration).toBe("deliberate");
    expect(motion.recipe.determinateProgress).toMatchObject({
      duration: "standard",
      easing: "linearProgress",
      displacement: null,
      properties: ["transform"],
    });
    expect(
      Object.entries(motion.recipe)
        .filter(([, recipe]) => recipe.duration === "narrativeMax")
        .map(([name]) => name),
    ).toEqual(["landingSharedLabel"]);
    expect(
      Object.values(motion.recipe).every(
        (recipe) => recipe.reduced === "final-state-immediate",
      ),
    ).toBe(true);
  });

  it("defines ordered z-index and shared responsive breakpoints", () => {
    expect(Object.values(zIndex).map(Number)).toEqual([0, 10, 20, 30, 40, 50]);
    expect(breakpointPixels).toEqual({
      compact: 375,
      medium: 768,
      wide: 1024,
      canvas: 1440,
    });
  });
});
