import type { MetadataRoute } from "next";

import { SITE } from "@/constants/site";
import { APP_PAGE_SLUGS } from "@/lib/agent-discovery/site-pages";
import { source } from "@/lib/source";
import { TRUST_PAGES, TRUST_PAGE_SLUGS } from "@/lib/trust-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 1,
      url: SITE.URL,
    },
    // The Studio and the scenes gallery, right after home: both are
    // destinations in their own right.
    ...APP_PAGE_SLUGS.map((slug) => ({
      changeFrequency: "weekly" as const,
      lastModified: now,
      priority: 0.9,
      url: `${SITE.URL}/${slug}`,
    })),
    ...TRUST_PAGE_SLUGS.map((slug) => ({
      changeFrequency: "yearly" as const,
      lastModified: new Date(TRUST_PAGES[slug].updated),
      priority: 0.4,
      url: `${SITE.URL}/${slug}`,
    })),
  ];

  // Every docs page, scenes and engine guides included.
  const docPages: MetadataRoute.Sitemap = source.getPages().map((page) => ({
    changeFrequency: "weekly" as const,
    lastModified: now,
    priority: page.url === "/docs" ? 0.9 : 0.8,
    url: `${SITE.URL}${page.url}`,
  }));

  return [...staticPages, ...docPages];
}
