import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "postcss";
import { describe, expect, it } from "vitest";

const surfaces = [
  "src/app/app/watchlist/watchlist.module.css",
  "src/app/app/compare/compare.module.css",
  "src/components/trust/ProductEvidencePanel.module.css",
  "src/components/compare/ComparisonGrid.module.css",
  "src/app/app/error.module.css",
  "src/components/learn/LearnExperience.module.css",
  "src/components/layout/PublicUtilityShell.module.css",
];

describe("secondary surfaces share the neutral application direction", () => {
  it.each(surfaces)("%s uses theme tokens without paper decorations", (file) => {
    const css = readFileSync(path.resolve(file), "utf8");
    const parsed = parse(css, { from: file });
    expect(parsed.nodes.length).toBeGreaterThan(0);
    expect(css).not.toMatch(/linear-gradient|--(?:shell|learn|public)-fold|#(?:965032|a64b2a|f2a271)/i);
    // The retired folded corner has one tiny corner and three larger ones.
    expect(css).not.toMatch(/border-radius:\s*([\d.]+rem)\s+0\.[12]\d*rem\s+\1\s+\1/);
    expect(css).toContain("@media (forced-colors: active)");
    if (!file.endsWith("error.module.css")) {
      expect(css).not.toContain("ui-monospace");
    }
  });

  it("keeps semantic warning and error treatments", () => {
    const evidence = readFileSync(path.resolve(surfaces[2]), "utf8");
    const watchlist = readFileSync(path.resolve(surfaces[0]), "utf8");
    expect(evidence).toContain("var(--color-warning-bg)");
    expect(evidence).toContain("var(--color-warning-text)");
    expect(watchlist).toContain("var(--color-error-bg)");
    expect(watchlist).toContain("var(--color-error-text)");
  });

  it("preserves a visible selected comparison tab including forced colors", () => {
    const css = readFileSync(path.resolve(surfaces[3]), "utf8");
    expect(css).toContain('aria-selected="true"');
    expect(css).toContain("box-shadow: inset 0 -3px 0 var(--color-brand)");
    expect(css).toContain("box-shadow: inset 0 -3px 0 Highlight");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("retains reduced-motion support for learning links and monospace for diagnostic IDs", () => {
    const learn = readFileSync(path.resolve(surfaces[5]), "utf8");
    const error = readFileSync(path.resolve(surfaces[4]), "utf8");
    expect(learn).toContain("prefers-reduced-motion");
    expect(learn).toContain("transform: none");
    expect(error).toMatch(/\.digest\s*\{[^}]*font-family: ui-monospace/);
  });
});
