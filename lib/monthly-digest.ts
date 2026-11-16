import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { computeDigest, previousMonthPeriod, renderDigestEmail, type DigestData, type DigestPeriod } from '@/lib/digest';
import { signDigestToken } from '@/lib/digest-token';
import { renderEmailLayout, sendMonthlyDigest } from '@/lib/email';
import { calculatePortfolioHistory, getUniqueSymbolsFromTransactions } from '@/lib/portfolio-calculator';
import { getMultipleHistoricalQuotes, type HistoricalQuote } from '@/lib/stock-api';
import { BASE_CURRENCY, fxRateSymbol, normalizeToFiat, uniqueForeignFiats, type FxRateMap } from '@/lib/fx';
import { heldSymbols } from '@/lib/quick-portfolio';
import { accountSupportsPositions } from '@/lib/utils';
import type { Account, Transaction } from '@/lib/types';

// Récapitulatif mensuel : pour chaque utilisateur qui a un patrimoine suivi et
// n'a pas coupé cet e-mail, la valeur en fin de mois, la variation et le gain
// hors apports du mois écoulé. Un seul envoi par utilisateur et par mois
// (profiles.monthly_digest_sent_for), même si la tâche tourne chaque jour.

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

const PAGE = 1000;

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://fi-hub.subleet.com').replace(/\/$/, '');
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadTransactions(db: AdminClient, userId: string, until: string): Promise<Transaction[]> {
  const rows: Transaction[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .lte('date', until)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Transaction[]));
    if (!data || data.length < PAGE) return rows;
  }
}

async function loadFxRates(currencies: string[], start: string, end: string): Promise<FxRateMap> {
  const symbolByFiat = new Map<string, string>();
  for (const fiat of new Set(currencies.map(normalizeToFiat))) {
    if (fiat === BASE_CURRENCY) continue;
    const symbol = fxRateSymbol(fiat);
    if (symbol) symbolByFiat.set(fiat, symbol);
  }
  if (symbolByFiat.size === 0) return {};
  const market = await getMultipleHistoricalQuotes(Array.from(symbolByFiat.values()), start, end, '1d');
  const rates: FxRateMap = {};
  symbolByFiat.forEach((symbol, fiat) => {
    rates[fiat] = market[symbol] ?? [];
  });
  return rates;
}

/** Chiffres du mois pour un utilisateur ; null s'il n'a rien à récapituler. */
export async function buildUserDigest(db: AdminClient, userId: string, period: DigestPeriod): Promise<DigestData | null> {
  const { data: accountRows, error } = await db.from('accounts').select('*').eq('user_id', userId);
  if (error) throw error;
  const accounts = (accountRows ?? []) as Account[];
  if (accounts.length === 0) return null;

  const transactions = await loadTransactions(db, userId, period.end);
  if (transactions.length === 0) return null;

  // Dix jours avant la valeur de départ : couvre week-ends et jours fériés.
  const quotesStart = shiftDays(period.previousEnd, -10);
  const positionAccountIds = new Set(accounts.filter(accountSupportsPositions).map((a) => a.id));
  const symbols = getUniqueSymbolsFromTransactions(transactions.filter((t) => positionAccountIds.has(t.account_id)));
  const quotes: Record<string, HistoricalQuote[]> =
    symbols.length > 0 ? await getMultipleHistoricalQuotes(symbols, quotesStart, period.end, '1d') : {};

  // Un titre encore détenu sans cours sur la période fausserait les montants :
  // mieux vaut ne rien envoyer et réessayer à la prochaine exécution.
  const held = heldSymbols(transactions.filter((t) => positionAccountIds.has(t.account_id)));
  for (const symbol of held) {
    if (!(quotes[symbol] ?? []).some((q) => q.date <= period.end)) {
      throw new Error(`quotes_unavailable:${symbol}`);
    }
  }

  const quoteCurrencies = Object.values(quotes)
    .map((series) => series.find((q) => Boolean(q.currency))?.currency)
    .filter((c): c is string => Boolean(c));
  const fxRates = await loadFxRates([...uniqueForeignFiats(transactions), ...quoteCurrencies], quotesStart, period.end);

  const valueAt = (date: string) =>
    calculatePortfolioHistory(
      transactions.filter((t) => t.date <= date),
      accounts,
      quotes,
      date,
      date,
      'daily',
      fxRates
    )[0];

  const hadActivityBefore = transactions.some((t) => t.date <= period.previousEnd);
  return computeDigest({
    period,
    accounts,
    transactions,
    startPoint: hadActivityBefore ? valueAt(period.previousEnd) : undefined,
    endPoint: valueAt(period.end),
    fxRates,
  });
}

