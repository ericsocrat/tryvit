import { tokenManifest } from "@/design-system/tokens/manifest";

import { primitiveValue } from "./from-manifest";

export const borderWidths = Object.freeze({
  hairline: primitiveValue("border.hairline"),
  standard: primitiveValue("border.standard"),
  strong: primitiveValue("border.strong"),
  focus: primitiveValue("border.focus"),
});

export const borderColorVariables = Object.freeze({
  subtle: tokenManifest.semanticV2["color.borderSubtle"].cssVariable,
  default: tokenManifest.semanticV2["color.borderDefault"].cssVariable,
  strong: tokenManifest.semanticV2["color.borderStrong"].cssVariable,
  focus: tokenManifest.semanticV2["color.borderFocus"].cssVariable,
});
