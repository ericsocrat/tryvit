import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/design-system/tokens/contrast";
import { buttonClasses } from "./Button";

const css = readFileSync(join(__dirname, "../../styles/globals.css"), "utf8");
const values = (name: string) => [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "gi"))].map((match) => match[1]);

describe("destructive action contrast", () => {
  it("uses the stronger semantic danger fill rather than the icon accent", () => {
    expect(buttonClasses("danger").split(" ")).toContain("bg-error-text");
    expect(buttonClasses("danger").split(" ")).not.toContain("bg-error");
    expect(css).toContain("--color-error-text: var(--color-danger-text)");
  });

  it("pairs readable small text in both declared light and dark themes", () => {
    const backgrounds = values("color-danger-text");
    const foregrounds = values("color-text-inverse");
    expect(backgrounds).toHaveLength(2);
    expect(foregrounds).toHaveLength(2);
    backgrounds.forEach((background, index) => {
      expect(contrastRatio(foregrounds[index], background)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
