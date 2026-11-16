'use client';

// Saisie rapide d'un portefeuille déjà constitué : une ligne par titre détenu
// (quantité, prix de revient), sans ressaisir l'historique des achats.
// Utilisé dans l'onboarding et depuis l'onglet Positions.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Loader2, Search, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-errors';
import { parseDecimal, formatDecimalInput } from '@/lib/decimal';
import { useStockSearch } from '@/lib/hooks';
import { instrumentName } from '@/lib/instrument-names';
import { QUICK_PORTFOLIO_MAX_ROWS } from '@/lib/quick-portfolio';
import { formatCurrency, isCryptoSymbol } from '@/lib/utils';
import type { Account } from '@/lib/types';

type QuickAccount = Pick<Account, 'id' | 'name' | 'type' | 'currency' | 'supports_positions'>;

interface Row {
  symbol: string;
  name: string;
  currency: string;
  /** Cours actuel, pour situer le prix de revient ; absent si indisponible. */
  quote: number | null;
  quantity: string;
  price: string;
}

export interface QuickPortfolioLimit {
  scope: 'transactions' | 'positions';
  message: string;
  current?: number;
  max?: number;
}

interface Props {
  account: QuickAccount;
  onDone: (positions: number) => void;
  /** Bouton secondaire (« Retour », « Annuler »). */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Limite de l'offre atteinte : laissé à l'appelant (fenêtre Pro). */
  onLimit?: (limit: QuickPortfolioLimit) => void;
}

const INPUT =
  'w-full px-3 py-2.5 border border-[color:var(--rule)] rounded-lg bg-[color:var(--paper)] text-[color:var(--ink)] focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent';
const LABEL = 'block text-sm font-medium text-[color:var(--ink)] mb-1';

const todayLocal = () => new Date().toLocaleDateString('sv-SE');
const noSubscription = () => () => {};

