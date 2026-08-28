import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

type LockEntry = {
  readonly version?: string;
  readonly dev?: boolean;
  readonly dependencies?: Readonly<Record<string, string>>;
};

type PackageLock = {
  readonly packages: Readonly<Record<string, LockEntry>>;
};

const frontendRoot = process.cwd();
const repositoryRoot = join(frontendRoot, "..");
const packageManifest = JSON.parse(
  readFileSync(join(frontendRoot, "package.json"), "utf8"),
) as {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};
const packageLock = JSON.parse(
  readFileSync(join(frontendRoot, "package-lock.json"), "utf8"),
) as PackageLock;
const visualSafetyCli = readFileSync(
  join(frontendRoot, "e2e", "scripts", "visual-safety-cli.mts"),
  "utf8",
);
const lighthouseWorkflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "lighthouse-ci.yml"),
  "utf8",
);

const ownedCodeExtensions = new Set([".cjs", ".js", ".json", ".mjs", ".mts", ".ts", ".tsx", ".yaml", ".yml"]);
const archivePackageImport = /(?:from\s+|require\s*\(|import\s*\()\s*["'](?:extract-zip|@puppeteer\/browsers)["']/u;

function ownedArchivePackageImports(directory: string): string[] {
  const matches: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...ownedArchivePackageImports(path));
      continue;
    }
    if (!entry.isFile() || !ownedCodeExtensions.has(extname(entry.name))) continue;
    if (archivePackageImport.test(readFileSync(path, "utf8"))) {
      matches.push(relative(repositoryRoot, path).replaceAll("\\", "/"));
    }
  }
  return matches;
}

describe("dependency security disposition", () => {
  it("locks both js-yaml branches to patched in-range releases", () => {
    expect(packageLock.packages["node_modules/@lhci/utils/node_modules/js-yaml"]?.version).toBe(
      "3.15.2",
    );
    expect(packageLock.packages["node_modules/js-yaml"]?.version).toBe("4.3.2");
  });

  it("keeps extract-zip transitive and development-only", () => {
    expect(packageManifest.dependencies?.["extract-zip"]).toBeUndefined();
    expect(packageManifest.devDependencies?.["extract-zip"]).toBeUndefined();
    expect(packageManifest.devDependencies?.["@lhci/cli"]).toBe("^0.15.1");

    expect(packageLock.packages["node_modules/@lhci/cli"]?.dev).toBe(true);
    expect(packageLock.packages["node_modules/lighthouse"]?.dev).toBe(true);
    expect(packageLock.packages["node_modules/puppeteer-core"]?.dev).toBe(true);
    expect(packageLock.packages["node_modules/@puppeteer/browsers"]?.dev).toBe(true);
    expect(packageLock.packages["node_modules/extract-zip"]?.dev).toBe(true);

    expect(packageLock.packages["node_modules/@lhci/cli"]?.dependencies?.lighthouse).toBe(
      "12.6.1",
    );
    expect(packageLock.packages["node_modules/lighthouse"]?.dependencies?.["puppeteer-core"]).toBe(
      "^24.10.0",
    );
    expect(
      packageLock.packages["node_modules/puppeteer-core"]?.dependencies?.[
        "@puppeteer/browsers"
      ],
    ).toBe("2.13.0");
    expect(
      packageLock.packages["node_modules/@puppeteer/browsers"]?.dependencies?.["extract-zip"],
    ).toBe("^2.0.1");
  });

  it("uses the pinned Playwright browser without repo-owned archive extraction", () => {
    expect(visualSafetyCli).toContain("playwright.chromium.executablePath()");
    expect(visualSafetyCli).toContain("env.CHROME_PATH = chromium.path;");
    expect(lighthouseWorkflow).toContain("Install pinned Playwright Chromium");
    expect(lighthouseWorkflow).toContain("npx playwright install --with-deps chromium");

    const imports = [
      join(frontendRoot, "src"),
      join(frontendRoot, "e2e", "scripts"),
      join(frontendRoot, "tooling"),
      join(repositoryRoot, ".github"),
    ].flatMap(ownedArchivePackageImports);
    expect(imports).toEqual([]);
  });
});
