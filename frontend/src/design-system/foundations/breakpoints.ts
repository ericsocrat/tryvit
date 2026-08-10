import { primitiveValue } from "./from-manifest";

export const breakpoints = Object.freeze({
  compact: primitiveValue("breakpoint.compact"),
  medium: primitiveValue("breakpoint.medium"),
  wide: primitiveValue("breakpoint.wide"),
  canvas: primitiveValue("breakpoint.canvas"),
});

export const breakpointPixels = Object.freeze(
  Object.fromEntries(
    Object.entries(breakpoints).map(([name, value]) => [
      name,
      Number.parseInt(value, 10),
    ]),
  ) as Record<keyof typeof breakpoints, number>,
);

export type BreakpointName = keyof typeof breakpoints;
