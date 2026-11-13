import { describe, expect, it } from 'vitest';
import {
  alsoWatchedOf,
  exchangeSuffix,
  industryScreenerQuery,
  parseRecommendations,
  parseScreener,
  regionOf,
  selectPeers,
  withGlobalPeers,
} from './similar';

describe('régions et places', () => {
  it('déduit la région du suffixe de cotation', () => {
    expect(regionOf('NVDA')).toBe('us');
    expect(regionOf('BRK-B')).toBe('us');
    expect(regionOf('SU.PA')).toBe('fr');
    expect(regionOf('SAP.DE')).toBe('de');
    expect(regionOf('XYZ.QQ')).toBeNull();
    expect(exchangeSuffix('AIR.PA')).toBe('PA');
    expect(exchangeSuffix('BTC-USD')).toBeNull();
  });

  it('construit la requête du filtre par secteur', () => {
    const q = industryScreenerQuery('Semiconductors', 'us', 10);
    expect(q.size).toBe(10);
    expect(q.query.operands).toEqual([
      { operator: 'EQ', operands: ['region', 'us'] },
      { operator: 'EQ', operands: ['industry', 'Semiconductors'] },
    ]);
  });
});

describe('lecture des réponses', () => {
  it('lit le filtre de titres', () => {
    const json = { finance: { result: [{ quotes: [
      { symbol: 'NVDA', shortName: 'NVIDIA Corporation', marketCap: 4.5e12 },
      { symbol: 'avgo', longName: 'Broadcom Inc.', shortName: 'Broadcom', marketCap: { raw: 1.6e12 } },
      { shortName: 'sans symbole' },
    ] }], error: null } };
    expect(parseScreener(json)).toEqual([
      { symbol: 'NVDA', name: 'NVIDIA Corporation', marketCap: 4.5e12 },
      { symbol: 'AVGO', name: 'Broadcom Inc.', marketCap: 1.6e12 },
    ]);
    expect(parseScreener({ finance: { result: null, error: { code: 'Unauthorized' } } })).toBeNull();
  });

  it('lit les titres souvent consultés', () => {
    const json = { finance: { result: [{ symbol: 'NVDA', recommendedSymbols: [{ symbol: 'AMD', score: 0.12 }, { symbol: 'tsla', score: 0.1 }] }] } };
    expect(parseRecommendations(json)).toEqual(['AMD', 'TSLA']);
    expect(parseRecommendations({})).toBeNull();
  });
});

describe('sélection', () => {
  const items = (...symbols: string[]) => symbols.map((symbol) => ({ symbol, name: null }));

  it('garde la même place, sans le titre ni doublon', () => {
    expect(selectPeers('NVDA', items('NVDA', 'AVGO', 'NVD.DE', 'AMD', 'AMD', 'TSM'), 3).map((p) => p.symbol)).toEqual(['AVGO', 'AMD', 'TSM']);
    expect(selectPeers('SU.PA', items('SU.PA', 'LR.PA', 'SIE.DE', 'NEX.PA')).map((p) => p.symbol)).toEqual(['LR.PA', 'NEX.PA']);
  });

  it('complète des pairs locaux par des sociétés américaines', () => {
    const local = items('LR.PA', 'NEX.PA');
    expect(withGlobalPeers(local, items('ETN', 'LR.PA', 'ABB.SW', 'EMR'), 'SU.PA', 4, 8).map((p) => p.symbol)).toEqual(['LR.PA', 'NEX.PA', 'ETN', 'EMR']);
    expect(withGlobalPeers(items('A', 'B', 'C', 'D', 'E'), items('X'), 'Z', 4, 4)).toHaveLength(4);
  });

  it('retire des « souvent consultés » le titre et les pairs déjà montrés', () => {
    expect(alsoWatchedOf('NVDA', ['TSLA', 'AMD', 'NVDA', 'META', 'TSLA'], items('AMD')).map((p) => p.symbol)).toEqual(['TSLA', 'META']);
  });
});
