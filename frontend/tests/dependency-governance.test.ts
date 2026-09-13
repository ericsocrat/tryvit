import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  overrides?: Record<string, unknown>;
};

type PackageLock = {
  packages: Record<string, { version?: string; dependencies?: Record<string, string> }>;
};

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as PackageManifest;
const lock = JSON.parse(
  readFileSync(resolve(process.cwd(), "package-lock.json"), "utf8"),
) as PackageLock;

function numericVersion(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Expected an exact semantic version, received ${version}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isAtLeast(version: string, floor: string): boolean {
  const actual = numericVersion(version);
  const minimum = numericVersion(floor);
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== minimum[index]) {
      return actual[index]! > minimum[index]!;
    }
  }
  return true;
}

describe("dependency governance", () => {
  it("pins Next.js runtime and lint packages to the same exact version", () => {
    const nextVersion = manifest.dependencies.next;
    const eslintConfigVersion = manifest.devDependencies["eslint-config-next"];

    expect(numericVersion(nextVersion)).toBeDefined();
    expect(eslintConfigVersion).toBe(nextVersion);
    expect(lock.packages["node_modules/next"]?.version).toBe(nextVersion);
    expect(lock.packages["node_modules/eslint-config-next"]?.version).toBe(nextVersion);
    expect(lock.packages["node_modules/@next/eslint-plugin-next"]?.version).toBe(nextVersion);
  });

  it("does not retain an override selector for a different Next.js version", () => {
    const nextVersion = manifest.dependencies.next;
    const nextOverrideSelectors = Object.keys(manifest.overrides ?? {}).filter((key) =>
      key.startsWith("next@"),
    );

    expect(nextOverrideSelectors.every((key) => key === `next@${nextVersion}`)).toBe(true);
  });

  it("keeps baseline-browser-mapping at the patched security floor", () => {
    const baselineVersion = lock.packages["node_modules/baseline-browser-mapping"]?.version;

    expect(baselineVersion).toBeDefined();
    expect(isAtLeast(baselineVersion!, "2.11.0")).toBe(true);
  });
});
