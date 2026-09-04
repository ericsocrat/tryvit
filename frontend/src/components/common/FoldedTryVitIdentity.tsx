import type { CSSProperties } from "react";

interface FoldedTryVitIdentityProps {
  readonly compact?: boolean;
  readonly className?: string;
  readonly label?: string;
  readonly size?: 24 | 28 | 32 | 36 | 40;
}

/**
 * The approved Source Fold TryVit identity, exposed outside landing/Auth so
 * product surfaces can share the exact mark without coupling to either route.
 */
export function FoldedTryVitIdentity({
  compact = false,
  className = "",
  label = "TryVit",
  size = 32,
}: Readonly<FoldedTryVitIdentityProps>) {
  const style = { "--tryvit-folded-mark-size": `${size}px` } as CSSProperties;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 text-current ${className}`}
      data-tryvit-folded-lockup={compact ? "compact" : "horizontal"}
      style={style}
    >
      <svg
        aria-hidden="true"
        height={size}
        viewBox="0 0 24 24"
        width={size}
      >
        <path
          d="M2 6h7l5 5-5 5H2l4-5-4-5Z"
          fill="var(--tryvit-mark-fold, #a64b2a)"
        />
        <path
          d="M7 2h8l7 7v9l-4 4H7v-6l5-5-5-5V2Zm7 5v3h3V7h-3Zm-3 10h6v2h-6v-2Z"
          fill="var(--tryvit-mark-front, currentColor)"
          fillRule="evenodd"
        />
      </svg>
      {compact ? null : (
        <svg
          aria-label={label}
          className="h-7 w-24"
          role="img"
          viewBox="0 0 96 28"
          width={96}
          height={28}
        >
          <path
            d="M1 2h20v4h-8v16H9V6H1V2Zm23 6h4v2c1.5-1.6 3.3-2.4 5.5-2.4V12c-2.4 0-4.2.6-5.5 1.9V22h-4V8Zm11 0h4.5l4.2 9 3.7-9h4.4l-8.2 18h-4.3l2.2-4.6L35 8Zm18-6h4.8l6.1 14.5L70 2h4.8l-9 20h-4.1L53 2Zm24 0h4.2v4H77V2Zm0 6h4.2v14H77V8Zm7-4h4v4h5v3.6h-5v5.2c0 1.1.6 1.7 1.9 1.7.9 0 1.8-.2 2.7-.6v3.7c-1.1.5-2.4.8-3.8.8-3.2 0-4.8-1.7-4.8-5.1V4Z"
            fill="currentColor"
          />
        </svg>
      )}
    </span>
  );
}
