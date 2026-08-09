import { tokenManifest } from "@/design-system/tokens/manifest";

import type { FoundationTheme } from "./from-manifest";

const ELEVATION_TOKEN_IDS = [
  "elevation.none",
  "elevation.raised",
  "elevation.overlay",
  "elevation.floating",
] as const;

export const elevationNames = Object.freeze([
  "none",
  "raised",
  "overlay",
  "floating",
] as const);

/** The only four permitted elevation recipes. */
export function elevation(theme: FoundationTheme = "light") {
  return Object.freeze({
    none: tokenManifest.primitive[ELEVATION_TOKEN_IDS[0]].values[theme],
    raised: tokenManifest.primitive[ELEVATION_TOKEN_IDS[1]].values[theme],
    overlay: tokenManifest.primitive[ELEVATION_TOKEN_IDS[2]].values[theme],
    floating: tokenManifest.primitive[ELEVATION_TOKEN_IDS[3]].values[theme],
  });
}

export type ElevationName = (typeof elevationNames)[number];
