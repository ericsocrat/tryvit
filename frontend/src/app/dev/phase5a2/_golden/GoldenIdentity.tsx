import type { CSSProperties } from "react";

export type GoldenMarkSize = "micro" | "small" | "medium" | "large";
export type GoldenMarkTone = "brand" | "inverse" | "monochrome";

const MARK_SIZE: Readonly<Record<GoldenMarkSize, number>> = Object.freeze({
  micro: 16,
  small: 24,
  medium: 40,
  large: 72,
});

export interface GoldenMarkProps {
  readonly size?: GoldenMarkSize;
  readonly tone?: GoldenMarkTone;
  readonly label?: string;
  readonly className?: string;
}

export function GoldenMark({
  size = "medium",
  tone = "brand",
  label,
  className,
}: Readonly<GoldenMarkProps>) {
  const pixels = MARK_SIZE[size];
  const style = {
    "--golden-mark-size": `${pixels}px`,
  } as CSSProperties;

  if (size === "micro") {
    return (
      <svg
        aria-hidden={label ? undefined : true}
        aria-label={label}
        className={className}
        data-golden-mark="micro"
        data-tone={tone}
        height={pixels}
        role={label ? "img" : undefined}
        style={style}
        viewBox="0 0 16 16"
        width={pixels}
      >
        <path
          d="M1 4h5l4 4-4 4H1l3-4-3-4Z"
          fill="var(--gr-mark-fold, currentColor)"
        />
        <path
          d="M5 1h6l4 4v7l-3 3H5v-4l3-3-3-3V1Zm5 3v2h2V4h-2Z"
          fill="var(--gr-mark-front, currentColor)"
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
      data-golden-mark="master"
      data-tone={tone}
      height={pixels}
      role={label ? "img" : undefined}
      style={style}
      viewBox="0 0 24 24"
      width={pixels}
    >
      <path
        d="M2 6h7l5 5-5 5H2l4-5-4-5Z"
        fill="var(--gr-mark-fold, currentColor)"
      />
      <path
        d="M7 2h8l7 7v9l-4 4H7v-6l5-5-5-5V2Zm7 5v3h3V7h-3Z"
        fill="var(--gr-mark-front, currentColor)"
        fillRule="evenodd"
      />
    </svg>
  );
}

export interface GoldenWordmarkProps {
  readonly label?: string;
  readonly className?: string;
}

/** Path-only review wordmark. It is not a production brand asset. */
export function GoldenWordmark({ label = "TryVit", className }: Readonly<GoldenWordmarkProps>) {
  return (
    <svg
      aria-label={label}
      className={className}
      data-golden-wordmark="TryVit"
      role="img"
      viewBox="0 0 112 24"
    >
      <path
        d="M1 2h20v4h-8v16H9V6H1V2Zm23 6h4v2c1.5-1.6 3.3-2.4 5.5-2.4V12c-2.4 0-4.2.6-5.5 1.9V22h-4V8Zm11 0h4.5l4.2 9 3.7-9h4.4l-8.2 18h-4.3l2.2-4.6L35 8Zm18-6h4.8l6.1 14.5L70 2h4.8l-9 20h-4.1L53 2Zm24 0h4.2v4H77V2Zm0 6h4.2v14H77V8Zm7-4h4v4h5v3.6h-5v5.2c0 1.1.6 1.7 1.9 1.7.9 0 1.8-.2 2.7-.6v3.7c-1.1.5-2.4.8-3.8.8-3.2 0-4.8-1.7-4.8-5.1V4Zm12-2h4.2v6h5v3.6h-5v5.2c0 1.1.6 1.7 1.9 1.7.9 0 1.8-.2 2.7-.6v3.7c-1.1.5-2.4.8-3.8.8-3.2 0-4.8-1.7-4.8-5.1V2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export interface GoldenLockupProps {
  readonly compact?: boolean;
  readonly inverse?: boolean;
  readonly className?: string;
}

export function GoldenLockup({
  compact = false,
  inverse = false,
  className,
}: Readonly<GoldenLockupProps>) {
  return (
    <span className={className} data-golden-lockup={compact ? "compact" : "horizontal"}>
      <GoldenMark size={compact ? "small" : "medium"} tone={inverse ? "inverse" : "brand"} />
      {compact ? null : <GoldenWordmark />}
    </span>
  );
}

export const GOLDEN_IDENTITY_ASSET_CONTRACT = Object.freeze({
  name: "Folded Label Register",
  status: "non-production-review-candidate",
  masterGrid: "24x24",
  microGrid: "16x16",
  microSafeEdgePx: 1,
  microMinimumFeaturePx: 2,
  wordmarkCasing: "TryVit",
  geometry: "asymmetric opposed double fold with square registration aperture",
  prohibitedMasterFormats: Object.freeze(["raster", "live-svg-text", "filter", "gradient"]),
});
