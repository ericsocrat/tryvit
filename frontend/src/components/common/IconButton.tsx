/**
 * IconButton — square button for toolbar/icon-only actions.
 *
 * Always requires an accessible `label` (rendered as `aria-label`).
 * Variants and sizes match the Button component.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type IconButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  /** The icon element to render. */
  readonly icon: ReactNode;
  /** Accessible label (aria-label). Required for icon-only buttons. */
  readonly label: string;
  /** Visual style variant. @default "ghost" */
  readonly variant?: IconButtonVariant;
  /** Size preset. @default "md" */
  readonly size?: IconButtonSize;
}

// ─── Style maps ─────────────────────────────────────────────────────────────

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  primary:
    "bg-brand text-foreground-inverse shadow-[0_4px_12px_rgba(15,23,42,0.14)] hover:bg-brand-hover",
  secondary:
    "border border-strong bg-surface/95 text-foreground-secondary hover:bg-surface-subtle",
  ghost:
    "text-foreground-secondary hover:bg-surface-subtle",
  danger: "text-error hover:bg-error/10",
};

const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: "h-7 w-7 text-sm rounded-md",
  md: "h-9 w-9 text-base rounded-lg",
  lg: "h-11 w-11 text-lg rounded-lg",
};

// ─── Component ──────────────────────────────────────────────────────────────

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      label,
      variant = "ghost",
      size = "md",
      className = "",
      disabled,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        aria-label={label}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow,background-color,color] motion-reduce:transition-none",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/30",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "touch-target-expanded",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ touchAction: "manipulation" }}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);
