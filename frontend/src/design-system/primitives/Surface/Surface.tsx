import {
  forwardRef,
  type ElementType,
  type ReactNode,
} from "react";

import {
  assertInertHostProps,
  type InertHostAttributes,
} from "@/design-system/primitives/shared/inert-host";

import styles from "./Surface.module.css";

export type SurfaceLayer = "base" | "raised" | "overlay";
export type SurfaceDensity = "none" | "compact" | "default" | "spacious";
export type SurfaceBoundary = "none" | "default" | "strong";

const SURFACE_ELEMENTS = ["div", "section", "article", "aside"] as const;

export type SurfaceElement = (typeof SURFACE_ELEMENTS)[number];

export interface SurfaceProps extends Omit<InertHostAttributes, "children"> {
  readonly as?: SurfaceElement;
  /** Semantic stacking level; visual treatment remains recipe-controlled. */
  readonly layer?: SurfaceLayer;
  readonly density?: SurfaceDensity;
  readonly boundary?: SurfaceBoundary;
  readonly children: ReactNode;
}

const BOUNDARY_CLASS: Readonly<Record<SurfaceBoundary, string>> = {
  none: styles.boundaryNone,
  default: styles.boundaryDefault,
  strong: styles.boundaryStrong,
};

const DENSITY_CLASS: Readonly<Record<SurfaceDensity, string>> = {
  none: styles.densityNone,
  compact: styles.densityCompact,
  default: styles.densityDefault,
  spacious: styles.densitySpacious,
};

/** Server-compatible semantic surface; final art direction lives in its recipe. */
export const Surface = forwardRef<HTMLElement, SurfaceProps>(function Surface(
  properties,
  ref,
) {
  assertInertHostProps(
    properties as unknown as Readonly<Record<string, unknown>>,
    "Surface",
  );
  const {
    as: element = "div",
    layer = "base",
    density = "default",
    boundary = "default",
    className = "",
    children,
    ...rest
  } = properties;
  if (!SURFACE_ELEMENTS.includes(element)) {
    throw new TypeError(
      `Surface must use a noninteractive semantic element; received "${element}".`,
    );
  }

  const Component = element as ElementType;

  return (
    <Component
      {...rest}
      ref={ref}
      className={[
        styles.root,
        styles[layer],
        BOUNDARY_CLASS[boundary],
        DENSITY_CLASS[density],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-boundary={boundary}
      data-density={density}
      data-layer={layer}
    >
      {children}
    </Component>
  );
});
