// Périodes du graphique de l'explorateur de marchés (docs/specs/explorateur-marches.md §4.2).
// Hors intraday, on demande au fournisseur plus d'historique que la période
// affichée : les moyennes mobiles démarrent ainsi dès le premier point visible.

export type ChartPeriod = '1J' | '5J' | '1M' | '6M' | 'YTD' | '1A' | '5A' | 'MAX';
export type ChartInterval = '5m' | '15m' | '1d' | '1wk' | '1mo';

export interface ChartPeriodConfig {
  id: ChartPeriod;
  label: string;
  // Historique demandé au fournisseur (préchauffage inclus).
  range: '1d' | '5d' | '1y' | '2y' | '10y' | 'max';
  interval: ChartInterval;
  intraday: boolean;
}

export const CHART_PERIODS: readonly ChartPeriodConfig[] = [
  { id: '1J', label: '1J', range: '1d', interval: '5m', intraday: true },
  { id: '5J', label: '5J', range: '5d', interval: '15m', intraday: true },
  { id: '1M', label: '1M', range: '1y', interval: '1d', intraday: false },
  { id: '6M', label: '6M', range: '2y', interval: '1d', intraday: false },
  { id: 'YTD', label: 'YTD', range: '2y', interval: '1d', intraday: false },
  { id: '1A', label: '1A', range: '2y', interval: '1d', intraday: false },
  { id: '5A', label: '5A', range: '10y', interval: '1wk', intraday: false },
  { id: 'MAX', label: 'Max', range: 'max', interval: '1mo', intraday: false },
];

export const DEFAULT_CHART_PERIOD: ChartPeriod = '1A';

export function isChartPeriod(value: unknown): value is ChartPeriod {
  return CHART_PERIODS.some((p) => p.id === value);
}

export function getChartPeriod(id: ChartPeriod): ChartPeriodConfig {
  return CHART_PERIODS.find((p) => p.id === id) ?? CHART_PERIODS[5];
}

const DAY = 86_400;

function shiftMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

// Premier instant affiché (secondes Unix). Intraday et Max : tout l'historique
// renvoyé. Sinon : la période se compte à partir de maintenant.
export function displayStart(period: ChartPeriod, firstPointT: number, now: Date = new Date()): number {
  const nowSec = Math.floor(now.getTime() / 1000);
  let start: number;
  switch (period) {
    case '1J':
    case '5J':
    case 'MAX':
      return firstPointT;
    case '1M':
      start = Math.floor(shiftMonthsUtc(now, 1).getTime() / 1000);
      break;
    case '6M':
      start = Math.floor(shiftMonthsUtc(now, 6).getTime() / 1000);
      break;
    case 'YTD':
      start = Math.floor(Date.UTC(now.getUTCFullYear(), 0, 1) / 1000);
      break;
    case '1A':
      start = Math.floor(shiftMonthsUtc(now, 12).getTime() / 1000);
      break;
    case '5A':
      start = Math.floor(shiftMonthsUtc(now, 60).getTime() / 1000);
      break;
    default:
      start = nowSec - 365 * DAY;
  }
  return Math.max(start, firstPointT);
}

// Longueur d'une moyenne mobile exprimée en jours de bourse, convertie en
// nombre de points selon l'intervalle (≈ 5 séances par semaine, 21 par mois).
export function movingAverageWindow(days: number, interval: ChartInterval): number {
  const perPoint = interval === '1wk' ? 5 : interval === '1mo' ? 21 : 1;
  return Math.max(2, Math.round(days / perPoint));
}

// Durée de cache côté serveur des réponses du fournisseur.
export function cacheSecondsFor(interval: ChartInterval): number {
  return interval === '5m' || interval === '15m' ? 60 : 3600;
}
