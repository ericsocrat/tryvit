import type { CSSProperties, ReactNode } from "react";

interface MarkProps {
  readonly size?: 20 | 24 | 32 | 40 | 64 | 80;
  readonly label?: string;
  readonly className?: string;
}

export function LandingMark({ size = 40, label, className }: MarkProps) {
  const style = { "--landing-mark-size": `${size}px` } as CSSProperties;

  if (size <= 20) {
    return (
      <svg
        aria-hidden={label ? undefined : true}
        aria-label={label}
        className={className}
        height={size}
        role={label ? "img" : undefined}
        style={style}
        viewBox="0 0 16 16"
        width={size}
      >
        <path d="M1 4h5l4 4-4 4H1l3-4-3-4Z" fill="var(--landing-mark-fold)" />
        <path
          d="M5 1h6l4 4v7l-3 3H5v-4l3-3-3-3V1Zm5 3v2h2V4h-2Zm-1 7h3v1H9v-1Z"
          fill="var(--landing-mark-front)"
          fillRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      height={size}
      role={label ? "img" : undefined}
      style={style}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M2 6h7l5 5-5 5H2l4-5-4-5Z" fill="var(--landing-mark-fold)" />
      <path
        d="M7 2h8l7 7v9l-4 4H7v-6l5-5-5-5V2Zm7 5v3h3V7h-3Zm-3 10h6v2h-6v-2Z"
        fill="var(--landing-mark-front)"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function LandingWordmark({ className }: Readonly<{ className?: string }>) {
  return (
    <svg aria-label="TryVit" className={className} role="img" viewBox="0 0 96 24">
      <path
        d="M1 2h20v4h-8v16H9V6H1V2Zm23 6h4v2c1.5-1.6 3.3-2.4 5.5-2.4V12c-2.4 0-4.2.6-5.5 1.9V22h-4V8Zm11 0h4.5l4.2 9 3.7-9h4.4l-8.2 18h-4.3l2.2-4.6L35 8Zm18-6h4.8l6.1 14.5L70 2h4.8l-9 20h-4.1L53 2Zm24 0h4.2v4H77V2Zm0 6h4.2v14H77V8Zm7-4h4v4h5v3.6h-5v5.2c0 1.1.6 1.7 1.9 1.7.9 0 1.8-.2 2.7-.6v3.7c-1.1.5-2.4.8-3.8.8-3.2 0-4.8-1.7-4.8-5.1V4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function LandingLockup({ compact = false }: Readonly<{ compact?: boolean }>) {
  return (
    <span data-landing-lockup={compact ? "compact" : "horizontal"}>
      <LandingMark size={compact ? 24 : 40} />
      {compact ? null : <LandingWordmark />}
    </span>
  );
}

export type LandingGlyphName = "observed" | "derived" | "context" | "decision" | "confidence";

export function LandingGlyph({ name }: Readonly<{ name: LandingGlyphName }>) {
  const paths: Readonly<Record<LandingGlyphName, ReactNode>> = {
    observed: <path d="M4 5h16v14H4V5Zm4 4h8M8 13h5" />,
    derived: <path d="M5 18 10 6h4l5 12M7 14h10M12 3v3" />,
    context: <path d="M4 12h16M12 4v16M7 7l10 10M17 7 7 17" />,
    decision: <path d="m4 13 5 5L20 6M4 6h7" />,
    confidence: <path d="M12 3 4 7v5c0 4.6 3.1 7.6 8 9 4.9-1.4 8-4.4 8-9V7l-8-4Zm-3 9 2 2 4-5" />,
  };

  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}
