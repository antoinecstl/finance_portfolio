import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

const LEGAL_DATE = new Date('2026-04-18');
const HOME_DATE = new Date('2026-05-05');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, lastModified: HOME_DATE, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/signup`, lastModified: HOME_DATE, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/login`, lastModified: HOME_DATE, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/legal/cgu`, lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/legal/confidentialite`, lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/legal/mentions-legales`, lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/legal/cookies`, lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/legal/remboursement`, lastModified: LEGAL_DATE, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
