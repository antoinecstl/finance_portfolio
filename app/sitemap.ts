import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE}/#pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/#features`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/#faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/legal/cgu`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/legal/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/legal/mentions-legales`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/legal/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/legal/remboursement`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
