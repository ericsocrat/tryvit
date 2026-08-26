import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const LANDING_ROOT = join(ROOT, "src", "app", "_landing-v2");
const ASSAY_ROOT = join(
  ROOT,
  "..",
  "docs",
  "phase5a2",
  "checkpoint-2",
  "evidence",
  "font-assay",
);

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function walk(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const candidate = join(path, entry);
    return statSync(candidate).isDirectory() ? walk(candidate) : [candidate];
  });
}

describe("Phase 5A.3 landing production boundary", () => {
  it("retains the exact audited assay and license bytes outside production", () => {
    const expected = [
      ["fonts/manrope-regular.woff2", 27_300, "aa08da8e2396fd24c9cca149bcc1ffb6601b62c7dd771e1346406ed444493d59"],
      ["fonts/manrope-semibold.woff2", 27_412, "8ba9a04089cdc0fd8ba4e95da82d3ee0bacb82ebc7f9f3100f78a7bad76c35ad"],
      ["fonts/tryvit-assay-serif-regular.woff2", 20_292, "89c4a0f8be9a0386cb2f17db9625d65072581229f31d96ef45fc66378cd2e850"],
      ["fonts/licenses/MANROPE-OFL.txt", 4_383, "f612090fb72b6dca3e807e66fa0d2b5def163cef86f1a3209b5c897cba5ee4b7"],
      ["fonts/licenses/SOURCE-SERIF-4-OFL.md", 4_491, "c21d7293d87b6d7ab1d0229a2f55b77f33a7613a6a4e66f6693d68d7d8d09464"],
    ] as const;

    for (const [relativePath, bytes, hash] of expected) {
      const path = join(ASSAY_ROOT, relativePath.replace(/^fonts\//u, ""));
      expect(statSync(path).size, relativePath).toBe(bytes);
      expect(sha256(path), relativePath).toBe(hash);
    }
    expect(expected.slice(0, 3).reduce((total, [, bytes]) => total + bytes, 0)).toBe(75_004);
  });

  it("blocks candidate font adoption after the performance proof failed", () => {
    const packageJson = readFileSync(join(ROOT, "package.json"), "utf8");
    const productionFonts = walk(LANDING_ROOT).filter((path) => path.endsWith(".woff2"));
    const shellSource = readFileSync(join(LANDING_ROOT, "LandingPublicShell.tsx"), "utf8");
    expect(productionFonts).toEqual([]);
    expect(shellSource).not.toContain("next/font/local");
    expect(packageJson).not.toContain("@fontsource");
  });

  it("admits exactly two explicit route-local client islands", () => {
    const clientFiles = walk(LANDING_ROOT)
      .filter((path) => path.endsWith(".tsx"))
      .filter((path) => /^\s*["']use client["'];/mu.test(readFileSync(path, "utf8")))
      .map((path) => relative(LANDING_ROOT, path).replaceAll("\\", "/"))
      .sort();
    expect(clientFiles).toEqual([
      "LandingLiveAuthAction.client.tsx",
      "LandingThemeToggle.client.tsx",
    ]);
  });

  it("keeps the landing module out of unrelated production routes", () => {
    const appRoot = join(ROOT, "src", "app");
    const allowed = new Set([
      "HomePageContent.tsx",
      "LandingSections.tsx",
      "opengraph-image.tsx",
      "page.tsx",
      "twitter-image.tsx",
    ]);
    const consumers = walk(appRoot)
      .filter((path) => /\.(?:ts|tsx)$/u.test(path))
      .filter((path) => !/\.test\.(?:ts|tsx)$/u.test(path))
      .filter((path) => !path.startsWith(LANDING_ROOT))
      .filter((path) => readFileSync(path, "utf8").includes("_landing-v2"))
      .map((path) => relative(appRoot, path).replaceAll("\\", "/"))
      .sort();
    expect(consumers).toEqual([...allowed].sort());
  });

  it("retains Polish, German, tabular, fallback, and no-backend source contracts", () => {
    const copy = readFileSync(join(LANDING_ROOT, "copy.ts"), "utf8");
    const css = readFileSync(join(LANDING_ROOT, "landing.module.css"), "utf8");
    const home = readFileSync(join(ROOT, "src", "app", "HomePageContent.tsx"), "utf8");
    const globalProviders = readFileSync(
      join(ROOT, "src", "components", "Providers.tsx"),
      "utf8",
    );
    expect(copy).toContain("Odczytaj opakowanie");
    expect(copy).toContain("Datenverlässlichkeit");
    expect(copy).toContain("Verarbeitungsgrad nicht bewertet");
    expect(css).toContain("font-variant-numeric: tabular-nums");
    expect(css).toContain("ui-sans-serif, system-ui");
    expect(css).toContain("ui-serif, Georgia");
    expect(home).not.toContain("@/lib/supabase");
    expect(home).toContain("LivePublicAuthProvider");
    expect(home).toContain("dataAvailable ? <LivePublicAuthProvider>");
    expect(globalProviders).not.toContain("LivePublicAuth");
    for (const path of [
      join(LANDING_ROOT, "LandingPublicShell.tsx"),
      join(LANDING_ROOT, "LandingLiveAuthAction.client.tsx"),
      join(ROOT, "src", "app", "LandingSections.tsx"),
    ]) {
      expect(readFileSync(path, "utf8"), path).not.toContain("next/link");
    }
  });

  it("keeps readiness truth, mobile destinations, and disclosure semantics server-led", () => {
    const copy = readFileSync(join(LANDING_ROOT, "copy.ts"), "utf8");
    const shell = readFileSync(join(LANDING_ROOT, "LandingPublicShell.tsx"), "utf8");
    const narrative = readFileSync(join(LANDING_ROOT, "PackageLabelNarrative.tsx"), "utf8");
    const sections = readFileSync(join(ROOT, "src", "app", "LandingSections.tsx"), "utf8");
    const css = readFileSync(join(LANDING_ROOT, "landing.module.css"), "utf8");
    const socialCard = readFileSync(join(LANDING_ROOT, "LandingSocialCard.tsx"), "utf8");
    const openGraph = readFileSync(join(ROOT, "src", "app", "opengraph-image.tsx"), "utf8");
    const twitter = readFileSync(join(ROOT, "src", "app", "twitter-image.tsx"), "utf8");
    const layout = readFileSync(join(ROOT, "src", "app", "layout.tsx"), "utf8");
    const manifest = readFileSync(join(ROOT, "public", "manifest.webmanifest"), "utf8");

    expect(copy).toContain("readiness: DeploymentReadiness");
    expect(copy).toContain("privacyBody: {");
    expect(copy).toContain("does not check for an account or session");
    expect(copy).toContain("prüft nur, ob bereits eine TryVit-Sitzung besteht");
    expect(shell).toContain("styles.sectionNavigation");
    expect(shell).toContain("styles.utilityNavigation");
    for (const href of ["#evidence", "#method", "#trust", "/contact"]) {
      expect(shell).toContain(`href="${href}"`);
    }
    expect(css).not.toMatch(/\.navigation\s*>\s*a:nth-child/u);
    expect(narrative).toContain("data-landing-package-specimen");
    expect(narrative).toContain("data-landing-package-title");
    expect(narrative).toContain("data-landing-synthetic-marker");
    expect(narrative).not.toContain('<div className={styles.packageSpecimen}');
    expect(sections).not.toContain("<LandingLockup");
    expect(shell).toContain("data-landing-market-descriptor");
    expect(copy).toContain('images: ["/twitter-image"]');
    expect(layout).toContain("!usesLandingProviderBoundary && <SpeedInsights />");
    for (const source of [socialCard, openGraph, twitter, manifest]) {
      expect(source).not.toMatch(
        /instantly|health score|healthy|harmful|scan, score|multi-axis/iu,
      );
      expect(source).not.toContain("fonts.gstatic.com");
    }
  });

  it("records route-family authorization without implying blanket Phase 5A.3 authority", () => {
    const roadmap = readFileSync(join(ROOT, "..", "docs", "PHASE5_IMPLEMENTATION_ROADMAP.md"), "utf8");
    expect(roadmap).toContain("each Phase 5A.3 route family requires separate authorization");
    expect(roadmap).toContain("authorized PR 1 (production landing and its route-local");
    expect(roadmap).toContain("no other Phase 5A.3 route family has begun");
  });
});
