import type { PortfolioHistoryPoint } from './portfolio-calculator';
import { getAccountColorMap, OTHER_ACCOUNTS_COLOR } from './utils';

export interface AccountHistorySeries {
  key: string;
  label: string;
  color: string;
  latestValue: number;
}

export type AccountHistoryRow = { date: string; total: number } & Record<string, number | string>;

export const OTHER_ACCOUNTS_KEY = 'others';

/**
 * Transforme l'historique en séries empilables, une par compte.
 * - la couleur suit le compte (ordre de création), jamais son rang ;
 * - au-delà de la palette, les comptes restants sont regroupés dans "Autres comptes" ;
 * - les comptes vides sur toute la période sont omis ;
 * - l'ordre d'empilement place le plus gros compte (valeur finale) en bas.
 * Renvoie `null` si l'historique ne contient pas de valeurs par compte.
 */
export function buildAccountHistorySeries(
  history: PortfolioHistoryPoint[],
  accounts: Array<{ id: string; name: string }>
): { series: AccountHistorySeries[]; rows: AccountHistoryRow[] } | null {
  if (history.length === 0 || history.some((point) => !point.accountValues)) return null;

  const colors = getAccountColorMap(accounts);
  const seriesKeyByAccount = new Map<string, string>();
  const seriesMeta = new Map<string, { label: string; color: string }>();

  accounts.forEach((account) => {
    const color = colors.get(account.id) ?? OTHER_ACCOUNTS_COLOR;
    const isOther = color === OTHER_ACCOUNTS_COLOR;
    const key = isOther ? OTHER_ACCOUNTS_KEY : `acc_${account.id}`;
    seriesKeyByAccount.set(account.id, key);
    if (!seriesMeta.has(key)) {
      seriesMeta.set(key, { label: isOther ? 'Autres comptes' : account.name, color });
    }
  });

  const rows: AccountHistoryRow[] = history.map((point) => {
    const row: AccountHistoryRow = { date: point.date, total: point.totalValue };
    for (const [accountId, value] of Object.entries(point.accountValues ?? {})) {
      const key = seriesKeyByAccount.get(accountId);
      if (!key) continue;
      row[key] = ((row[key] as number | undefined) ?? 0) + value;
    }
    return row;
  });

  const lastRow = rows[rows.length - 1];
  const series: AccountHistorySeries[] = [];
  seriesMeta.forEach((meta, key) => {
    const hasValue = rows.some((row) => Math.abs((row[key] as number | undefined) ?? 0) > 0.005);
    if (!hasValue) return;
    series.push({ key, ...meta, latestValue: (lastRow[key] as number | undefined) ?? 0 });
  });

  // Remplit les trous à 0 pour que chaque série soit continue dans l'empilement.
  for (const row of rows) {
    for (const s of series) {
      if (row[s.key] === undefined) row[s.key] = 0;
    }
  }

  series.sort((a, b) => {
    if (a.key === OTHER_ACCOUNTS_KEY) return 1;
    if (b.key === OTHER_ACCOUNTS_KEY) return -1;
    return b.latestValue - a.latestValue;
  });

  return { series, rows };
}
