import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard',
          '/settings',
          '/marches',
          '/admin',
          '/oauth/',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
