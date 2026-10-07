import { describe, expect, it } from 'vitest';
import { decodeEntities, mergeNews, newsQuery, parseProviderNews, parseRssNews, safeHttpUrl } from './news';

const RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>"Schneider Electric" - Google Actualités</title>
<item><title>Schneider Electric relève ses objectifs &amp; accélère dans les data centers - Les Echos</title><link>https://news.google.com/rss/articles/abc?oc=5</link><guid isPermaLink="false">abc</guid><pubDate>Tue, 06 Oct 2026 08:30:00 GMT</pubDate><description>&lt;a href="x"&gt;...&lt;/a&gt;</description><source url="https://www.lesechos.fr">Les Echos</source></item>
<item><title><![CDATA[L'action Schneider recule de 2 % - Boursorama]]></title><link>https://news.google.com/rss/articles/def</link><pubDate>Mon, 05 Oct 2026 17:00:00 GMT</pubDate><source url="https://www.boursorama.com">Boursorama</source></item>
<item><title>Lien piégé</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

describe('parseRssNews', () => {
  it('reads title, link, date and publisher, without the publisher suffix', () => {
    const items = parseRssNews(RSS);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: 'Schneider Electric relève ses objectifs & accélère dans les data centers',
      url: 'https://news.google.com/rss/articles/abc?oc=5',
      publisher: 'Les Echos',
      publishedAt: '2026-10-06T08:30:00.000Z',
      lang: 'fr',
    });
    expect(items[1].title).toBe("L'action Schneider recule de 2 %");
  });

  it('returns nothing for an empty or broken feed', () => {
    expect(parseRssNews('')).toEqual([]);
    expect(parseRssNews('<html>erreur</html>')).toEqual([]);
  });
});

describe('parseProviderNews', () => {
  it('keeps titled stories with a safe link', () => {
    const items = parseProviderNews({
      news: [
        { uuid: '1', title: 'Schneider Electric beats estimates', publisher: 'Reuters', link: 'https://example.com/a', providerPublishTime: Date.parse('2026-10-07T07:50:00Z') / 1000, type: 'STORY' },
        { uuid: '2', title: 'Bad', link: 'data:text/html,hi' },
        { uuid: '3', link: 'https://example.com/no-title' },
      ],
    });
    expect(items).toEqual([{ title: 'Schneider Electric beats estimates', url: 'https://example.com/a', publisher: 'Reuters', publishedAt: '2026-10-07T07:50:00.000Z', lang: 'intl' }]);
    expect(parseProviderNews({})).toEqual([]);
  });
});

describe('helpers', () => {
  it('builds a search query from the company name', () => {
    expect(newsQuery('Schneider Electric SE', 'SU.PA')).toBe('Schneider Electric');
    expect(newsQuery("L'Oréal S.A.", 'OR.PA')).toBe("L'Oréal");
    expect(newsQuery('Apple Inc.', 'AAPL')).toBe('Apple');
    expect(newsQuery('Bitcoin USD', 'BTC-USD')).toBe('Bitcoin');
    expect(newsQuery('', 'MC.PA')).toBe('MC');
    expect(newsQuery('', '^FCHI')).toBe('FCHI');
  });

  it('decodes entities and refuses non-web links', () => {
    expect(decodeEntities('A &amp; B &#233;t&#xE9; &quot;x&quot;')).toBe('A & B été "x"');
    expect(safeHttpUrl('https://a.fr/x')).toBe('https://a.fr/x');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
  });

  it('merges sources, removes duplicates and sorts by date', () => {
    const a = { title: 'Hausse du titre', url: 'https://a/1', publisher: 'A', publishedAt: '2026-10-05T10:00:00.000Z', lang: 'fr' as const };
    const b = { title: 'Hausse du titre !', url: 'https://b/1', publisher: 'B', publishedAt: '2026-10-06T10:00:00.000Z', lang: 'intl' as const };
    const c = { title: 'Autre sujet', url: 'https://c/1', publisher: 'C', publishedAt: null, lang: 'fr' as const };
    expect(mergeNews([[a, c], [b]]).map((n) => n.publisher)).toEqual(['A', 'C']);
    expect(mergeNews([[c], [b]]).map((n) => n.publisher)).toEqual(['B', 'C']);
    expect(mergeNews([[a, b, c]], 1)).toHaveLength(1);
  });
});
