// ─── Dynamic OpenGraph image for shared list cards ────────────────────────────
// Generates a 1200×630 PNG showing list and product identities without
// publishing scores that lack portable provenance and freshness evidence.

import { ImageResponse } from "next/og";
import { translate } from "@/lib/i18n-core";
import { fetchPublicSharedList } from "@/lib/public-shares";
import { getServerLocale } from "@/lib/server-locale";

/* ---------- route configuration ---------- */
export const runtime = "nodejs";
export const alt = "Shared product list evidence card";
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
let interBoldPromise: Promise<ArrayBuffer> | null = null;
function getInterBoldFont(): Promise<ArrayBuffer> {
  interBoldPromise ??= fetch(
    "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf",
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
        {/* Keep the fallback self-contained: ImageResponse resolves emoji as remote assets. */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#16a34a",
            color: "#ffffff",
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          TV
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#111827" }}>TryVit</div>
        <div style={{ fontSize: 18, color: "#6b7280", marginTop: 8 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* ---------- list item row ---------- */
interface ItemRowProps {
  name: string;
  brand: string;
  evidenceLabel: string;
}

function ItemRow({ name, brand, evidenceLabel }: ItemRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 20px",
        backgroundColor: "#f9fafb",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          padding: "7px 10px",
          borderRadius: 999,
          backgroundColor: "#e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#4b5563",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {evidenceLabel}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.2,
          }}
        >
          {truncate(name, 50)}
        </div>
        {brand && (
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>{truncate(brand, 40)}</div>
        )}
      </div>
    </div>
  );
}

/* ---------- main image handler ---------- */
export default async function OGImage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, language, fontData] = await Promise.all([
    params,
    getServerLocale(),
    getInterBoldFont(),
  ]);
  const t = (key: string, values?: Record<string, string | number>) =>
    translate(language, key, values);

  const listData = await fetchPublicSharedList(token);
  if (!listData) {
    return new ImageResponse(<FallbackCard label={t("shared.serviceUnavailableTitle")} />, {
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

  /* ---- extract data ---- */
  const listName: string = listData?.list_name ?? t("shared.sharedList");
  const description: string | null = listData?.description ?? null;
  const totalCount: number = listData?.total_count ?? 0;
  const items: { product_name: string; brand: string }[] =
    listData?.items ?? [];

  if (items.length === 0) {
    return new ImageResponse(<FallbackCard label={t("shared.listEmpty")} />, {
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

  const displayItems = items.slice(0, 5); // show up to 5 items
  const remaining = totalCount - displayItems.length;

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
      {/* Brand bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          backgroundColor: "#16a34a",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              color: "#9ca3af",
              textTransform: "uppercase" as const,
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            {t("shared.sharedList")}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.2,
            }}
          >
            {truncate(listName, 40)}
          </div>
          {description && (
            <div
              style={{
                fontSize: 16,
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              {truncate(description, 60)}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            maxWidth: 220,
            padding: "10px 14px",
            borderRadius: 999,
            backgroundColor: "#e5e7eb",
            color: "#4b5563",
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {t("shared.evidenceReviewRequired")}
        </div>
      </div>

      {/* Product list items */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
        }}
      >
        {displayItems.map((item, i) => (
          <ItemRow
            key={i}
            name={item.product_name}
            brand={item.brand}
            evidenceLabel={t("shared.evidenceReviewRequired")}
          />
        ))}
        {remaining > 0 && (
          <div
            style={{
              fontSize: 14,
              color: "#9ca3af",
              textAlign: "center",
              padding: "8px 0",
            }}
          >
            {t("shared.moreProducts", { count: remaining })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: 16,
        }}
      >
        <div
          style={{
            backgroundColor: "#16a34a",
            color: "#ffffff",
            padding: "10px 24px",
            borderRadius: 999,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {t("shared.reviewEvidenceInTryVit")}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 16,
            color: "#9ca3af",
          }}
        >
          📋 TryVit — {t("common.products", { count: totalCount })}
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
