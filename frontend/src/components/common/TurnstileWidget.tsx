/**
 * TurnstileWidget — Cloudflare Turnstile CAPTCHA wrapper.
 *
 * Renders the invisible/managed Turnstile challenge widget. Provides
 * callbacks for token success, error, and expiry. Gracefully renders
 * nothing when the site key is not configured.
 *
 * @see https://developers.cloudflare.com/turnstile/
 * Issue: #470
 */

"use client";

import { getTurnstileSiteKey } from "@/lib/turnstile";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TurnstileWidgetProps {
  /** Called with valid CAPTCHA token on success. */
  readonly onSuccess: (token: string) => void;
  /** Called when challenge encounters an error. */
  readonly onError?: () => void;
  /** Called when a previously valid token expires. */
  readonly onExpire?: () => void;
  /** Optional action name for analytics (e.g. "signup", "submit-product"). */
  readonly action?: string;
  /** Widget appearance. @default "interaction-only" */
  readonly appearance?: "always" | "execute" | "interaction-only";
  /** Widget theme. @default "auto" */
  readonly theme?: "light" | "dark" | "auto";
  /** Responsive widget footprint. @default "normal" */
  readonly size?: "normal" | "flexible" | "compact";
  /** Additional CSS classes on the wrapper div. */
  readonly className?: string;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget(
    {
      onSuccess,
      onError,
      onExpire,
      action,
      appearance = "interaction-only",
      theme = "auto",
      size = "normal",
      className,
    },
    forwardedRef,
  ) {
    const ref = useRef<TurnstileInstance | null>(null);
    const siteKey = getTurnstileSiteKey();

    useImperativeHandle(
      forwardedRef,
      () => ({
        reset: () => ref.current?.reset(),
      }),
      [],
    );

    const handleSuccess = useCallback(
      (token: string) => {
        onSuccess(token);
      },
      [onSuccess],
    );

    const handleError = useCallback(() => {
      onError?.();
    }, [onError]);

    const handleExpire = useCallback(() => {
      onExpire?.();
      // Auto-reset on expiry so user can re-verify
      ref.current?.reset();
    }, [onExpire]);

    const wrapperClassName = [
      "flex w-full justify-center rounded-xl border border-default bg-surface/95 px-2 py-2 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[box-shadow,background-color] motion-reduce:transition-none",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={wrapperClassName} data-testid="turnstile-widget">
        <Turnstile
          ref={ref}
          siteKey={siteKey}
          onSuccess={handleSuccess}
          onError={handleError}
          onExpire={handleExpire}
          options={{
            action,
            appearance,
            theme,
            size,
          }}
        />
      </div>
    );
  },
);

// ─── Imperative Reset Helper ────────────────────────────────────────────────

/**
 * Hook-compatible ref type for external reset control.
 * Usage: pass a ref to <Turnstile ref={ref} /> and call ref.current?.reset()
 */
export type { TurnstileInstance } from "@marsidev/react-turnstile";
