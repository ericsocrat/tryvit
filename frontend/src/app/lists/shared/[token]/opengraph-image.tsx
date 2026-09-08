import { publicShareImage } from "@/app/_public-share/share-image";
import { getServerLocale } from "@/lib/server-locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const alt = "TryVit shared product facts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function OGImage() { return publicShareImage("list", await getServerLocale()); }
