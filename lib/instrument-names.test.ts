import { describe, expect, it } from 'vitest';
import { instrumentLabel, instrumentName, preferredInstrumentName, prettifyInstrumentName, shortInstrumentName } from './instrument-names';

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

describe('preferredInstrumentName', () => {
  it('préfère le nom long quand le nom court est en majuscules', () => {
    expect(preferredInstrumentName('TOTALENERGIES', 'TotalEnergies SE')).toBe('TotalEnergies SE');
    expect(preferredInstrumentName('ASML HOLDING', 'ASML Holding N.V.')).toBe('ASML Holding N.V.');
  });

  it('garde le nom court quand il est déjà en casse normale', () => {
    expect(preferredInstrumentName("L'Oréal", "L'Oréal S.A.")).toBe("L'Oréal");
  });

  it('retombe sur le nom disponible', () => {
    expect(preferredInstrumentName('AIRBUS SE', null)).toBe('AIRBUS SE');
    expect(preferredInstrumentName(undefined, 'Airbus SE')).toBe('Airbus SE');
    expect(preferredInstrumentName('', '')).toBeNull();
  });
});
