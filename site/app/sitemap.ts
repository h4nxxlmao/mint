import type { MetadataRoute } from "next";
import { DOC_META } from "@/lib/docs-config";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: site.url,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${site.url}/playground`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...DOC_META.map((doc) => ({
      url: `${site.url}/docs/${doc.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
