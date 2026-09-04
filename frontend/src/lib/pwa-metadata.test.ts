// ─── PWA & Metadata compliance tests ──────────────────────────────────────
// Validates manifest.webmanifest, root metadata, and structured data setup.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const publicDir = join(__dirname, "../../public");
const appDir = join(__dirname, "../app");

/* ────────────────────── manifest.webmanifest ────────────────────── */

describe("PWA Manifest", () => {
  const manifestPath = join(publicDir, "manifest.webmanifest");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  it("has required PWA fields", () => {
    expect(manifest.name).toBe("TryVit — Food intelligence you can inspect");
    expect(manifest.short_name).toBe("TryVit");
    expect(manifest.start_url).toBe("/app");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
  });

  it("has language and direction", () => {
    expect(manifest.lang).toBe("en");
    expect(manifest.dir).toBe("ltr");
  });

  it("has app identity id field", () => {
    expect(manifest.id).toBeTruthy();
  });

  it("has description for food products", () => {
    expect(manifest.description).toBeTruthy();
    expect(manifest.description.length).toBeGreaterThan(20);
    expect(manifest.description).not.toMatch(
      /instantly|health score|healthy|harmful|scan, score|multi-axis/iu,
    );
  });

  it("has separate icon purposes (not combined 'any maskable')", () => {
    const purposes = manifest.icons.map(
      (i: { purpose: string }) => i.purpose,
    );
    // Should have separate "any" and "maskable" entries
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
    // Should NOT have combined "any maskable"
    expect(purposes).not.toContain("any maskable");
  });

  it("has at least 2 icon sizes", () => {
    const sizes = new Set(
      manifest.icons.map((i: { sizes: string }) => i.sizes),
    );
    expect(sizes.size).toBeGreaterThanOrEqual(2);
  });

  it("has food/health categories", () => {
    expect(manifest.categories).toContain("food");
    expect(manifest.categories).toContain("health");
  });

  it("does not force portrait orientation without an approved accessibility exception", () => {
    expect(manifest.orientation).toBeUndefined();
  });

  it("uses canonical app routes for its shortcuts", () => {
    const shortcuts = new Map(
      manifest.shortcuts.map((shortcut: { short_name: string; url: string }) => [
        shortcut.short_name,
        shortcut.url,
      ]),
    );

    expect(shortcuts.get("Search")).toBe("/app/search");
    expect(shortcuts.get("Lists")).toBe("/app/lists");
    expect(shortcuts.get("Scan")).toBe("/app/scan");
  });
});

/* ────────────────────── Icon files ────────────────────── */

describe("Icon Assets", () => {
  it("icon-192.svg exists and is valid SVG", () => {
    const path = join(publicDir, "icons/icon-192.svg");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("<svg");
    expect(content).toContain('width="192"');
  });

  it("icon-512.svg exists and is valid SVG", () => {
    const path = join(publicDir, "icons/icon-512.svg");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("<svg");
    expect(content).toContain('width="512"');
  });

  it("raster PNG icons exist", () => {
    for (const name of [
      "icon-16.png",
      "icon-32.png",
      "icon-192.png",
      "icon-512.png",
      "apple-touch-icon.png",
    ]) {
      expect(existsSync(join(publicDir, "icons", name))).toBe(true);
    }
  });

  it("favicon.ico exists in public root", () => {
    expect(existsSync(join(publicDir, "favicon.ico"))).toBe(true);
  });
});

/* ────────────────────── Root metadata (layout.tsx) ────────────────────── */

