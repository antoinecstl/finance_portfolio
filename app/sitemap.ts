import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, priority: 1 },
    { url: `${base}/pricing`, lastModified: now, priority: 0.9 },
    { url: `${base}/legal/cgu`, lastModified: now, priority: 0.3 },
    { url: `${base}/legal/confidentialite`, lastModified: now, priority: 0.3 },
    { url: `${base}/legal/mentions-legales`, lastModified: now, priority: 0.3 },
    { url: `${base}/legal/cookies`, lastModified: now, priority: 0.3 },
    { url: `${base}/login`, lastModified: now, priority: 0.5 },
    { url: `${base}/signup`, lastModified: now, priority: 0.8 },
  ];
}
