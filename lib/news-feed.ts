import { parseRssNews, type NewsItem } from './market/news';

// Google Actualités en français : titres récents (30 jours) sur une requête.
// Le flux est public ; on ne reprend que titre, média, date et lien.
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';

export async function getFrenchNews(query: string): Promise<NewsItem[]> {
  const params = new URLSearchParams({ q: `"${query}" when:30d`, hl: 'fr', gl: 'FR', ceid: 'FR:fr' });
  try {
    const response = await fetch(`${GOOGLE_NEWS_RSS}?${params.toString()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Fi-Hub/1.0)', Accept: 'application/rss+xml, application/xml' },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    return parseRssNews(await response.text(), 'fr').slice(0, 15);
  } catch (error) {
    console.error('Error fetching French news:', error);
    return [];
  }
}
