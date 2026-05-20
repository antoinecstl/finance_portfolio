import type { MetadataRoute } from 'next';
import { indexableMarketingRoutes } from '@/lib/seo-pages';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return indexableMarketingRoutes.map((route) => ({
    url: `${BASE}${route.href}`,
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
