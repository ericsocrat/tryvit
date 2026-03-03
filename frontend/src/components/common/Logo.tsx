// ─── Logo — brand logomark with automatic dark mode switching ────────────────
// Pure CSS theme switching via [data-theme="dark"] — no client JS needed.
// Renders both light and dark variants; CSS hides the inactive one.
//
// Variants:
//   "icon"   — shield-leaf logomark only (1:1 aspect ratio)
//   "lockup" — logomark + wordmark side-by-side (200:48 aspect ratio)
//
// Issue #566 — Add real logomark SVG throughout the app

/* eslint-disable @next/next/no-img-element */

type LogoVariant = "icon" | "lockup";

interface LogoProps {
  /** Which logo form to render. Default: "icon" */
  variant?: LogoVariant;
  /** Height in pixels. Width is calculated from the SVG aspect ratio. Default: 32 */
  size?: number;
  /** Additional CSS classes applied to the wrapper span */
  className?: string;
}

const ASSETS = {
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
} as const;

export function Logo({ variant = "icon", size = 32, className }: Readonly<LogoProps>) {
  const asset = ASSETS[variant];
  const width = Math.round(size * asset.aspectRatio);

  return (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      {/* Light-mode variant — hidden when [data-theme="dark"] */}
      <img
        src={asset.light}
        alt="TryVit"
        width={width}
        height={size}
        className="logo-light"
      />
      {/* Dark-mode variant — hidden by default, shown when [data-theme="dark"] */}
      <img
        src={asset.dark}
        alt=""
        width={width}
        height={size}
        className="logo-dark"
        aria-hidden="true"
      />
    </span>
  );
}
