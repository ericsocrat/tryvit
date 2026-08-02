import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const providersPath = join(sourceRoot, "components/Providers.tsx");
const initialLanguageContextPath = join(
  sourceRoot,
  "lib/initial-language-context.ts",
);
const providersSource = readFileSync(providersPath, "utf8");
const initialLanguageContextSource = readFileSync(
  initialLanguageContextPath,
  "utf8",
);
const authenticatedSource = readFileSync(
  join(process.cwd(), "src/components/AuthenticatedProviders.tsx"),
  "utf8",
);
const appLayoutSource = readFileSync(join(process.cwd(), "src/app/app/layout.tsx"), "utf8");

const localImportPattern =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/gu;

function resolveLocalModule(importer: string, specifier: string): string | null {
  const unresolved = specifier.startsWith("@/")
    ? resolve(sourceRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(importer), specifier)
      : null;
  if (!unresolved) return null;

  const candidates = extname(unresolved)
    ? [unresolved]
    : [
        unresolved,
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        `${unresolved}.js`,
        `${unresolved}.jsx`,
        join(unresolved, "index.ts"),
        join(unresolved, "index.tsx"),
      ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectLocalDependencyGraph(entry: string): Set<string> {
  const visited = new Set<string>();
  const pending = [entry];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const source = readFileSync(current, "utf8");
    for (const match of source.matchAll(localImportPattern)) {
      const dependency = resolveLocalModule(current, match[1]);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }

  return visited;
}

describe("provider route boundaries", () => {
  it("keeps the root provider free of backend and authenticated dependencies", () => {
    expect(providersSource).not.toContain("@tanstack/react-query");
    expect(providersSource).not.toContain("@/lib/supabase");
    expect(providersSource).not.toContain("@/lib/flags");
    expect(providersSource).not.toContain("@/lib/events");
    expect(providersSource).not.toContain("@/lib/web-vitals");
  });

  it("keeps the root provider import graph free of translation dictionaries", () => {
    const dependencyPaths = [...collectLocalDependencyGraph(providersPath)].map(
      (dependency) => relative(process.cwd(), dependency).replaceAll("\\", "/"),
    );

    expect(providersSource).toContain("@/lib/initial-language-context");
    expect(initialLanguageContextSource).not.toMatch(
      /i18n-core|messages\/(?:en|pl|de)\.json|language-store/u,
    );
    expect(dependencyPaths).not.toContain("src/lib/i18n.ts");
    expect(dependencyPaths).not.toContain("src/lib/i18n-core.ts");
    expect(dependencyPaths.some((dependency) => dependency.includes("messages/"))).toBe(false);
  });

  it("keeps backend providers behind the authenticated app layout", () => {
    expect(authenticatedSource).toContain("QueryClientProvider");
    expect(authenticatedSource).toContain("FlagProvider");
    expect(authenticatedSource).toContain("initAchievementMiddleware");
    expect(appLayoutSource).toContain("<AuthenticatedProviders>");
  });
});
