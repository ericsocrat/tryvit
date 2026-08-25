import { ImageResponse } from "next/og";

import { LandingSocialCard } from "./_landing-v2/LandingSocialCard";

export const runtime = "nodejs";
export const alt =
  "TryVit — evidence stays visible · źródła pozostają widoczne · Evidenz bleibt sichtbar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export default function OpenGraphImage() {
  return new ImageResponse(<LandingSocialCard height={630} />, size);
}
