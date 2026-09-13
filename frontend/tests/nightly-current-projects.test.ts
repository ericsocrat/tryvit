import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const frontendRoot = path.resolve(__dirname, "..");
const config = readFileSync(path.join(frontendRoot, "playwright.config.ts"), "utf8");
const e2eFilenames = new Set(
  readdirSync(path.join(frontendRoot, "e2e")).filter((filename) => filename.endsWith(".spec.ts")),
);

function projectBlock(variableName: string): string {
  const start = config.indexOf(`const ${variableName} = {`);
  const end = config.indexOf("\nconst ", start + 1);
  expect(start, `${variableName} must exist`).toBeGreaterThanOrEqual(0);
  expect(end, `${variableName} must have a bounded definition`).toBeGreaterThan(start);
  return config.slice(start, end);
}

function allowlistedFilenames(block: string, prefix: string): string[] {
  const marker = `${prefix}-(?:`;
  const start = block.indexOf(marker);
  const suffix = ")\\.spec\\.ts$/u";
  const end = block.indexOf(suffix, start + marker.length);
  expect(start, `${prefix} allowlist must be explicit`).toBeGreaterThanOrEqual(0);
  expect(end, `${prefix} allowlist must be filename-anchored`).toBeGreaterThan(start);
  return block
    .slice(start + marker.length, end)
    .split("|")
    .map((name) => `${prefix}-${name}.spec.ts`);
}

describe("Nightly current behavior projects", () => {
  it("allowlists exactly the six proven authenticated specifications", () => {
    const block = projectBlock("nightlyAuthenticatedCurrentProject");
    const filenames = allowlistedFilenames(block, "authenticated");

    expect(filenames).toEqual([
      "authenticated-a11y.spec.ts",
      "authenticated-anonymous-landing-copy.spec.ts",
      "authenticated-evidence-first.spec.ts",
      "authenticated-health-profile-archive.spec.ts",
      "authenticated-landing.spec.ts",
      "authenticated-server-logout.spec.ts",
    ]);
    expect(filenames.every((filename) => e2eFilenames.has(filename))).toBe(true);
    expect(block).toContain('dependencies: ["auth-setup"]');
    expect(block).toContain('storageState: authStatePath("user.json")');
    expect(block).toContain("fullyParallel: false");
    expect(block).toContain("workers: 1");
  });

  it("allowlists exactly the four proven functional specifications", () => {
    const block = projectBlock("nightlyFunctionalCurrentProject");
    const filenames = allowlistedFilenames(block, "functional");

    expect(filenames).toEqual([
      "functional-error-states.spec.ts",
      "functional-lists-crud.spec.ts",
      "functional-onboarding.spec.ts",
      "functional-settings.spec.ts",
    ]);
    expect(filenames.every((filename) => e2eFilenames.has(filename))).toBe(true);
    expect(block).toContain('dependencies: ["nightly-functional-auth-setup"]');
    expect(block).toContain('storageState: authStatePath("nightly-functional-user.json")');
    expect(block).toContain("fullyParallel: false");
    expect(block).toContain("workers: 1");
  });

  it("registers the curated projects only for opted-in local Nightly runs", () => {
    expect(config).toContain(
      'const HAS_NIGHTLY_CURRENT_BEHAVIOR = enabled("NIGHTLY_CURRENT_BEHAVIOR")',
    );
    expect(config).toMatch(
      /\.\.\.\(HAS_NIGHTLY_CURRENT_BEHAVIOR && LOCAL_AUTHENTICATED[\s\S]*\? \[nightlyAuthenticatedCurrentProject, nightlyFunctionalCurrentProject\][\s\S]*: \[\]\)/u,
    );
    expect(config).toContain('name: "nightly-functional-auth-setup"');
    expect(config).toContain("nightlyFunctionalAuthSetupProject");
    expect(
      readFileSync(path.join(frontendRoot, "e2e", "nightly-functional.auth.setup.ts"), "utf8"),
    ).toContain('ensureScopedTestUser("nightly-functional")');
    expect(readFileSync(path.join(frontendRoot, "e2e", "global-teardown.ts"), "utf8")).toContain(
      'deleteScopedTestUser("nightly-functional")',
    );
    expect(config).toContain(
      "workers: process.env.CI || HAS_NIGHTLY_CURRENT_BEHAVIOR ? 1 : undefined",
    );
  });

  it("keeps stateful functional evidence fail-closed", () => {
    const readSpec = (filename: string) =>
      readFileSync(path.join(frontendRoot, "e2e", filename), "utf8");
    const errors = readSpec("functional-error-states.spec.ts");
    const lists = readSpec("functional-lists-crud.spec.ts");
    const settings = readSpec("functional-settings.spec.ts");

    expect(errors).toContain('getByRole("heading", { name: "Product not found" })');
    expect(errors).toContain('getByText("No saved searches yet")');
    expect(errors).toContain('getByText("No saved comparisons yet")');
    expect(lists).toContain('test.describe.configure({ mode: "serial" })');
    expect(lists).not.toMatch(/\.isVisible\([^)]*\)\s*\.catch\(\(\) => false\)/u);
    expect(lists).toContain("not.toBeVisible({ timeout: 10_000 })");
    expect(settings).not.toMatch(/\.isVisible\([^)]*\)\s*\.catch\(\(\) => false\)/u);
    expect(settings).toContain("Preferences saved!");
    expect(settings).toContain('toHaveAttribute("aria-pressed", "true")');
  });
});
