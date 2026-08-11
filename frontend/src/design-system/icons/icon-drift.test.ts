import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const governedRoots = [
  join(sourceRoot, "design-system"),
  join(sourceRoot, "app", "dev", "components", "catalog"),
] as const;

const GRANDFATHERED_LUCIDE_IMPORTS = new Set([
  "src/design-system/icons/registry.tsx",
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "compat-v1") return [];
      return sourceFiles(absolute);
    }
    if (!/\.tsx?$/u.test(entry.name) || /\.test\.tsx?$/u.test(entry.name)) {
      return [];
    }
    return [absolute];
  });
}

function repositoryPath(filename: string): string {
  return relative(process.cwd(), filename).replaceAll("\\", "/");
}

describe("V2 icon drift ratchet", () => {
  const governedFiles = governedRoots.flatMap(sourceFiles);

  it("allows icon-library imports only through the canonical registry", () => {
    const directImports = governedFiles
      .filter((filename) => /from\s+["']lucide-react["']/u.test(readFileSync(filename, "utf8")))
      .map(repositoryPath)
      .filter((filename) => !GRANDFATHERED_LUCIDE_IMPORTS.has(filename));

    expect(directImports).toEqual([]);
  });

  it("rejects new raw SVG and emoji interface glyphs", () => {
    const violations = governedFiles.flatMap((filename) => {
      const source = readFileSync(filename, "utf8");
      const reasons = [
        /<svg(?:\s|>)/u.test(source) ? "raw-svg" : null,
        /\p{Extended_Pictographic}/u.test(source) ? "emoji" : null,
      ].filter(Boolean);
      return reasons.map((reason) => `${repositoryPath(filename)}:${reason}`);
    });

    expect(violations).toEqual([]);
  });
});