export function QuickPortfolioForm({ account, onDone, onCancel, cancelLabel = 'Annuler', onLimit }: Props) {
  const isCrypto = account.type === 'CRYPTO';
  const accountCurrency = (account.currency || 'EUR').toUpperCase();
  const today = useSyncExternalStore(noSubscription, todayLocal, () => '');

  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [cash, setCash] = useState('');
  const [dateInput, setDate] = useState<string | null>(null);
  const date = dateInput ?? today;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { results, loading: searching, search } = useStockSearch();

  // Requête à laquelle correspondent les résultats affichés : tant que la
  // recherche en cours n'a pas répondu, on n'affiche pas ceux de la précédente
  // (un clic rapide choisirait le mauvais titre).
  const [searchedQuery, setSearchedQuery] = useState('');

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      search(term).then(() => setSearchedQuery(term));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const resultsReady = !searching && searchedQuery === query.trim();

  const filteredResults = useMemo(() => {
    const matches = results
      .filter((r) => (isCrypto ? isCryptoSymbol(r.symbol) : !isCryptoSymbol(r.symbol)))
      .filter((r) => !rows.some((row) => row.symbol === r.symbol.toUpperCase()));
    // PEA : la cotation parisienne d'abord (c'est presque toujours celle détenue).
    if (account.type === 'PEA') {
      matches.sort((a, b) => Number(b.symbol.toUpperCase().endsWith('.PA')) - Number(a.symbol.toUpperCase().endsWith('.PA')));
    }
    return matches.slice(0, 6);
  }, [results, isCrypto, rows, account.type]);

  const addRow = async (picked: { symbol: string; name: string }) => {
    const symbol = picked.symbol.toUpperCase();
    setQuery('');
    setError(null);
    setRows((prev) =>
      prev.some((r) => r.symbol === symbol) || prev.length >= QUICK_PORTFOLIO_MAX_ROWS
        ? prev
        : [...prev, { symbol, name: instrumentName(symbol, picked.name) ?? picked.name, currency: accountCurrency, quote: null, quantity: '', price: '' }]
    );
    try {
      const res = await fetch(`/api/stocks/quotes?symbols=${encodeURIComponent(symbol)}`);
      if (!res.ok) return;
      const data = await res.json();
      const quote = (data.quotes ?? [])[0] as { price?: number; currency?: string } | undefined;
      if (!quote) return;
      setRows((prev) =>
        prev.map((r) =>
          r.symbol === symbol
            ? { ...r, quote: quote.price ?? null, currency: (quote.currency || r.currency).toUpperCase() }
            : r
        )
      );
    } catch {
      // Cours indisponible : la ligne reste saisissable, le serveur revérifie le titre.
    }
  };

  const updateRow = (symbol: string, patch: Partial<Pick<Row, 'quantity' | 'price'>>) =>
    setRows((prev) => prev.map((r) => (r.symbol === symbol ? { ...r, ...patch } : r)));

  const totals = useMemo(() => {
    const byCurrency = new Map<string, { invested: number; value: number; valued: boolean }>();
    for (const row of rows) {
      const quantity = parseDecimal(row.quantity);
      const price = parseDecimal(row.price);
      if (!(quantity > 0) || !(price > 0)) continue;
      const entry = byCurrency.get(row.currency) ?? { invested: 0, value: 0, valued: true };
      entry.invested += quantity * price;
      if (row.quote) entry.value += quantity * row.quote;
      else entry.valued = false;
      byCurrency.set(row.currency, entry);
    }
    return Array.from(byCurrency.entries());
  }, [rows]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rows.length === 0) {
      setError('Cherchez un titre ci-dessus pour ajouter votre première ligne.');
      return;
    }
    const positions = [];
    for (const row of rows) {
      const quantity = parseDecimal(row.quantity);
      const averagePrice = parseDecimal(row.price);
      if (!(quantity > 0)) {
        setError(`${row.name} : indiquez la quantité détenue.`);
        return;
      }
      if (!(averagePrice > 0)) {
        setError(`${row.name} : indiquez le prix de revient unitaire (PRU).`);
        return;
      }
      positions.push({ symbol: row.symbol, quantity, average_price: averagePrice });
    }
    const cashValue = cash.trim() ? parseDecimal(cash) : 0;
    if (!Number.isFinite(cashValue) || cashValue < 0) {
      setError('Les liquidités doivent être un montant positif.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/positions/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: account.id, date, cash: cashValue, positions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = getApiErrorMessage(data, 'Les positions n’ont pas pu être enregistrées.', res.status);
        if (data?.error === 'limit_reached' && onLimit) {
          onLimit({
            scope: data.scope === 'positions' ? 'positions' : 'transactions',
            message,
            current: typeof data.current === 'number' ? data.current : undefined,
            max: typeof data.limit === 'number' ? data.limit : undefined,
          });
        }
        setError(message);
        setSubmitting(false);
        return;
      }
      onDone(positions.length);
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion puis réessayez.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="relative">
        <label htmlFor="quick-security" className={LABEL}>
          {isCrypto ? 'Ajouter une crypto' : 'Ajouter un titre'}
        </label>
        <Search className="pointer-events-none absolute left-3 top-[2.35rem] h-4 w-4 text-[color:var(--ink-soft)]" aria-hidden="true" />
        <input
          id="quick-security"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isCrypto ? 'Bitcoin, BTC…' : 'Nom ou symbole, ex. CW8, Air Liquide'}
          autoComplete="off"
          disabled={rows.length >= QUICK_PORTFOLIO_MAX_ROWS}
          className={`${INPUT} pl-9`}
        />
        {query.trim().length >= 2 && (
          <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper)] shadow-lg">
            {!resultsReady && <li className="px-3 py-2 text-sm text-[color:var(--ink-soft)]">Recherche…</li>}
            {resultsReady && filteredResults.length === 0 && (
              <li className="px-3 py-2 text-sm text-[color:var(--ink-soft)]">Aucun résultat</li>
            )}
            {resultsReady && filteredResults.map((r) => (
              <li key={r.symbol}>
                <button
                  type="button"
                  onClick={() => addRow(r)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[color:var(--paper-2)]"
                >
                  <span className="font-medium">{instrumentName(r.symbol, r.name) ?? r.name}</span>
                  <span className="text-[color:var(--ink-soft)]"> · {r.symbol}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {rows.length > 0 && (
        <ul className="mt-4 space-y-3" aria-label="Titres détenus">
          {rows.map((row) => {
            const quantity = parseDecimal(row.quantity);
            const price = parseDecimal(row.price);
            const gain = row.quote && quantity > 0 && price > 0 ? (row.quote - price) * quantity : null;
            // Un prix de revient sans rapport avec le cours signale souvent une
            // erreur de saisie (montant total au lieu du prix unitaire, mauvais titre).
            const suspicious = Boolean(row.quote && price > 0 && (price > row.quote * 5 || price < row.quote / 5));
            return (
              <li key={row.symbol} className="rounded-lg border border-[color:var(--rule)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm">
                    <span className="block truncate font-medium text-[color:var(--ink)]">{row.name}</span>
                    <span className="block text-xs text-[color:var(--ink-soft)]">
                      {row.symbol}
                      {row.quote ? ` · cours ${formatCurrency(row.quote, row.currency)}` : ''}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((r) => r.symbol !== row.symbol))}
                    aria-label={`Retirer ${row.name}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`quick-qty-${row.symbol}`} className="mb-1 block text-xs text-[color:var(--ink-soft)]">
                      Quantité
                    </label>
                    <input
                      id={`quick-qty-${row.symbol}`}
                      type="text"
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.symbol, { quantity: e.target.value })}
                      placeholder="10"
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label htmlFor={`quick-pru-${row.symbol}`} className="mb-1 block text-xs text-[color:var(--ink-soft)]">
                      Prix de revient ({row.currency})
                    </label>
                    <input
                      id={`quick-pru-${row.symbol}`}
                      type="text"
                      inputMode="decimal"
                      value={row.price}
                      onChange={(e) => updateRow(row.symbol, { price: e.target.value })}
                      placeholder={row.quote ? formatDecimalInput(row.quote) : 'PRU'}
                      className={INPUT}
                    />
                  </div>
                </div>
                {suspicious && (
                  <p className="mt-2 text-xs text-[color:var(--loss)]">
                    Ce prix de revient est très éloigné du cours actuel. Vérifiez qu’il s’agit bien du prix par
                    titre, et du bon titre.
                  </p>
                )}
                {gain !== null && !suspicious && (
                  <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                    Plus-value latente :{' '}
                    <span className={gain >= 0 ? 'text-[color:var(--gain)]' : 'text-[color:var(--loss)]'}>
                      {gain >= 0 ? '+' : ''}
                      {formatCurrency(gain, row.currency)}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quick-cash" className={LABEL}>Liquidités disponibles ({accountCurrency})</label>
          <input
            id="quick-cash"
            type="text"
            inputMode="decimal"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            placeholder="0"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="quick-date" className={LABEL}>Suivi à partir du</label>
          <input
            id="quick-date"
            type="date"
            value={date}
            max={today || undefined}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-[color:var(--paper-2)] px-3 py-2.5 text-sm text-[color:var(--ink-soft)]">
        {totals.map(([currency, t]) => (
          <p key={currency}>
            Montant investi : <span className="font-medium text-[color:var(--ink)]">{formatCurrency(t.invested, currency)}</span>
            {t.valued && t.value > 0 && (
              <>
                {' '}· valeur actuelle : <span className="font-medium text-[color:var(--ink)]">{formatCurrency(t.value, currency)}</span>
              </>
            )}
          </p>
        ))}
        <p className={totals.length > 0 ? 'mt-1' : undefined}>
          Le prix de revient figure sur votre relevé ou dans l’espace de votre courtier. Vos plus-values seront
          exactes dès aujourd’hui ; la performance passée, elle, demande l’historique (import ou saisie des achats).
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-[color:var(--loss)] bg-[color:var(--loss-soft)] px-3 py-2.5 text-sm text-[color:var(--loss)]">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-sm text-[color:var(--ink-soft)] underline underline-offset-4 hover:text-[color:var(--ink)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn-ink inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {rows.length > 1 ? `Enregistrer ${rows.length} positions` : 'Enregistrer mes positions'}
        </button>
      </div>
    </form>
  );
}
