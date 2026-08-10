export const TOKEN_SECTION_ORDER = [
  "primitive",
  "semanticV2",
  "componentV2",
  "domain",
  "compatV1",
] as const;

export const TOKEN_THEME_ORDER = ["light", "dark", "highContrast"] as const;

export type TokenSectionName = (typeof TOKEN_SECTION_ORDER)[number];
export type TokenTheme = (typeof TOKEN_THEME_ORDER)[number];

export type TokenKind =
  | "border"
  | "breakpoint"
  | "color"
  | "dimension"
  | "duration"
  | "easing"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "letterSpacing"
  | "lineHeight"
  | "opacity"
  | "shadow"
  | "zIndex";

export interface TokenThemeValues {
  readonly light: string;
  readonly dark: string;
  readonly highContrast: string;
}

export interface TokenDefinition {
  readonly cssVariable: `--${string}`;
  readonly kind: TokenKind;
  readonly description: string;
  readonly values: TokenThemeValues;
}

export interface CompatTokenValues {
  readonly light: string;
  readonly dark: string;
}

export type TokenSection = Readonly<Record<string, TokenDefinition>>;
export type CompatTokenSection = Readonly<Record<`--${string}`, CompatTokenValues>>;

export interface TokenManifest {
  readonly primitive: TokenSection;
  readonly semanticV2: TokenSection;
  readonly componentV2: TokenSection;
  readonly domain: TokenSection;
  readonly compatV1: CompatTokenSection;
}

export interface ContrastContract {
  readonly name: string;
  readonly foreground: `${Exclude<TokenSectionName, "compatV1">}.${string}`;
  readonly background: `${Exclude<TokenSectionName, "compatV1">}.${string}`;
  readonly minimum: 3 | 4.5;
  readonly purpose: "normalText" | "uiOrFocus";
}

export function themes(
  light: string,
  dark: string = light,
  highContrast: string = light,
): TokenThemeValues {
  return Object.freeze({ light, dark, highContrast });
}

export function token(
  cssVariable: `--${string}`,
  kind: TokenKind,
  description: string,
  values: TokenThemeValues,
): TokenDefinition {
  return Object.freeze({ cssVariable, kind, description, values });
}

export function ref(
  section: Exclude<TokenSectionName, "compatV1">,
  tokenId: string,
): `{${Exclude<TokenSectionName, "compatV1">}.${string}}` {
  return `{${section}.${tokenId}}`;
}
