// ─── Logo — brand logomark with automatic dark mode switching ────────────────
// Pure CSS theme switching via [data-theme="dark"] — no client JS needed.
// Renders both light and dark variants; CSS hides the inactive one.
//
// Variants:
//   "icon"   — leaf-squircle logomark only (1:1 aspect ratio)
//   "lockup" — logomark + wordmark side-by-side (200:48 aspect ratio)
//
// Issue #566 — Add real logomark SVG throughout the app

/* eslint-disable @next/next/no-img-element */

type LogoVariant = "icon" | "lockup";

interface LogoAsset {
  light: string;
  dark: string;
  aspectRatio: number;
}

interface LogoProps {
  /** Which logo form to render. Default: "icon" */
  variant?: LogoVariant;
  /** Height in pixels. Width is calculated from the SVG aspect ratio. Default: 32 */
  size?: number;
  /** Additional CSS classes applied to the wrapper span */
  className?: string;
}

const ASSETS: Record<LogoVariant, LogoAsset> = {
  icon: {
    light: "/logo/logomark.svg",
    dark: "/logo/logomark-dark.svg",
    aspectRatio: 1, // 512×512 viewBox
  },
  lockup: {
    light: "/logo/tryvit-logo.svg",
    dark: "/logo/tryvit-logo-white.svg",
    aspectRatio: 200 / 48, // ~4.17
  },
};

export function Logo({ variant = "icon", size = 32, className }: Readonly<LogoProps>) {
  const asset = ASSETS[variant];
  const width = Math.round(size * asset.aspectRatio);

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-lg transition-[filter,opacity] motion-reduce:transition-none ${className ?? ""}`}
    >
      {/* Light-mode variant — hidden when [data-theme="dark"] */}
      <img
        src={asset.light}
        alt="TryVit"
        width={width}
        height={size}
        className="logo-light select-none drop-shadow-[0_2px_6px_rgba(15,23,42,0.12)]"
      />
      {/* Dark-mode variant — hidden by default, shown when [data-theme="dark"] */}
      <img
        src={asset.dark}
        alt=""
        width={width}
        height={size}
        className="logo-dark select-none drop-shadow-[0_2px_6px_rgba(15,23,42,0.22)]"
        aria-hidden="true"
      />
    </span>
  );
}
