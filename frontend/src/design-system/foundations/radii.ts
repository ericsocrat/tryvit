import { primitiveValue } from "./from-manifest";

export const radii = Object.freeze({
  none: primitiveValue("radius.none"),
  small: primitiveValue("radius.small"),
  medium: primitiveValue("radius.medium"),
  large: primitiveValue("radius.large"),
  label: primitiveValue("radius.label"),
  round: primitiveValue("radius.round"),
});

export type RadiusName = keyof typeof radii;
