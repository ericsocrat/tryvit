/**
 * V1 compatibility implementation for the existing Card import surface.
 * Card — semantic container component replacing `.card` CSS class.
 *
 * Supports variants (default, elevated, outlined), padding sizes, and
 * semantic HTML via the `as` prop. All styling via design tokens.
 */

import {
    forwardRef,
    type ElementType,
    type HTMLAttributes,
    type ReactNode,
} from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CardVariant = "default" | "elevated" | "outlined";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children"
> {
  /** Visual style variant. @default "default" */
  readonly variant?: CardVariant;
  /** Padding preset. @default "md" */
  readonly padding?: CardPadding;
  /** Semantic HTML element. @default "div" */
  readonly as?: ElementType;
  /** Card content. */
  readonly children: ReactNode;
}

// ─── Style maps ─────────────────────────────────────────────────────────────

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default:
    "rounded-xl border border-default bg-surface/95 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[box-shadow,background-color,color] motion-reduce:transition-none",
  elevated:
    "rounded-xl bg-surface/95 shadow-md transition-[box-shadow,background-color,color] motion-reduce:transition-none",
  outlined:
    "rounded-xl border-2 border-strong bg-transparent transition-[box-shadow,background-color,color] motion-reduce:transition-none",
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

// ─── Component ──────────────────────────────────────────────────────────────

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    variant = "default",
    padding = "md",
    as: Component = "div",
    className = "",
    children,
    ...rest
  },
  ref,
) {
  return (
    <Component
      ref={ref}
      className={[VARIANT_CLASSES[variant], PADDING_CLASSES[padding], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </Component>
  );
});
