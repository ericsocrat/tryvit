import { ImageResponse } from "next/og";
import { translate } from "@/lib/i18n-core";
import type { SupportedLanguage } from "@/stores/language-store";

/** Generic preview: no token, title, product, account, RPC or remote font fetch. */
export function publicShareImage(kind: "list" | "comparison", language: SupportedLanguage) {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#f5f6f7", color: "#17212b", fontFamily: "sans-serif" }}>
    <div style={{ display: "flex", fontSize: 34, color: "#18794e", marginBottom: 44 }}>TryVit</div>
    <div style={{ display: "flex", fontSize: 54, lineHeight: 1.15, maxWidth: 1000 }}>{translate(language, kind === "list" ? "publicEvidenceShare.metadataList" : "publicEvidenceShare.metadataComparison")}</div>
    <div style={{ display: "flex", fontSize: 27, lineHeight: 1.5, marginTop: 28, color: "#4b5563", maxWidth: 960 }}>{translate(language, "publicEvidenceShare.metadataDescription")}</div>
    <div style={{ display: "flex", marginTop: 48, fontSize: 22, color: "#4b5563" }}>tryvit.app</div>
  </div>, { width: 1200, height: 630, headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  } });
}
