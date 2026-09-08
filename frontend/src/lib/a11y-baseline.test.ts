// ─── A11y baseline compliance tests ──────────────────────────────────────────
// Validates structural a11y patterns introduced by Issue #49:
// - id="main-content" landmark targets
// - Focus management in dropdown components
// - ARIA combobox pattern on SearchAutocomplete
// - useReducedMotion hook existence
// - Visible focus indicators in CSS

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
const css = readFileSync(join(SRC, "styles/globals.css"), "utf-8");

/* ────────────────── Focus management ────────────────── */

describe("Focus management — AddToListMenu", () => {
  const menuPath = join(
    SRC,
    "components/product/AddToListMenu.tsx",
  );

  it("has triggerRef for focus return", () => {
    const src = readFileSync(menuPath, "utf-8");
    expect(src).toContain("triggerRef");
  });

  it("returns focus to trigger on Escape", () => {
    const src = readFileSync(menuPath, "utf-8");
    expect(src).toContain("triggerRef.current?.focus()");
  });

  it("has aria-expanded on trigger", () => {
    const src = readFileSync(menuPath, "utf-8");
    expect(src).toContain("aria-expanded");
  });

  it("has aria-haspopup on trigger", () => {
    const src = readFileSync(menuPath, "utf-8");
    expect(src).toContain('aria-haspopup="true"');
  });

  it("dropdown has role=menu", () => {
    const src = readFileSync(menuPath, "utf-8");
    expect(src).toContain('role="menu"');
  });

  it("menu items have role=menuitem", () => {
    const src = readFileSync(menuPath, "utf-8");
    expect(src).toContain('role="menuitem"');
  });
});

/* ────────────────── ARIA combobox on SearchAutocomplete ────────────────── */

describe("Find form accessibility", () => {
  const src = readFileSync(join(SRC, "app/app/search/page.tsx"), "utf-8");
  it("uses a native labelled search form without a phantom combobox", () => {
    expect(src).toContain('role="search"');
    expect(src).toContain('type="search"');
    expect(src).not.toContain('role="combobox"');
    expect(src).not.toContain("search-autocomplete-listbox");
  });
  it("provides result and error announcements", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('role="alert"');
  });
});

/* ────────────────── Visible focus indicators ────────────────── */

describe("Visible focus indicators", () => {
  it("has global *:focus-visible rule", () => {
    expect(css).toContain("*:focus-visible");
    expect(css).toContain("outline: 2px solid");
    expect(css).toContain("outline-offset: 2px");
  });

  it("removes outline for non-keyboard focus", () => {
    expect(css).toContain(":focus:not(:focus-visible)");
    expect(css).toContain("outline: none");
  });
});

/* ────────────────── Reduced motion ────────────────── */

describe("Reduced motion support", () => {
  it("CSS respects prefers-reduced-motion", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("CSS sets all duration tokens to 0ms under reduced motion", () => {
    expect(css).toContain("--duration-instant: 0ms");
    expect(css).toContain("--duration-fast: 0ms");
    expect(css).toContain("--duration-normal: 0ms");
    expect(css).toContain("--duration-slow: 0ms");
  });

  it("useReducedMotion hook exists", () => {
    const hookPath = join(SRC, "hooks/use-reduced-motion.ts");
    expect(existsSync(hookPath)).toBe(true);
    const src = readFileSync(hookPath, "utf-8");
    expect(src).toContain("useReducedMotion");
    expect(src).toContain("prefers-reduced-motion");
  });
});

/* ────────────────── Landmark structure ────────────────── */

describe("Landmark structure", () => {
  it("app layout has <main> with id", () => {
    const src = readFileSync(join(SRC, "app/app/layout.tsx"), "utf-8");
    expect(src).toContain('<main');
    expect(src).toContain('id="main-content"');
  });

  it("navigation has aria-label", () => {
    const navPath = join(SRC, "components/layout/Navigation.tsx");
    const src = readFileSync(navPath, "utf-8");
    expect(src).toContain("aria-label");
  });

  it("search form has role=search", () => {
    const src = readFileSync(join(SRC, "app/app/search/page.tsx"), "utf-8");
    expect(src).toContain('role="search"');
  });
});
