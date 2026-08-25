import localFont from "next/font/local";

export const landingSans = localFont({
  src: [
    { path: "./fonts/manrope-regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/manrope-semibold.woff2", weight: "600 800", style: "normal" },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["Landing Manrope Fallback", "Arial", "sans-serif"],
  variable: "--font-landing-sans",
});

export const landingSerif = localFont({
  src: [{ path: "./fonts/tryvit-assay-serif-regular.woff2", weight: "400", style: "normal" }],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["Landing Serif Fallback", "Georgia", "serif"],
  variable: "--font-landing-serif",
});
