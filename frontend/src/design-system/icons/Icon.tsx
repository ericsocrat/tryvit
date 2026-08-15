import { createElement } from "react";

import styles from "./Icon.module.css";
import { iconForName, type IconName } from "./registry";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface IconProps {
  readonly name: IconName;
  readonly size?: IconSize;
  /** Omit for a decorative icon rendered beside a text label. */
  readonly label?: string;
  readonly className?: string;
}

/** Registry-backed icon with one sizing, stroke, alignment and naming contract. */
export function Icon({
  name,
  size = "md",
  label,
  className = "",
}: Readonly<IconProps>) {
  if (label !== undefined && (typeof label !== "string" || !label.trim())) {
    throw new TypeError("Icon label must be non-empty when the glyph is informational.");
  }
  const decorative = !label;
  return createElement(iconForName(name), {
    "aria-hidden": decorative ? "true" : undefined,
    "aria-label": label,
    className: [styles.icon, styles[size], className].filter(Boolean).join(" "),
    color: "currentColor",
    fill: "none",
    focusable: "false",
    role: label ? "img" : undefined,
    stroke: "currentColor",
    strokeWidth: 2,
    vectorEffect: "non-scaling-stroke",
  });
}

export type { IconName } from "./registry";
