import { describe, expect, it } from 'vitest';
import {
  alignToTimeline,
  annualizedVolatility,
  averageVolume,
  closeAtOrBefore,
  dividendsByYear,
  maxDrawdown,
  performanceByPeriod,
  rangePosition,
  simpleMovingAverage,
  toRelativeChange,
  trailingDividendYield,
} from './analytics';
import { parseChartResponse, type MarketPoint } from './chart-data';
import { CHART_PERIODS, displayStart, isChartPeriod, movingAverageWindow } from './periods';

const DAY = 86_400;
const NOW = new Date('2026-10-06T16:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);

// Une clôture par jour calendaire, de `days` jours avant NOW jusqu'à NOW.
function dailySeries(days: number, price: (i: number) => number): MarketPoint[] {
  return Array.from({ length: days + 1 }, (_, i) => {
    const c = price(i);
    return { t: nowSec - (days - i) * DAY, o: c, h: c, l: c, c, v: 100 + i };
  });
}

describe('periods', () => {
  it('lists the eight periods of the spec', () => {
    expect(CHART_PERIODS.map((p) => p.id)).toEqual(['1J', '5J', '1M', '6M', 'YTD', '1A', '5A', 'MAX']);
    expect(isChartPeriod('YTD')).toBe(true);
    expect(isChartPeriod('2A')).toBe(false);
  });

  it('starts the display at the right date and never before the data', () => {
    const first = nowSec - 800 * DAY;
    expect(new Date(displayStart('YTD', first, NOW) * 1000).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(new Date(displayStart('1M', first, NOW) * 1000).toISOString()).toBe('2026-09-06T16:00:00.000Z');
    expect(displayStart('1A', nowSec - 100 * DAY, NOW)).toBe(nowSec - 100 * DAY);
    expect(displayStart('1J', 123, NOW)).toBe(123);
    expect(displayStart('MAX', 456, NOW)).toBe(456);
  });

  it('converts moving-average lengths for weekly and monthly charts', () => {
    expect(movingAverageWindow(200, '1d')).toBe(200);
    expect(movingAverageWindow(200, '1wk')).toBe(40);
    expect(movingAverageWindow(200, '1mo')).toBe(10);
    expect(movingAverageWindow(20, '1mo')).toBe(2);
  });
});

describe('parseChartResponse', () => {
  const json = {
    chart: {
      result: [{
        meta: {
          symbol: 'cw8.pa', longName: 'Amundi MSCI World', fullExchangeName: 'Paris', currency: 'EUR',
          instrumentType: 'ETF', exchangeTimezoneName: 'Europe/Paris', regularMarketPrice: 596.4,
          chartPreviousClose: 590, regularMarketDayHigh: 597, regularMarketDayLow: 591, regularMarketVolume: 1200,
          fiftyTwoWeekHigh: 610, fiftyTwoWeekLow: 480, currentTradingPeriod: { regular: { start: 1, end: 2 } },
        },
        timestamp: [300, 100, 200],
        indicators: { quote: [{ open: [3, 1, null], high: [3.5, 1.5, 2.5], low: [2.5, 0.5, 1.5], close: [3, 1, 2], volume: [30, null, 20] }] },
        events: {
          dividends: { b: { amount: 2, date: 1747180800 }, a: { amount: 1.5, date: 1715644800 }, z: { amount: 0, date: 1 } },
          splits: { s: { date: 1718000000, numerator: 10, denominator: 1, splitRatio: '10/1' } },
        },
      }],
    },
  };

  it('normalises meta, sorts points and fills missing OHLC values', () => {
    const parsed = parseChartResponse(json, 'CW8.PA');
    expect(parsed?.meta).toMatchObject({ symbol: 'CW8.PA', name: 'Amundi MSCI World', exchange: 'Paris', instrumentType: 'ETF', previousClose: 590, regularMarketStart: 1 });
    expect(parsed?.points.map((p) => p.t)).toEqual([100, 200, 300]);
    expect(parsed?.points[1]).toEqual({ t: 200, o: 2, h: 2.5, l: 1.5, c: 2, v: 20 });
    expect(parsed?.points[0].v).toBe(0);
  });

  it('reads dividends and splits as dated events', () => {
    const parsed = parseChartResponse(json, 'CW8.PA');
    expect(parsed?.dividends).toEqual([{ date: '2024-05-14', amount: 1.5 }, { date: '2025-05-14', amount: 2 }]);
    expect(parsed?.splits).toEqual([{ date: '2024-06-10', ratio: '10:1' }]);
  });

  it('returns null when the provider has no result', () => {
    expect(parseChartResponse({ chart: { result: null, error: { code: 'Not Found' } } }, 'XXX')).toBeNull();
    expect(parseChartResponse(null, 'XXX')).toBeNull();
  });
});

describe('analytics', () => {
  it('finds the last close at or before a date, with a 7-day tolerance at the start', () => {
    const points = dailySeries(10, (i) => 100 + i);
    expect(closeAtOrBefore(points, nowSec - 3 * DAY)).toBe(107);
    expect(closeAtOrBefore(points, nowSec - 3 * DAY + 3600)).toBe(107);
    expect(closeAtOrBefore(points, nowSec - 15 * DAY)).toBe(100);
    expect(closeAtOrBefore(points, nowSec - 30 * DAY)).toBeNull();
  });

  it('computes performance per period and leaves too-short periods empty', () => {
    const points = dailySeries(400, (i) => 100 + i * 0.5); // 100 → 300
    const perf = performanceByPeriod(points, 300, NOW);
    expect(perf['1S']).toBeCloseTo(300 / 296.5 - 1, 10);
    expect(perf['1A']).toBeCloseTo(300 / (100 + 35 * 0.5) - 1, 2);
    expect(perf['3A']).toBeNull();
    expect(perf.YTD).toBeCloseTo(300 / (100 + (400 - 279) * 0.5) - 1, 10); // clôture du 31 décembre
  });

  it('annualises the volatility of daily log returns', () => {
    // Alternance +1 % / −1 % : écart-type ≈ 1 % par jour.
    const points = dailySeries(365, (i) => 100 * (i % 2 === 0 ? 1 : 1.01));
    const vol = annualizedVolatility(points, NOW, 252);
    expect(vol).toBeGreaterThan(0.15);
    expect(vol).toBeLessThan(0.17);
    expect(annualizedVolatility(dailySeries(10, () => 100), NOW)).toBeNull();
  });

  it('measures the worst peak-to-trough fall over one year', () => {
    const prices = [100, 120, 90, 110, 60, 130];
    const points = prices.map((c, i) => ({ t: nowSec - (prices.length - 1 - i) * DAY, o: c, h: c, l: c, c, v: 1 }));
    expect(maxDrawdown(points, NOW)).toBeCloseTo(60 / 120 - 1, 10);
  });

  it('averages recent volumes and ignores days without trading', () => {
    const points = dailySeries(10, () => 1).map((p, i) => ({ ...p, v: i % 2 ? 0 : 10 }));
    expect(averageVolume(points, NOW)).toBe(10);
  });

  it('groups dividends by calendar year and computes the 12-month yield', () => {
    const dividends = [
      { date: '2022-05-10', amount: 1 },
      { date: '2025-05-10', amount: 2 },
      { date: '2025-11-10', amount: 1 },
      { date: '2026-05-10', amount: 2.5 },
    ];
    expect(dividendsByYear(dividends, NOW, 3)).toEqual([
      { year: 2024, total: 0, count: 0 },
      { year: 2025, total: 3, count: 2 },
      { year: 2026, total: 2.5, count: 1 },
    ]);
    expect(trailingDividendYield(dividends, 100, NOW)).toBeCloseTo(0.035, 10);
    expect(trailingDividendYield([], 100, NOW)).toBeNull();
  });

  it('computes a simple moving average once the window is full', () => {
    expect(simpleMovingAverage([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('aligns another series on the timeline and rebases it to 0 %', () => {
    const timeline = [10, 20, 30, 40];
    const other: MarketPoint[] = [5, 25, 41].map((t, i) => ({ t, o: 0, h: 0, l: 0, c: [50, 55, 60][i], v: 0 }));
    expect(alignToTimeline(timeline, other)).toEqual([50, 50, 55, 55]);
    expect(alignToTimeline(timeline, other, 2)).toEqual([50, 50, 55, 60]);
    const rel = toRelativeChange([null, 50, 55, 60]);
    expect(rel[0]).toBeNull();
    expect(rel[2]).toBeCloseTo(0.1, 10);
  });

  it('places the price within the 52-week range', () => {
    expect(rangePosition(150, 100, 200)).toBe(0.5);
    expect(rangePosition(250, 100, 200)).toBe(1);
    expect(rangePosition(150, null, 200)).toBeNull();
  });
});

describe('recents', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it('keeps the six most recent symbols without duplicates', async () => {
    const { pushRecent, readRecents } = await import('./recents');
    const storage = memory();
    for (const s of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'C']) pushRecent({ symbol: s, name: s }, storage);
    expect(readRecents(storage).map((r) => r.symbol)).toEqual(['C', 'G', 'F', 'E', 'D', 'B']);
  });

  it('survives a broken or unavailable storage', async () => {
    const { pushRecent, readRecents } = await import('./recents');
    expect(readRecents({ getItem: () => '{not json' })).toEqual([]);
    expect(readRecents(null)).toEqual([]);
    const throwing = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(pushRecent({ symbol: 'A', name: 'A' }, throwing)).toEqual([{ symbol: 'A', name: 'A' }]);
  });
});
