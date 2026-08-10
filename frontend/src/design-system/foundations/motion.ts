import { primitiveValue } from "./from-manifest";

export const motion = Object.freeze({
  duration: Object.freeze({
    instant: primitiveValue("motion.duration.instant"),
    feedback: primitiveValue("motion.duration.feedback"),
    fast: primitiveValue("motion.duration.fast"),
    standard: primitiveValue("motion.duration.standard"),
    deliberate: primitiveValue("motion.duration.deliberate"),
    narrativeMax: primitiveValue("motion.duration.narrativeMax"),
  }),
  easing: Object.freeze({
    standard: primitiveValue("motion.easing.standard"),
    emphasizedDecelerate: primitiveValue("motion.easing.emphasizedDecelerate"),
    emphasizedAccelerate: primitiveValue("motion.easing.emphasizedAccelerate"),
    linearProgress: primitiveValue("motion.easing.linearProgress"),
  }),
  displacement: Object.freeze({
    xs: primitiveValue("motion.displacement.xs"),
    sm: primitiveValue("motion.displacement.sm"),
    md: primitiveValue("motion.displacement.md"),
    lg: primitiveValue("motion.displacement.lg"),
  }),
  reducedDuration: Object.freeze({
    instant: primitiveValue("motion.duration.instant"),
    feedback: primitiveValue("motion.duration.instant"),
    fast: primitiveValue("motion.duration.instant"),
    standard: primitiveValue("motion.duration.instant"),
    deliberate: primitiveValue("motion.duration.instant"),
    narrativeMax: primitiveValue("motion.duration.instant"),
  }),
  recipe: Object.freeze({
    stateReset: Object.freeze({ duration: "instant", easing: "standard", displacement: null, properties: [] as const, reduced: "final-state-immediate" }),
    press: Object.freeze({ duration: "feedback", easing: "standard", displacement: "xs", properties: ["transform"] as const, reduced: "final-state-immediate" }),
    iconState: Object.freeze({ duration: "feedback", easing: "standard", displacement: "xs", properties: ["transform", "opacity"] as const, reduced: "final-state-immediate" }),
    hoverFocus: Object.freeze({ duration: "fast", easing: "standard", displacement: "xs", properties: ["transform", "opacity"] as const, reduced: "final-state-immediate" }),
    disclosureEnter: Object.freeze({ duration: "standard", easing: "emphasizedDecelerate", displacement: "sm", properties: ["transform", "opacity"] as const, reduced: "final-state-immediate" }),
    disclosureExit: Object.freeze({ duration: "fast", easing: "emphasizedAccelerate", displacement: "sm", properties: ["transform", "opacity"] as const, reduced: "final-state-immediate" }),
    overlayEnter: Object.freeze({ duration: "deliberate", easing: "emphasizedDecelerate", displacement: "md", properties: ["transform", "opacity"] as const, reduced: "final-state-immediate" }),
    overlayExit: Object.freeze({ duration: "fast", easing: "emphasizedAccelerate", displacement: "md", properties: ["transform", "opacity"] as const, reduced: "final-state-immediate" }),
    sectionReveal: Object.freeze({ duration: "deliberate", easing: "emphasizedDecelerate", displacement: "md", properties: ["transform", "opacity"] as const, reduced: "final-state-immediate" }),
    spatialContinuity: Object.freeze({ duration: "deliberate", easing: "standard", displacement: "lg", properties: ["transform", "opacity"] as const, reduced: "final-state-immediate" }),
    determinateProgress: Object.freeze({ duration: "standard", easing: "linearProgress", displacement: null, properties: ["transform"] as const, reduced: "final-state-immediate" }),
    landingSharedLabel: Object.freeze({ duration: "narrativeMax", easing: "emphasizedDecelerate", displacement: "lg", properties: ["transform", "opacity"] as const, reduced: "final-state-immediate" }),
  }),
});
