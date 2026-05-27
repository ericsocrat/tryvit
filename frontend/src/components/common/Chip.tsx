/**
 * Chip — removable tag component for active filters, category tags.
 *
 * Extends the ActiveFilterChips pattern. Supports interactive (click) and
 * removable (onRemove) modes.
 */

import { X } from "lucide-react";
import React, { type KeyboardEvent, type ReactNode } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChipVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error";

export interface ChipProps {
  /** Chip label content. */
  readonly children: ReactNode;
  /** Visual style variant. @default "default" */
  readonly variant?: ChipVariant;
  /** Whether the chip is interactive (clickable). */
  readonly interactive?: boolean;
  /** Click handler (for interactive chips). */
  readonly onClick?: () => void;
  /** Remove handler — shows an ✕ button when provided. */
  readonly onRemove?: () => void;
  /** Accessible label for the remove button. */
  readonly removeLabel?: string;
  /** Additional CSS classes. */
  readonly className?: string;
}

// ─── Style maps ─────────────────────────────────────────────────────────────

const VARIANT_CLASSES: Record<ChipVariant, string> = {
  default: "bg-surface-muted text-foreground-secondary border-transparent",
  primary: "bg-brand/10 text-brand border-brand/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  error: "bg-error/10 text-error border-error/20",
};

// ─── Component ──────────────────────────────────────────────────────────────

export const Chip = React.memo(function Chip({
  children,
  variant = "default",
  interactive = false,
  onClick,
  onRemove,
  removeLabel = "Remove",
  className = "",
}: Readonly<ChipProps>) {
  const Tag = interactive ? "button" : "span";

  function handleKeyDown(e: KeyboardEvent) {
    if (interactive && onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <Tag
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow,background-color,color] motion-reduce:transition-none animate-chip-enter",
        VARIANT_CLASSES[variant],
        interactive
          ? "cursor-pointer hover:brightness-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/25"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={removeLabel}
          className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors motion-reduce:transition-none hover:bg-chip-remove-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/25"
        >
          <X size={10} aria-hidden="true" />
        </button>
      )}
    </Tag>
  );
});
