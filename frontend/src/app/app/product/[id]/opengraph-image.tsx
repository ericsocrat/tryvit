// ─── Dynamic OpenGraph image for product share cards ──────────────────────────
// Generates a 1200×630 PNG with product identity and neutral evidence copy.
// Edge-cached for 1 hour. Uses Next.js ImageResponse (Satori).

import { translate } from "@/lib/i18n-core";
import { getServerLocale } from "@/lib/server-locale";
import { ImageResponse } from "next/og";

/* ---------- route configuration ---------- */
export const runtime = "nodejs";
export const alt = "Product evidence card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600; // 1 hour edge cache

/* ---------- helpers ---------- */

/** Truncate a string to `max` characters with an ellipsis. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/* ---------- font loader ---------- */
// Inter Bold 700 from Google Fonts CDN — fetched once & cached by the edge.
let interBoldPromise: Promise<ArrayBuffer> | null = null;
function getInterBoldFont(): Promise<ArrayBuffer> {
  interBoldPromise ??= fetch(
    "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiA.ttf",
  ).then((r) => r.arrayBuffer());
  return interBoldPromise;
}

/* ---------- fallback card ---------- */
function FallbackCard({ label }: Readonly<{ label: string }>) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb",
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>🍽️</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#111827" }}>
          TryVit
        </div>
        <div style={{ fontSize: 18, color: "#6b7280", marginTop: 8 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* ---------- main image handler ---------- */
export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, language, fontData] = await Promise.all([
    params,
    getServerLocale(),
    getInterBoldFont(),
  ]);
  const productId = Number.parseInt(id, 10);
  const t = (key: string) => translate(language, key);

  /* ---- fetch product data (anon key — public read) ---- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let profile: any;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/api_get_product_profile`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}`,
        },
        body: JSON.stringify({
          p_product_id: productId,
          p_language: language,
        }),
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    profile = await res.json();
  } catch {
    return new ImageResponse(<FallbackCard label={t("product.ogEvidenceUnavailable")} />, {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: fontData,
          weight: 700,
          style: "normal" as const,
        },
      ],
    });
  }

  /* ---- extract fields ---- */
  const name = truncate(
    profile.product?.product_name_display ??
      profile.product?.product_name ??
      "Unknown",
    60,
  );
  const brand = truncate(profile.product?.brand ?? "", 40);
  const heroUrl: string | undefined = profile.images?.primary?.url;
  const categoryIcon: string = profile.product?.category_icon ?? "🍽️";

  /* ---- render card ---- */
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        fontFamily: "Inter",
        padding: 48,
      }}
    >
      {/* ---- main content ---- */}
      <div style={{ display: "flex", flex: 1, gap: 48 }}>
        {/* Left — hero image */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 280,
            height: 280,
            borderRadius: 24,
            backgroundColor: "#f3f4f6",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {heroUrl ? (
            <img
              src={heroUrl}
              alt=""
              width={260}
              height={260}
              style={{ objectFit: "contain" }}
            />
          ) : (
            <div style={{ fontSize: 96 }}>{categoryIcon}</div>
          )}
        </div>

        {/* Right — product info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.2,
              marginBottom: 8,
            }}
          >
            {name}
          </div>

          {brand && (
            <div style={{ fontSize: 22, color: "#6b7280", marginBottom: 24 }}>
              {brand}
            </div>
          )}

          {/* Neutral evidence summary. Detailed claims stay on the product page,
              where their provenance and freshness can be shown alongside them. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: "20px 24px",
              borderRadius: 18,
              backgroundColor: "#f3f4f6",
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: "#6b7280",
                textTransform: "uppercase" as const,
                letterSpacing: "0.08em",
              }}
            >
              {t("product.ogEvidenceLabel")}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>
              {t("product.ogEvidenceSummary")}
            </div>
            <div style={{ fontSize: 17, color: "#4b5563" }}>
              {t("product.ogEvidenceAvailability")}
            </div>
          </div>
        </div>
      </div>

      {/* ---- bottom — evidence context + branding ---- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: 24,
        }}
      >
        <div style={{ fontSize: 16, color: "#6b7280" }}>
          {t("product.ogReviewEvidence")}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 18,
            color: "#9ca3af",
          }}
        >
          TryVit — Know What You Eat
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: fontData,
          weight: 700,
          style: "normal" as const,
        },
      ],
    },
  );
}
