import { describe, expect, it } from 'vitest';
import { instrumentLabel, instrumentName, prettifyInstrumentName, shortInstrumentName } from './instrument-names';

describe('prettifyInstrumentName', () => {
  it('remet en casse normale les noms en majuscules, sigles conservés', () => {
    expect(prettifyInstrumentName('BNP PARIBAS EASY S&P 500 UCITS ETF')).toBe('BNP Paribas Easy S&P 500 UCITS ETF');
    expect(prettifyInstrumentName("L'OREAL")).toBe("L'Oreal");
    expect(prettifyInstrumentName('COMPAGNIE DE SAINT-GOBAIN')).toBe('Compagnie de Saint-Gobain');
  });

  it('laisse intacts les noms déjà en casse normale', () => {
    expect(prettifyInstrumentName("L'Oréal")).toBe("L'Oréal");
    expect(prettifyInstrumentName('Amundi MSCI World UCITS ETF')).toBe('Amundi MSCI World UCITS ETF');
  });
});

describe('instrumentName', () => {
  it('ignore un nom qui n’est que le code', () => {
    expect(instrumentName('OR.PA', 'OR.PA')).toBeNull();
    expect(instrumentName('OR.PA', null)).toBeNull();
  });

  it('retire la devise de cotation des cryptos', () => {
    expect(instrumentName('BTC-USD', 'Bitcoin USD')).toBe('Bitcoin');
  });

  it('retombe sur le code quand le nom manque', () => {
    expect(instrumentLabel('OR.PA', undefined)).toBe('OR.PA');
    expect(instrumentLabel('OR.PA', "L'Oréal")).toBe("L'Oréal");
  });
});

describe('shortInstrumentName', () => {
  it('raccourcit les ETF et les formes sociales', () => {
    expect(shortInstrumentName('Amundi MSCI World UCITS ETF')).toBe('MSCI World ETF');
    expect(shortInstrumentName("L'Air Liquide S.A.")).toBe("L'Air Liquide");
    expect(shortInstrumentName('TotalEnergies SE')).toBe('TotalEnergies');
  });

  it('coupe au-delà de la longueur demandée', () => {
    expect(shortInstrumentName('Amundi PEA Emergents ESG Transition UCITS ETF')).toBe('PEA Emergents ESG…');
  });
});
