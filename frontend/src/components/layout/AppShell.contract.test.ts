import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/design-system/tokens/contrast";

const css = readFileSync(path.resolve("src/components/layout/AppShell.module.css"), "utf8");
const light = css.match(/\.frame\s*\{([^}]+)\}/)?.[1] ?? "";
const dark = css.match(/:global\(\[data-theme="dark"\]\) \.frame\s*\{([^}]+)\}/)?.[1] ?? "";
function color(block: string, token: string): string {
  const value = block.match(new RegExp(`${token}:\\s*(#[a-f0-9]{6})`, "i"))?.[1];
  if (!value) throw new Error(`Missing palette color ${token}`);
  return value;
}

describe("shared neutral application shell", () => {
  it.each([["light", light], ["dark", dark]])("keeps readable content and paired action contrast in %s", (_theme, block) => {
    for (const text of ["--color-content-primary", "--color-content-secondary", "--color-content-muted"]) {
      for (const surface of ["--color-canvas", "--color-surface-1", "--color-surface-2"]) {
        expect(contrastRatio(color(block, text), color(block, surface))).toBeGreaterThanOrEqual(4.5);
      }
    }
    const foreground = color(block, "--color-action-primary-foreground");
    expect(contrastRatio(foreground, color(block, "--color-action-primary-background"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(foreground, color(block, "--color-action-primary-hover"))).toBeGreaterThanOrEqual(4.5);
  });

  it("shares typography and anchors content to navigation, without dashboard-only theme rules", () => {
    expect(css).toContain("font-family: var(--ds-type-family-sans)");
    expect(css).not.toContain("data-dashboard-home");
    expect(css).not.toContain("Arial");
    expect(css).not.toContain("linear-gradient");
    expect(css).toMatch(/\.mainContent\s*\{[^}]*margin-inline:\s*0/);
    expect(css).toContain("padding-left: 14rem");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toContain(":global(:root:not([data-theme])) .frame");
  });
});
