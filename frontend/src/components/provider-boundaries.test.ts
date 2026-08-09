import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const providersPath = join(sourceRoot, "components/Providers.tsx");
const initialLanguageContextPath = join(sourceRoot, "lib/initial-language-context.ts");
const clientI18nPath = join(sourceRoot, "lib/i18n.ts");
const clientMessagesPath = join(sourceRoot, "components/i18n/ClientMessagesProvider.tsx");
const toastPath = join(sourceRoot, "lib/toast.ts");
const globalErrorPath = join(sourceRoot, "app/global-error.tsx");
const providersSource = readFileSync(providersPath, "utf8");
const initialLanguageContextSource = readFileSync(initialLanguageContextPath, "utf8");
const authenticatedSource = readFileSync(
  join(process.cwd(), "src/components/AuthenticatedProviders.tsx"),
  "utf8",
);
const appLayoutSource = readFileSync(join(process.cwd(), "src/app/app/layout.tsx"), "utf8");
const languageHydratorSource = readFileSync(
  join(process.cwd(), "src/components/i18n/LanguageHydrator.tsx"),
  "utf8",
);

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

function collectProductionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectProductionSourceFiles(entryPath);
    if (!entry.isFile() || !/\.[jt]sx?$/u.test(entry.name)) return [];
    if (/\.(?:test|spec)\.[jt]sx?$/u.test(entry.name)) return [];
    return [entryPath];
  });
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
    const dependencyPaths = [...collectLocalDependencyGraph(providersPath)].map((dependency) =>
      relative(process.cwd(), dependency).replaceAll("\\", "/"),
    );

    expect(providersSource).toContain("@/lib/initial-language-context");
    expect(initialLanguageContextSource).not.toMatch(
      /i18n-core|messages\/(?:en|pl|de)\.json|language-store/u,
    );
    expect(dependencyPaths).not.toContain("src/lib/i18n.ts");
    expect(dependencyPaths).not.toContain("src/lib/i18n-core.ts");
    expect(dependencyPaths.some((dependency) => dependency.includes("messages/"))).toBe(false);
  });

  it("keeps eager client translation graphs out of the server dictionary registry", () => {
    const eagerClientDependencies = [
      clientI18nPath,
      clientMessagesPath,
      toastPath,
      globalErrorPath,
    ].flatMap((entry) => [...collectLocalDependencyGraph(entry)]);
    const relativeDependencies = new Set(
      eagerClientDependencies.map((dependency) =>
        relative(process.cwd(), dependency).replaceAll("\\", "/"),
      ),
    );
    const clientMessagesSource = readFileSync(clientMessagesPath, "utf8");

    expect(relativeDependencies).not.toContain("src/lib/i18n-core.ts");
    expect(relativeDependencies).not.toContain("src/lib/i18n-server.ts");
    expect([...relativeDependencies].some((dependency) => dependency.startsWith("messages/"))).toBe(
      false,
    );
    expect(clientMessagesSource).toContain('import("@/../messages/en.json")');
    expect(clientMessagesSource).toContain('import("@/../messages/pl.json")');
    expect(clientMessagesSource).toContain('import("@/../messages/de.json")');
  });

  it("keeps backend providers behind the authenticated app layout", () => {
    expect(authenticatedSource).toContain("QueryClientProvider");
    expect(authenticatedSource).toContain("initAchievementMiddleware");
    expect(appLayoutSource).toContain("<AuthenticatedProviders>");
  });

  it("keeps the dormant flag subsystem out of the authenticated startup path", () => {
    const flagSubsystem = `${join(sourceRoot, "lib", "flags")}${process.platform === "win32" ? "\\" : "/"}`;
    const flagApiRoute = join(sourceRoot, "app", "api", "flags", "route.ts");
    const unexpectedFlagImports = collectProductionSourceFiles(sourceRoot)
      .filter((sourcePath) => !sourcePath.startsWith(flagSubsystem) && sourcePath !== flagApiRoute)
      .flatMap((sourcePath) => {
        const source = readFileSync(sourcePath, "utf8");
        const importsFlagSubsystem = [...source.matchAll(localImportPattern)].some((match) => {
          const dependency = resolveLocalModule(sourcePath, match[1]);
          return dependency?.startsWith(flagSubsystem) ?? false;
        });
        return importsFlagSubsystem ? [relative(sourceRoot, sourcePath).replaceAll("\\", "/")] : [];
      });

    expect(authenticatedSource).not.toContain("FlagProvider");
    expect(unexpectedFlagImports).toEqual([]);
  });

  it("reuses server-resolved language preferences without a duplicate browser RPC", () => {
    expect(appLayoutSource).toContain("preferredLanguage={prefs.preferred_language}");
    expect(languageHydratorSource).not.toContain("getUserPreferences");
    expect(languageHydratorSource).not.toContain("@/lib/supabase");
    expect(languageHydratorSource).not.toContain("@tanstack/react-query");
  });
});
