import { primitiveValue } from "./from-manifest";

import { createFontAssay } from "@/design-system/tokens/font-assay";

export const fontFamilies = Object.freeze({
  sans: primitiveValue("type.family.sans"),
  display: primitiveValue("type.family.display"),
  mono: primitiveValue("type.family.mono"),
});

function typeRole(
  size: Parameters<typeof primitiveValue>[0],
  weight: Parameters<typeof primitiveValue>[0],
  lineHeight: Parameters<typeof primitiveValue>[0],
  tracking: Parameters<typeof primitiveValue>[0],
  family: Parameters<typeof primitiveValue>[0] = "type.family.sans",
) {
  return Object.freeze({
    fontFamily: primitiveValue(family),
    fontSize: primitiveValue(size),
    fontWeight: primitiveValue(weight),
    lineHeight: primitiveValue(lineHeight),
    letterSpacing: primitiveValue(tracking),
  });
}

export const typeRoles = Object.freeze({
  displayHero: typeRole(
    "type.size.9",
    "type.weight.extrabold",
    "type.lineHeight.tight",
    "type.tracking.tight",
    "type.family.display",
  ),
  display: typeRole(
    "type.size.8",
    "type.weight.bold",
    "type.lineHeight.tight",
    "type.tracking.tight",
    "type.family.display",
  ),
  heading1: typeRole(
    "type.size.7",
    "type.weight.bold",
    "type.lineHeight.heading",
    "type.tracking.heading",
    "type.family.display",
  ),
  heading2: typeRole(
    "type.size.6",
    "type.weight.semibold",
    "type.lineHeight.heading",
    "type.tracking.heading",
    "type.family.display",
  ),
  heading3: typeRole(
    "type.size.5",
    "type.weight.semibold",
    "type.lineHeight.heading",
    "type.tracking.heading",
  ),
  bodyLarge: typeRole(
    "type.size.4",
    "type.weight.regular",
    "type.lineHeight.body",
    "type.tracking.normal",
  ),
  body: typeRole(
    "type.size.3",
    "type.weight.regular",
    "type.lineHeight.body",
    "type.tracking.normal",
  ),
  bodySmall: typeRole(
    "type.size.2",
    "type.weight.regular",
    "type.lineHeight.compact",
    "type.tracking.normal",
  ),
  label: typeRole(
    "type.size.1",
    "type.weight.bold",
    "type.lineHeight.compact",
    "type.tracking.label",
  ),
  caption: typeRole(
    "type.size.1",
    "type.weight.medium",
    "type.lineHeight.caption",
    "type.tracking.normal",
  ),
});

/** No candidate font is adopted until every assay evidence field is proven. */
export const fontAssay = createFontAssay(fontFamilies.sans);

export type TypeRole = keyof typeof typeRoles;
