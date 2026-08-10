import { describe, expect, it } from "vitest";

import {
  applyResolvedTheme,
  createThemeBootstrapScript,
  isThemeMode,
  resolveThemeMode,
  THEME_CHROME_COLORS,
} from "./theme-contract";

describe("theme contract", () => {
  it.each([
    ["light", true],
    ["dark", true],
    ["system", true],
    ["invalid", false],
    [undefined, false],
  ] as const)("validates %s", (value, expected) => {
    expect(isThemeMode(value)).toBe(expected);
  });

  it("resolves explicit and system modes deterministically", () => {
    expect(resolveThemeMode("light", true)).toBe("light");
    expect(resolveThemeMode("dark", false)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
    expect(resolveThemeMode("system", true)).toBe("dark");
  });

  it.each(["light", "dark"] as const)("applies %s to theme and browser chrome", (theme) => {
    const metas = [document.createElement("meta"), document.createElement("meta")];
    for (const meta of metas) {
      meta.name = "theme-color";
      document.head.append(meta);
    }

    applyResolvedTheme(theme);

    expect(document.documentElement.dataset.theme).toBe(theme);
    expect(document.documentElement.style.colorScheme).toBe(theme);
    expect(metas.every((meta) => meta.content === THEME_CHROME_COLORS[theme])).toBe(true);
    for (const meta of metas) meta.remove();
  });

  it("generates a storage-safe first-paint script with the same contract", () => {
    const script = createThemeBootstrapScript();
    expect(script).toContain("stored === 'light'");
    expect(script).toContain("stored === 'dark'");
    expect(script).toContain("stored === 'system'");
    expect(script).toContain("root.style.colorScheme = resolved");
    expect(script).toContain("querySelectorAll");
    expect(script).toContain(THEME_CHROME_COLORS.light);
    expect(script).toContain(THEME_CHROME_COLORS.dark);
  });
});
