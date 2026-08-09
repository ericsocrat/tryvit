// @ts-expect-error TS5097: imported by the standalone token generator.
import { TOKEN_SECTION_ORDER, TOKEN_THEME_ORDER } from "./schema.ts";
import type {
  TokenDefinition,
  TokenManifest,
  TokenSectionName,
  TokenTheme,
} from "./schema";

const REFERENCE_PATTERN =
  /^\{(primitive|semanticV2|componentV2|domain)\.(.+)\}$/;

type V2SectionName = Exclude<TokenSectionName, "compatV1">;

function compareOrdinal(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

const ALLOWED_REFERENCE_SECTIONS: Readonly<
  Record<V2SectionName, readonly V2SectionName[]>
> = Object.freeze({
  primitive: [],
  semanticV2: ["primitive"],
  componentV2: ["semanticV2"],
  domain: ["primitive"],
});

export interface ParsedTokenReference {
  readonly section: V2SectionName;
  readonly tokenId: string;
}

export function parseTokenReference(
  value: string,
): ParsedTokenReference | undefined {
  const match = value.match(REFERENCE_PATTERN);
  if (!match) return undefined;

  return {
    section: match[1] as V2SectionName,
    tokenId: match[2],
  };
}

function getV2Definition(
  manifest: TokenManifest,
  section: V2SectionName,
  tokenId: string,
): TokenDefinition | undefined {
  return manifest[section][tokenId];
}

function fullTokenId(section: V2SectionName, tokenId: string): string {
  return `${section}.${tokenId}`;
}

export function resolveTokenValue(
  manifest: TokenManifest,
  tokenPath: `${V2SectionName}.${string}`,
  theme: TokenTheme,
): string {
  const separator = tokenPath.indexOf(".");
  const section = tokenPath.slice(0, separator) as V2SectionName;
  const tokenId = tokenPath.slice(separator + 1);
  const visited = new Set<string>();

  function resolve(currentSection: V2SectionName, currentId: string): string {
    const currentPath = fullTokenId(currentSection, currentId);
    if (visited.has(currentPath)) {
      throw new Error(`Token reference cycle: ${[...visited, currentPath].join(" -> ")}`);
    }

    const definition = getV2Definition(manifest, currentSection, currentId);
    if (!definition) throw new Error(`Unknown token reference: ${currentPath}`);

    visited.add(currentPath);
    const rawValue = definition.values[theme];
    const reference = parseTokenReference(rawValue);
    const resolved = reference
      ? resolve(reference.section, reference.tokenId)
      : rawValue;
    visited.delete(currentPath);
    return resolved;
  }

  return resolve(section, tokenId);
}

export function tokenValueToCss(
  manifest: TokenManifest,
  value: string,
): string {
  const reference = parseTokenReference(value);
  if (!reference) return value;

  const definition = getV2Definition(
    manifest,
    reference.section,
    reference.tokenId,
  );
  if (!definition) throw new Error(`Unknown token reference: ${value}`);
  return `var(${definition.cssVariable})`;
}

export function validateTokenManifest(manifest: TokenManifest): string[] {
  const errors: string[] = [];
  const actualSectionOrder = Object.keys(manifest);
  if (actualSectionOrder.join("|") !== TOKEN_SECTION_ORDER.join("|")) {
    errors.push(
      `Manifest section order must be ${TOKEN_SECTION_ORDER.join(", ")}`,
    );
  }

  const cssVariableOwners = new Map<string, string>();
  const graph = new Map<string, string[]>();

  for (const section of TOKEN_SECTION_ORDER.slice(0, -1) as readonly V2SectionName[]) {
    const entries = Object.entries(manifest[section]);
    if (entries.length === 0) errors.push(`${section} must not be empty`);

    for (const [tokenId, definition] of entries) {
      const path = fullTokenId(section, tokenId);
      const priorOwner = cssVariableOwners.get(definition.cssVariable);
      if (priorOwner) {
        errors.push(
          `CSS variable ${definition.cssVariable} is shared by ${priorOwner} and ${path}`,
        );
      } else {
        cssVariableOwners.set(definition.cssVariable, path);
      }

      if (section === "primitive" && !definition.cssVariable.startsWith("--ds-")) {
        errors.push(`Private primitive ${path} must use a --ds-* CSS variable`);
      }

      const references: string[] = [];
      for (const theme of TOKEN_THEME_ORDER) {
        const value = definition.values[theme];
        if (typeof value !== "string" || value.length === 0) {
          errors.push(`${path} is missing a non-empty ${theme} value`);
          continue;
        }

        const reference = parseTokenReference(value);
        if (!reference) {
          if (value.startsWith("{") || value.includes("var(--")) {
            errors.push(
              `${path} ${theme} must use a valid manifest reference instead of ${value}`,
            );
          }
          continue;
        }

        const referenced = getV2Definition(
          manifest,
          reference.section,
          reference.tokenId,
        );
        if (!referenced) {
          errors.push(`${path} ${theme} references missing token ${value}`);
          continue;
        }

        if (!ALLOWED_REFERENCE_SECTIONS[section].includes(reference.section)) {
          errors.push(
            `${path} may not reference ${reference.section}; allowed: ${ALLOWED_REFERENCE_SECTIONS[
              section
            ].join(", ") || "literal values only"}`,
          );
        }
        references.push(fullTokenId(reference.section, reference.tokenId));
      }
      graph.set(path, [...new Set(references)]);
    }
  }

  const compatCssVariables = new Set(Object.keys(manifest.compatV1));
  if (compatCssVariables.size === 0) errors.push("compatV1 must not be empty");
  for (const [cssVariable, values] of Object.entries(manifest.compatV1)) {
    const compatPath = `compatV1.${cssVariable}`;
    if (!cssVariable.startsWith("--")) {
      errors.push(`compatV1 key ${cssVariable} is not a CSS variable`);
    }
    const priorOwner = cssVariableOwners.get(cssVariable);
    if (priorOwner) {
      errors.push(
        `CSS variable ${cssVariable} is shared by ${priorOwner} and ${compatPath}`,
      );
    } else {
      cssVariableOwners.set(cssVariable, compatPath);
    }

    const references: string[] = [];
    for (const theme of ["light", "dark"] as const) {
      const value = values[theme];
      if (typeof value !== "string" || value.length === 0) {
        errors.push(`compatV1 ${cssVariable} is missing ${theme}`);
      }
      for (const match of value.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
        if (!compatCssVariables.has(match[1])) {
          errors.push(
            `compatV1 ${cssVariable} ${theme} references missing ${match[1]}`,
          );
        } else {
          references.push(`compatV1.${match[1]}`);
        }
      }
    }
    graph.set(compatPath, [...new Set(references)]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(node: string, stack: readonly string[]): void {
    if (visiting.has(node)) {
      errors.push(`Token reference cycle: ${[...stack, node].join(" -> ")}`);
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    for (const dependency of graph.get(node) ?? []) {
      visit(dependency, [...stack, node]);
    }
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) visit(node, []);
  return [...new Set(errors)].sort(compareOrdinal);
}

export function assertValidTokenManifest(manifest: TokenManifest): void {
  const errors = validateTokenManifest(manifest);
  if (errors.length > 0) {
    throw new Error(`Invalid design-token manifest:\n- ${errors.join("\n- ")}`);
  }
}