describe("Root Layout Metadata", () => {
  const layoutPath = join(appDir, "layout.tsx");
  const layoutSrc = readFileSync(layoutPath, "utf-8");
  const metadataSrc = readFileSync(join(__dirname, "site-metadata.ts"), "utf-8");

  it("exports a title template", () => {
    expect(layoutSrc).toContain("generateMetadata");
    expect(metadataSrc).toContain("template:");
    expect(metadataSrc).toContain("%s");
  });

  it("declares metadataBase", () => {
    expect(metadataSrc).toContain("metadataBase");
  });

  it("includes openGraph defaults", () => {
    expect(metadataSrc).toContain("openGraph:");
    expect(metadataSrc).toContain("siteName:");
  });

  it("includes twitter defaults", () => {
    expect(metadataSrc).toContain("twitter:");
    expect(metadataSrc).toContain('card: "summary_large_image"');
  });

  it("sets robots metadata", () => {
    expect(metadataSrc).toContain("robots:");
    expect(metadataSrc).toContain("index: true");
    expect(metadataSrc).toContain("follow: true");
  });

  it("includes Schema.org WebApplication JSON-LD", () => {
    expect(layoutSrc).toContain("application/ld+json");
    expect(layoutSrc).toContain("buildRootWebApplicationStructuredData");
    expect(metadataSrc).toContain("WebApplication");
    expect(metadataSrc).toContain('if (readiness.dataBackend !== "available") return null');
  });
});

/* ────────────────────── Product Layout Schema.org ────────────────────── */

describe("Product Layout", () => {
  const productLayoutPath = join(
    appDir,
    "app/product/[id]/layout.tsx",
  );
  const productLayoutSrc = readFileSync(productLayoutPath, "utf-8");

  it("has generateMetadata for dynamic OG", () => {
    expect(productLayoutSrc).toContain("generateMetadata");
  });

  it("includes Schema.org Product JSON-LD", () => {
    expect(productLayoutSrc).toContain("application/ld+json");
    expect(productLayoutSrc).toContain('"@type": "Product"');
  });

  it("does not attach unsupported NutritionInformation to Product", () => {
    expect(productLayoutSrc).not.toContain('"@type": "NutritionInformation"');
    expect(productLayoutSrc).not.toContain("nutrition: nutritionInfo");
  });

  it("uses title template (no hardcoded suffix)", () => {
    // Should NOT contain "— TryVit" in title (template handles it)
    expect(productLayoutSrc).not.toContain('title: `${name} — TryVit`');
    expect(productLayoutSrc).not.toContain('title: "Product — TryVit"');
  });
});

/* ────────────────────── Page-specific metadata layouts ────────────────────── */

describe("Page-Specific Metadata", () => {
  const pages = [
    { name: "search", path: "app/search/layout.tsx" },
    { name: "categories", path: "app/categories/layout.tsx" },
    { name: "lists", path: "app/lists/layout.tsx" },
    { name: "compare", path: "app/compare/layout.tsx" },
    { name: "settings", path: "app/settings/layout.tsx" },
    { name: "scan", path: "app/scan/layout.tsx" },
  ];

  for (const page of pages) {
    it(`${page.name} has a layout with metadata`, () => {
      const fullPath = join(appDir, page.path);
      expect(existsSync(fullPath)).toBe(true);
      const src = readFileSync(fullPath, "utf-8");
      expect(src).toContain("metadata");
      expect(src).toContain("title:");
      expect(src).toContain("description:");
    });
  }

  it("categories/[slug] has dynamic generateMetadata", () => {
    const path = join(appDir, "app/categories/[slug]/layout.tsx");
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf-8");
    expect(src).toContain("generateMetadata");
  });
});

/* ────────────────────── OG Image ────────────────────── */

describe("OpenGraph Images", () => {
  it("root opengraph-image.tsx exists", () => {
    const path = join(appDir, "opengraph-image.tsx");
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf-8");
    expect(src).toContain("ImageResponse");
    expect(src).toContain("1200");
    expect(src).toContain("630");
    expect(src).toContain("LandingSocialCard");
    expect(src).not.toContain("fonts.gstatic.com");
  });

  it("root Twitter image uses the same truthful landing card", () => {
    const path = join(appDir, "twitter-image.tsx");
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf-8");
    expect(src).toContain("LandingSocialCard");
    expect(src).toContain("1200");
    expect(src).toContain("600");
    expect(src).not.toContain("fonts.gstatic.com");
  });

  it("product opengraph-image.tsx exists", () => {
    const path = join(appDir, "app/product/[id]/opengraph-image.tsx");
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, "utf-8");
    expect(src).toContain("ImageResponse");
  });
});
