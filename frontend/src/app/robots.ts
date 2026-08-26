import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = publicBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/app/settings"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
