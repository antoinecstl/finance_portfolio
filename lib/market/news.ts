// Actualités de l'explorateur de marchés : titres et liens vers les articles,
// jamais leur contenu. Deux sources : la recherche du fournisseur de cours
// (presse internationale) et le flux RSS de Google Actualités en français.

export interface NewsItem {
  title: string;
  url: string;
  publisher: string;
  publishedAt: string | null; // ISO
  lang: 'fr' | 'intl';
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** N'accepte que des liens http(s) : un lien `javascript:` ne doit jamais atteindre le DOM. */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Actualités renvoyées par la recherche du fournisseur (`news: [...]`). */
export function parseProviderNews(json: unknown): NewsItem[] {
  const news = isRecord(json) && Array.isArray(json.news) ? json.news : [];
  const out: NewsItem[] = [];
  for (const n of news) {
    if (!isRecord(n) || typeof n.title !== 'string') continue;
    const url = safeHttpUrl(n.link);
    if (!url) continue;
    const time = typeof n.providerPublishTime === 'number' ? n.providerPublishTime : null;
    out.push({
      title: n.title.trim(),
      url,
      publisher: typeof n.publisher === 'string' ? n.publisher : '',
      publishedAt: time ? new Date(time * 1000).toISOString() : null,
      lang: 'intl',
    });
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === '#') {
        const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .trim();
}

const tag = (xml: string, name: string): string | null => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]) : null;
};

/** Flux RSS 2.0 (Google Actualités) : `<item>` avec title, link, pubDate, source. */
export function parseRssNews(xml: string, lang: NewsItem['lang'] = 'fr'): NewsItem[] {
  const out: NewsItem[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const rawTitle = tag(item, 'title');
    const url = safeHttpUrl(tag(item, 'link'));
    if (!rawTitle || !url) continue;
    const publisher = tag(item, 'source') ?? '';
    // Google Actualités suffixe le titre par « - Média ».
    const title = publisher && rawTitle.endsWith(` - ${publisher}`) ? rawTitle.slice(0, -publisher.length - 3).trim() : rawTitle;
    const date = tag(item, 'pubDate');
    const time = date ? Date.parse(date) : NaN;
    out.push({ title, url, publisher, publishedAt: Number.isFinite(time) ? new Date(time).toISOString() : null, lang });
  }
  return out;
}

const LEGAL_SUFFIX = /[\s,]+(s\.?a\.?s?|s\.?e\.?|n\.?v\.?|ag|plc|inc\.?|corp\.?|corporation|ltd\.?|limited|group|holding|co\.?|& co\.?|s\.?p\.?a\.?|a\/s|asa|oyj|ab)$/i;

/**
 * Requête d'actualités à partir du nom affiché : sans forme juridique ni
 * mention de devise (« Bitcoin USD » → « Bitcoin »). Revient au symbole sans
 * suffixe de place si le nom est vide.
 */
export function newsQuery(name: string, symbol: string): string {
  let q = name.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3 && LEGAL_SUFFIX.test(q); i++) q = q.replace(LEGAL_SUFFIX, '').trim();
  q = q.replace(/\s+(USD|EUR)$/i, '').trim();
  if (q.length < 2) q = symbol.replace(/^\^/, '').replace(/[.=-].*$/, '');
  return q.slice(0, 80);
}

const normalizeTitle = (t: string) => t.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim();

/** Fusionne les sources, supprime les doublons et trie du plus récent au plus ancien. */
export function mergeNews(lists: NewsItem[][], limit = 12): NewsItem[] {
  const seen = new Set<string>();
  const all: NewsItem[] = [];
  for (const item of lists.flat()) {
    const key = normalizeTitle(item.title);
    if (!key || seen.has(key) || seen.has(item.url)) continue;
    seen.add(key);
    seen.add(item.url);
    all.push(item);
  }
  return all
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, limit);
}
