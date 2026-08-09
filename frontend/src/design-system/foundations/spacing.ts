import { primitiveValue } from "./from-manifest";

export const spacing = Object.freeze({
  0: primitiveValue("space.0"),
  1: primitiveValue("space.1"),
  2: primitiveValue("space.2"),
  3: primitiveValue("space.3"),
  4: primitiveValue("space.4"),
  6: primitiveValue("space.6"),
  8: primitiveValue("space.8"),
  10: primitiveValue("space.10"),
  12: primitiveValue("space.12"),
  16: primitiveValue("space.16"),
  20: primitiveValue("space.20"),
  24: primitiveValue("space.24"),
});

export type SpacingStep = keyof typeof spacing;
