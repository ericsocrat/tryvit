/**
 * Textarea — multi-line text input with label, error, hint, and character count.
 *
 * Styling via design tokens, consistent with Input component.
 */

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TextareaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "children"
> {
  /** Visible label text. */
  readonly label?: string;
  /** Error message — shows in red, linked via aria-describedby. */
  readonly error?: string;
  /** Hint text shown below the textarea. */
  readonly hint?: string;
  /** Show a character counter when maxLength is set. */
  readonly showCount?: boolean;
  /** Current value length (needed for controlled char count). Falls back to 0. */
  readonly currentLength?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      label,
      error,
      hint,
      showCount = false,
      currentLength = 0,
      maxLength,
      rows = 3,
      className = "",
      id: externalId,
      ...rest
    },
    ref,
  ) {
    const autoId = useId();
    const textareaId = externalId ?? autoId;
    const errorId = error ? `${textareaId}-error` : undefined;
    const hintId = hint && !error ? `${textareaId}-hint` : undefined;
    const describedBy = errorId ?? hintId;

    return (
      <div className={className}>
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-1.5 block text-sm font-medium text-foreground-secondary"
          >
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            "block w-full rounded-xl border bg-surface/95 px-3.5 py-2.5 text-sm shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-[border-color,box-shadow,background-color,color] motion-reduce:transition-none",
            "placeholder:text-foreground-muted resize-y",
            "focus-visible:outline-hidden focus-visible:ring-2",
            error
              ? "border-error focus-visible:border-error focus-visible:ring-error/30"
              : "border-default focus-visible:border-brand focus-visible:ring-brand/25",
          ].join(" ")}
          {...rest}
        />

        <div className="mt-1.5 flex justify-between">
          <div>
            {error && (
              <p id={errorId} className="text-xs text-error" role="alert">
                {error}
              </p>
            )}
            {hint && !error && (
              <p id={hintId} className="text-xs text-foreground-muted">
                {hint}
              </p>
            )}
          </div>
          {showCount && maxLength != null && (
            <span
              className={`text-xs ${
                currentLength > maxLength
                  ? "text-error"
                  : "text-foreground-muted"
              }`}
              aria-live="polite"
            >
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  },
);