function digestLinks(userId: string) {
  const base = appUrl();
  const token = signDigestToken(userId) ?? '';
  return {
    dashboardUrl: `${base}/dashboard`,
    settingsUrl: `${base}/settings/profile`,
    unsubscribeUrl: `${base}/api/digest/unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`,
  };
}

export interface DigestRunResult {
  period: string;
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Aperçu HTML du premier récapitulatif (mode essai uniquement). */
  preview?: string;
}

/**
 * Envoie les récapitulatifs du mois écoulé à ceux qui ne l'ont pas encore reçu.
 * `dryRun` calcule sans envoyer ni marquer l'envoi.
 */
export async function runMonthlyDigest(options: { today: string; limit?: number; dryRun?: boolean }): Promise<DigestRunResult> {
  const period = previousMonthPeriod(options.today);
  const limit = options.limit ?? 50;
  const db = await createAdminClient();
  const result: DigestRunResult = { period: period.key, candidates: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: profiles, error } = await db
    .from('profiles')
    .select('id')
    .eq('monthly_digest', true)
    .or(`monthly_digest_sent_for.is.null,monthly_digest_sent_for.lt.${period.key}`)
    .limit(limit);
  if (error) throw error;
  result.candidates = profiles?.length ?? 0;

  for (const profile of profiles ?? []) {
    const userId = profile.id as string;
    try {
      const { data: authData } = await db.auth.admin.getUserById(userId);
      const email = authData?.user?.email;
      const confirmed = Boolean(authData?.user?.email_confirmed_at);
      const digest = email && confirmed ? await buildUserDigest(db, userId, period) : null;

      if (options.dryRun) {
        if (digest) {
          result.sent += 1;
          if (!result.preview) {
            const rendered = renderDigestEmail(digest, digestLinks(userId));
            result.preview = renderEmailLayout(rendered.title, rendered.body);
          }
        } else {
          result.skipped += 1;
        }
        continue;
      }

      // Réserve l'envoi avant d'envoyer : deux exécutions simultanées ne
      // doublent pas l'e-mail. Sans patrimoine, le mois est marqué traité.
      const { data: claimed, error: claimError } = await db
        .from('profiles')
        .update({ monthly_digest_sent_for: period.key })
        .eq('id', userId)
        .or(`monthly_digest_sent_for.is.null,monthly_digest_sent_for.lt.${period.key}`)
        .select('id');
      if (claimError) throw claimError;
      if (!claimed || claimed.length === 0) {
        result.skipped += 1;
        continue;
      }
      if (!digest || !email) {
        result.skipped += 1;
        continue;
      }

      const links = digestLinks(userId);
      const delivered = await sendMonthlyDigest(email, renderDigestEmail(digest, links), links.unsubscribeUrl);
      if (delivered) {
        result.sent += 1;
      } else {
        // Envoi refusé : on libère le mois pour la prochaine exécution.
        result.failed += 1;
        await db.from('profiles').update({ monthly_digest_sent_for: null }).eq('id', userId).eq('monthly_digest_sent_for', period.key);
      }
    } catch (err) {
      result.failed += 1;
      console.error('[monthly-digest] user failed', userId, err);
    }
  }

  return result;
}
