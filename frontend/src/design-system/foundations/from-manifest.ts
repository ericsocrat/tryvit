import {
  tokenManifest,
  type PrimitiveTokenId,
} from "@/design-system/tokens/manifest";
import type { TokenTheme } from "@/design-system/tokens/schema";

export type FoundationTheme = Extract<TokenTheme, "light" | "dark">;

export function primitiveValue(
  tokenId: PrimitiveTokenId,
  theme: TokenTheme = "light",
): string {
  return tokenManifest.primitive[tokenId].values[theme];
}

export function primitiveCssVariable(tokenId: PrimitiveTokenId): string {
  return tokenManifest.primitive[tokenId].cssVariable;
}
