// Récapitulatif mensuel envoyé par e-mail : période, chiffres et rendu HTML.
// Logique pure (testée) ; la lecture des données et l'envoi sont dans
// lib/monthly-digest.ts.

import { calculateModifiedDietzPerformance, type PortfolioHistoryPoint } from './portfolio-calculator';
import { convertToBase, type FxRateMap } from './fx';
import type { Account, Transaction } from './types';

export interface DigestPeriod {
  /** Clé du mois récapitulé : son premier jour (YYYY-MM-01). */
  key: string;
  start: string;
  end: string;
  /** Dernier jour du mois précédent : valeur de départ. */
  previousEnd: string;
  /** « octobre 2026 » */
  label: string;
  /** « 31 octobre » */
  endLabel: string;
}

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Mois civil précédant `today` (YYYY-MM-DD). */
export function previousMonthPeriod(today: string): DigestPeriod {
  const [year, month] = today.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 2, 1));
  const end = new Date(Date.UTC(year, month - 1, 0));
  const previousEnd = new Date(Date.UTC(year, month - 2, 0));
  return {
    key: iso(start),
    start: iso(start),
    end: iso(end),
    previousEnd: iso(previousEnd),
    label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
    endLabel: `${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]}`,
  };
}

export interface DigestData {
  period: DigestPeriod;
  valueStart: number;
  valueEnd: number;
  /** Versements moins retraits du mois, en euros. */
  netFlows: number;
  /** Gain du mois hors apports. */
  gain: number;
  /** Rendement du mois hors apports ; null si le portefeuille partait de zéro. */
  gainPercent: number | null;
  accounts: Array<{ name: string; value: number }>;
}

/**
 * Chiffres du mois à partir des valeurs de début et de fin de période.
 * Renvoie null si le portefeuille est vide en fin de mois : rien à récapituler.
 */
export function computeDigest(input: {
  period: DigestPeriod;
  accounts: Pick<Account, 'id' | 'name'>[];
  transactions: Transaction[];
  startPoint: PortfolioHistoryPoint | undefined;
  endPoint: PortfolioHistoryPoint | undefined;
  fxRates?: FxRateMap;
}): DigestData | null {
  const { period, accounts, transactions, startPoint, endPoint, fxRates = {} } = input;
  const valueEnd = endPoint?.totalValue ?? 0;
  if (!endPoint || valueEnd <= 0.005) return null;
  const valueStart = Math.max(0, startPoint?.totalValue ?? 0);

  let netFlows = 0;
  for (const tx of transactions) {
    if (tx.date < period.start || tx.date > period.end) continue;
    if (tx.type !== 'DEPOSIT' && tx.type !== 'WITHDRAWAL') continue;
    const amount = convertToBase(tx.amount, tx.currency ?? 'EUR', tx.date, fxRates);
    netFlows += tx.type === 'DEPOSIT' ? amount : -amount;
  }

  const gain = valueEnd - valueStart - netFlows;
  let gainPercent: number | null = null;
  if (valueStart > 0.005) {
    const dietz = calculateModifiedDietzPerformance(
      [
        { date: period.previousEnd, totalValue: valueStart, stocksValue: 0, savingsValue: 0, positions: [] },
        { date: period.end, totalValue: valueEnd, stocksValue: 0, savingsValue: 0, positions: [] },
      ],
      transactions,
      period.start,
      period.end,
      'totalValue',
      fxRates
    );
    gainPercent = dietz.gainLossPercent;
  }

  const accountValues = endPoint.accountValues ?? {};
  const accountLines = accounts
    .map((account) => ({ name: account.name, value: accountValues[account.id] ?? 0 }))
    .filter((line) => Math.abs(line.value) > 0.005)
    .sort((a, b) => b.value - a.value);

  return { period, valueStart, valueEnd, netFlows, gain, gainPercent, accounts: accountLines };
}

const euros = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(amount));
const signedEuros = (amount: number) => `${amount >= 0 ? '+' : '−'}${euros(Math.abs(amount))}`;
const signedPercent = (value: number) =>
  `${value >= 0 ? '+' : '−'}${Math.abs(value).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Objet et corps HTML du récapitulatif (le corps s'insère dans le gabarit des e-mails). */
export function renderDigestEmail(
  data: DigestData,
  links: { dashboardUrl: string; unsubscribeUrl: string; settingsUrl: string }
): { subject: string; title: string; body: string } {
  const { period } = data;
  const gainColor = data.gain >= 0 ? '#047857' : '#b91c1c';
  const flowsLine =
    Math.abs(data.netFlows) > 0.5
      ? `<tr><td style="padding:6px 0;color:#5b524a">${data.netFlows >= 0 ? 'Vos apports nets' : 'Vos retraits nets'}</td><td align="right" style="padding:6px 0">${signedEuros(data.netFlows)}</td></tr>`
      : '';
  const accountRows = data.accounts
    .slice(0, 6)
    .map(
      (account) =>
        `<tr><td style="padding:6px 0;border-top:1px solid #d8cdb6">${escapeHtml(account.name)}</td><td align="right" style="padding:6px 0;border-top:1px solid #d8cdb6">${euros(account.value)}</td></tr>`
    )
    .join('');
  const moreAccounts = data.accounts.length > 6 ? `<p style="margin:8px 0 0;color:#5b524a;font-size:13px">Et ${data.accounts.length - 6} autre(s) compte(s).</p>` : '';

  const body = `<h1 style="margin:0 0 4px;font-size:22px">Votre patrimoine en ${period.label}</h1>
    <p style="margin:0 0 20px;color:#5b524a">Situation au ${period.endLabel}, d’après les cours de clôture.</p>
    <p style="margin:0;font-size:13px;color:#5b524a">Patrimoine total</p>
    <p style="margin:0 0 16px;font-size:30px;font-weight:600">${euros(data.valueEnd)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">
      <tr><td style="padding:6px 0;color:#5b524a">Variation sur le mois</td><td align="right" style="padding:6px 0">${signedEuros(data.valueEnd - data.valueStart)}</td></tr>
      ${flowsLine}
      <tr><td style="padding:6px 0;color:#5b524a">Gain hors apports</td><td align="right" style="padding:6px 0;font-weight:600;color:${gainColor}">${signedEuros(data.gain)}${data.gainPercent !== null ? ` (${signedPercent(data.gainPercent)})` : ''}</td></tr>
    </table>
    ${
      accountRows
        ? `<h2 style="margin:24px 0 4px;font-size:15px">Par compte</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${accountRows}</table>${moreAccounts}`
        : ''
    }
    <p style="margin:28px 0 8px">
      <a href="${links.dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#0e0c0a;color:#f7f2e8;text-decoration:none;border-radius:8px;font-weight:500">Ouvrir mon tableau de bord</a>
    </p>
    <p style="margin:24px 0 0;color:#5b524a;font-size:12px;line-height:1.5">
      Vous recevez ce récapitulatif une fois par mois parce que vous suivez votre patrimoine sur Fi-Hub.
      <a href="${links.unsubscribeUrl}" style="color:#5b524a">Ne plus le recevoir</a> ·
      <a href="${links.settingsUrl}" style="color:#5b524a">Gérer mes e-mails</a>
    </p>`;

  return {
    subject: `Votre récapitulatif ${/^[aeiouhéèêàâîôû]/i.test(period.label) ? 'd’' : 'de '}${period.label}`,
    title: `Votre patrimoine en ${period.label}`,
    body,
  };
}
