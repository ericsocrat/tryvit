import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const browserReachableFiles = [
  "src/instrumentation-client.ts",
  "src/lib/web-vitals.ts",
  "src/lib/error-reporter.ts",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
];

const allowedServerStaticImports = [
  "src/app/auth/callback/route.ts",
  "src/instrumentation.ts",
  "src/lib/api-instrumentation.ts",
];

const runtimeStaticImportPattern =
  /^\s*(?:import(?!\s+type\b)|export(?!\s+type\b))\b[^\n;]*["']@sentry\/nextjs["']/mu;

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(path))) return [];
    if (/\.(?:test|spec)\.[^.]+$/u.test(path)) return [];
    return [path];
  });
}

describe("client Sentry source boundary", () => {
  it("keeps browser-reachable callers free of static SDK imports and requires", () => {
    for (const relativePath of browserReachableFiles) {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");

      expect(source, relativePath).not.toMatch(runtimeStaticImportPattern);
      expect(source, relativePath).not.toMatch(/require\(["']@sentry\/nextjs["']\)/u);
    }
  });

  it("limits every production static SDK import to the existing server boundary", () => {
    const requirePattern = /require\(["']@sentry\/nextjs["']\)/u;
    const staticImportFiles = productionSourceFiles(join(process.cwd(), "src"))
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return runtimeStaticImportPattern.test(source) || requirePattern.test(source);
      })
      .map((path) => relative(process.cwd(), path).replaceAll("\\", "/"))
      .sort();

    expect(staticImportFiles).toEqual(allowedServerStaticImports);
  });

  it("allows the SDK only behind the guarded dynamic adapter", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/client-sentry.ts"), "utf8");

    expect(source).toContain('import("@sentry/nextjs")');
    expect(source).toContain("if (!CLIENT_SENTRY_DSN");
    expect(source).toContain('typeof globalThis.window === "undefined"');
    expect(source).not.toMatch(runtimeStaticImportPattern);
    expect(source).not.toMatch(/require\(["']@sentry\/nextjs["']\)/u);
  });

  it("loads web-vitals dynamically only from the authenticated provider", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/AuthenticatedProviders.tsx"),
      "utf8",
    );

    expect(source).toContain('import("@/lib/web-vitals")');
    expect(source).not.toMatch(/import\s+[^;]*from\s+["']@\/lib\/web-vitals["']/u);
  });
});
