import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/app/', '/api/', '/auth/'] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
