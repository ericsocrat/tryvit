import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = publicBaseUrl();
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/app`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/app/scan`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
