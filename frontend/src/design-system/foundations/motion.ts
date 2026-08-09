import { primitiveValue } from "./from-manifest";

export const motion = Object.freeze({
  duration: Object.freeze({
    instant: primitiveValue("motion.duration.instant"),
    fast: primitiveValue("motion.duration.fast"),
    standard: primitiveValue("motion.duration.standard"),
    slow: primitiveValue("motion.duration.slow"),
  }),
  easing: Object.freeze({
    standard: primitiveValue("motion.easing.standard"),
    decelerate: primitiveValue("motion.easing.decelerate"),
    accelerate: primitiveValue("motion.easing.accelerate"),
    expressive: primitiveValue("motion.easing.expressive"),
  }),
  displacement: Object.freeze({
    xs: primitiveValue("motion.displacement.xs"),
    sm: primitiveValue("motion.displacement.sm"),
    md: primitiveValue("motion.displacement.md"),
    lg: primitiveValue("motion.displacement.lg"),
  }),
  reducedDuration: Object.freeze({
    instant: primitiveValue("motion.duration.instant"),
    fast: primitiveValue("motion.duration.instant"),
    standard: primitiveValue("motion.duration.instant"),
    slow: primitiveValue("motion.duration.instant"),
  }),
});
