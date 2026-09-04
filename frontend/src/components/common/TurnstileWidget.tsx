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
import {
  DEFAULT_ONLOAD_NAME,
  DEFAULT_SCRIPT_ID,
  SCRIPT_URL,
  Turnstile,
  type TurnstileInstance,
} from "@marsidev/react-turnstile";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

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
  /** Localized status and recovery copy. */
  readonly messages?: TurnstileWidgetMessages;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

export interface TurnstileWidgetMessages {
  readonly loading: string;
  readonly unavailable: string;
  readonly retry: string;
}

type InitializationPhase =
  | "loading-script"
  | "loading-widget"
  | "ready"
  | "unavailable";

const DEFAULT_MESSAGES: TurnstileWidgetMessages = {
  loading: "Loading security check…",
  unavailable: "Security check unavailable. Try again.",
  retry: "Retry security check",
};

const SCRIPT_INITIALIZATION_TIMEOUT_MS = 10_000;
const WIDGET_INITIALIZATION_TIMEOUT_MS = 5_000;

export const TURNSTILE_SCRIPT_SRC =
  `${SCRIPT_URL}?onload=${DEFAULT_ONLOAD_NAME}&render=explicit`;

type TurnstileCallbackWindow = Window & {
  onloadTurnstileCallback?: () => void;
};

function hasTurnstileApi(): boolean {
  return typeof window !== "undefined" && typeof window.turnstile?.render === "function";
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
      messages = DEFAULT_MESSAGES,
    },
    forwardedRef,
  ) {
    const ref = useRef<TurnstileInstance | null>(null);
    const callbacksRef = useRef({ onSuccess, onError, onExpire });
    const siteKey = getTurnstileSiteKey();
    const [attempt, setAttempt] = useState(0);
    const [phase, setPhase] = useState<InitializationPhase>("loading-script");
    const apiReadyDuringRender = hasTurnstileApi();
    const effectivePhase =
      phase === "loading-script" && apiReadyDuringRender ? "loading-widget" : phase;

    useEffect(() => {
      callbacksRef.current = { onSuccess, onError, onExpire };
    }, [onError, onExpire, onSuccess]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        reset: () => ref.current?.reset(),
      }),
      [],
    );

    const handleSuccess = useCallback(
      (token: string) => {
        setPhase("ready");
        callbacksRef.current.onSuccess(token);
      },
      [],
    );

    const handleUnavailable = useCallback(() => {
      setPhase("unavailable");
      callbacksRef.current.onError?.();
    }, []);

    const handleExpire = useCallback(() => {
      callbacksRef.current.onExpire?.();
      // Auto-reset on expiry so user can re-verify
      ref.current?.reset();
    }, []);

    useEffect(() => {
      if (apiReadyDuringRender) return;

      if (hasTurnstileApi()) {
        let active = true;
        const timeout = window.setTimeout(() => {
          if (active) setPhase("loading-widget");
        }, 0);
        return () => {
          active = false;
          window.clearTimeout(timeout);
        };
      }

      let active = true;
      let settled = false;
      const timeoutRef: { current: number | undefined } = { current: undefined };
      const callbackWindow = window as TurnstileCallbackWindow;
      const previousOnload = callbackWindow.onloadTurnstileCallback;
      const existingScript = document.getElementById(DEFAULT_SCRIPT_ID);
      const script =
        existingScript instanceof HTMLScriptElement
          ? existingScript
          : document.createElement("script");

      const markUnavailable = () => {
        if (!active || settled) return;
        settled = true;
        if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
        handleUnavailable();
      };
      const markReady = () => {
        if (!active || settled) return;
        if (!hasTurnstileApi()) {
          markUnavailable();
          return;
        }
        settled = true;
        if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
        setPhase("loading-widget");
      };
      const onloadCallback = () => {
        try {
          previousOnload?.();
        } finally {
          markReady();
        }
      };

      callbackWindow.onloadTurnstileCallback = onloadCallback;
      script.addEventListener("load", markReady);
      script.addEventListener("error", markUnavailable);

      if (!existingScript) {
        script.id = DEFAULT_SCRIPT_ID;
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      timeoutRef.current = window.setTimeout(
        markUnavailable,
        SCRIPT_INITIALIZATION_TIMEOUT_MS,
      );

      return () => {
        active = false;
        if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
        script.removeEventListener("load", markReady);
        script.removeEventListener("error", markUnavailable);
        if (callbackWindow.onloadTurnstileCallback === onloadCallback) {
          if (previousOnload) {
            callbackWindow.onloadTurnstileCallback = previousOnload;
          } else {
            delete callbackWindow.onloadTurnstileCallback;
          }
        }
      };
    }, [apiReadyDuringRender, attempt, handleUnavailable]);

    useEffect(() => {
      if (effectivePhase !== "loading-widget") return;
      const timeout = window.setTimeout(
        handleUnavailable,
        WIDGET_INITIALIZATION_TIMEOUT_MS,
      );
      return () => window.clearTimeout(timeout);
    }, [effectivePhase, handleUnavailable]);

    const handleWidgetLoad = useCallback(() => {
      setPhase("ready");
    }, []);

    const handleRetry = useCallback(() => {
      ref.current?.remove();
      if (!hasTurnstileApi()) {
        document.getElementById(DEFAULT_SCRIPT_ID)?.remove();
      }
      setPhase(hasTurnstileApi() ? "loading-widget" : "loading-script");
      setAttempt((current) => current + 1);
    }, []);

    const wrapperClassName = [
      "flex w-full justify-center rounded-xl border border-default bg-surface/95 px-2 py-2 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[box-shadow,background-color] motion-reduce:transition-none",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        className={wrapperClassName}
        data-testid="turnstile-widget"
        aria-busy={effectivePhase === "loading-script" || effectivePhase === "loading-widget"}
      >
        {effectivePhase === "loading-script" || effectivePhase === "loading-widget" ? (
          <p className="py-2 text-center text-sm text-foreground-secondary" role="status">
            {messages.loading}
          </p>
        ) : null}

        {effectivePhase === "loading-widget" || effectivePhase === "ready" ? (
          <Turnstile
            key={attempt}
            ref={ref}
            injectScript={false}
            scriptOptions={{ id: DEFAULT_SCRIPT_ID }}
            siteKey={siteKey}
            onWidgetLoad={handleWidgetLoad}
            onSuccess={handleSuccess}
            onError={handleUnavailable}
            onUnsupported={handleUnavailable}
            onTimeout={handleUnavailable}
            onExpire={handleExpire}
            options={{
              action,
              appearance,
              theme,
              size,
            }}
          />
        ) : null}

        {effectivePhase === "unavailable" ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center" role="alert">
            <p className="text-sm font-medium text-error-text">{messages.unavailable}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="min-h-11 rounded-lg border border-default bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {messages.retry}
            </button>
          </div>
        ) : null}
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
