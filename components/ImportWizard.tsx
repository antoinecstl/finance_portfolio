'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileText, ClipboardPaste, Loader2, CheckCircle2, AlertTriangle, Trash2, Info, Search, Copy } from 'lucide-react';
import { useAccounts, useStockSearch, useTransactions } from '@/lib/hooks';
import type { ProposedTransaction, ImportNote } from '@/lib/import/types';
import type { Transaction, TransactionType } from '@/lib/types';
import { accountSupportsPositions, formatDate } from '@/lib/utils';
import { findDuplicateTransaction } from '@/lib/transaction-duplicates';

type Step = 'upload' | 'preview' | 'done';

const TX_TYPES: Array<{ value: TransactionType; label: string }> = [
  { value: 'DEPOSIT', label: 'Dépôt' },
  { value: 'WITHDRAWAL', label: 'Retrait' },
  { value: 'BUY', label: 'Achat' },
  { value: 'SELL', label: 'Vente' },
  { value: 'DIVIDEND', label: 'Dividende' },
  { value: 'INTEREST', label: 'Intérêts' },
  { value: 'FEE', label: 'Frais' },
];

function buildSymbolSearchHint(description?: string): string {
  if (!description) return '';
  return description
    .replace(/\b(achat|vente|dividende|coupon|frais|courtage|buy|sell|dividend|fee)\b/gi, ' ')
    .replace(/[0-9.,;:()[\]\-_/+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

type TickerStatus = 'valid' | 'invalid' | 'pending' | 'unknown';

function ImportSymbolCell({
  value,
  description,
  disabled,
  status,
  onChange,
}: {
  value: string | null | undefined;
  description?: string;
  disabled: boolean;
  status: TickerStatus;
  onChange: (symbol: string | null) => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const { results, loading, search } = useStockSearch();
  const query = value ?? '';
  const hint = useMemo(() => buildSymbolSearchHint(description), [description]);
  const inputBorder =
    status === 'invalid'
      ? 'border-red-400 dark:border-red-500'
      : 'border-zinc-200 dark:border-zinc-700';

  useEffect(() => {
    if (!showDropdown || disabled) return;

    const searchTerm = query.trim() || hint;
    if (searchTerm.length < 2) return;

    const timer = setTimeout(() => search(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [disabled, hint, query, search, showDropdown]);

  const canShowSuggestions = showDropdown && !disabled && (loading || results.length > 0 || query.trim().length >= 2 || hint.length >= 2);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setShowDropdown(false);
        }
      }}
    >
      <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const next = e.target.value.toUpperCase();
          setShowDropdown(true);
          onChange(next || null);
        }}
        onFocus={() => setShowDropdown(true)}
        disabled={disabled}
        placeholder={disabled ? '-' : 'Symbole ou nom'}
        className={`w-36 pl-6 pr-2 py-1 text-xs border rounded bg-white dark:bg-zinc-800 disabled:opacity-40 ${inputBorder}`}
      />
      {!disabled && status === 'invalid' && (
        <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">
          Ticker introuvable — choisissez-en un dans la liste.
        </p>
      )}
      {!disabled && status === 'pending' && query.trim().length > 0 && (
        <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1">
          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Vérification…
        </p>
      )}

      {canShowSuggestions && (
        <div className="absolute z-30 left-0 top-full mt-1 w-72 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 max-h-56 overflow-y-auto">
          {!query.trim() && hint.length >= 2 && (
            <div className="px-3 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-700">
              Suggestions depuis le libelle
            </div>
          )}

          {loading && (
            <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Recherche...
            </div>
          )}

          {!loading && results.map((result) => (
            <button
              key={`${result.symbol}-${result.exchange}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const next = result.symbol.toUpperCase();
                onChange(next);
                setShowDropdown(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-b border-zinc-100 dark:border-zinc-700 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100">{result.symbol}</span>
                {result.exchange && <span className="text-[10px] text-zinc-400">{result.exchange}</span>}
              </div>
              <div className="text-[11px] text-zinc-500 truncate">{result.name}</div>
            </button>
          ))}

          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              Aucun ticker trouve
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Le wizard tient en local (pas de persist Zustand/Redux) : la state vit le temps
// de la session UI. Recharger la page = repartir de zéro, c'est volontaire.
export function ImportWizard() {
  const { accounts, loading: accountsLoading } = useAccounts();
  const [step, setStep] = useState<Step>('upload');
  const [accountId, setAccountId] = useState('');
  // Transactions existantes du compte cible : alimentent la détection de
  // doublons lors du preview. Filtré côté hook par accountId pour éviter
  // de charger l'historique d'autres comptes.
  const { transactions: existingTxs } = useTransactions(accountId || undefined);
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [rows, setRows] = useState<ProposedTransaction[]>([]);
  const [notes, setNotes] = useState<ImportNote[]>([]);
  const [committedSummary, setCommittedSummary] = useState<{ inserted: number; total: number } | null>(null);
  // Statut de vérification par ticker (uppercase). 'pending' = vérification
  // en cours, 'valid' = résolu via /api/stocks/quotes, 'invalid' = pas de
  // cours retourné. Une ligne BUY/SELL/DIVIDEND avec un ticker non-'valid'
  // est marquée invalide (interdit le commit tant que l'utilisateur n'en a
  // pas sélectionné un dans la liste).
  const [tickerStatus, setTickerStatus] = useState<Map<string, 'valid' | 'invalid' | 'pending'>>(
    new Map()
  );

  // Compte sélectionné par défaut : le premier compte trouvé.
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );
  const accountAcceptsPositions = selectedAccount ? accountSupportsPositions(selectedAccount) : false;

  // Vérifie un lot de tickers contre Yahoo via /api/stocks/quotes.
  // Marque comme 'pending' immédiatement, puis 'valid'/'invalid' selon réponse.
  const verifyTickers = useCallback(async (symbols: string[]) => {
    const cleaned = Array.from(
      new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))
    );
    if (cleaned.length === 0) return;

    setTickerStatus((prev) => {
      const next = new Map(prev);
      for (const s of cleaned) {
        if (next.get(s) !== 'valid') next.set(s, 'pending');
      }
      return next;
    });

    try {
      const res = await fetch(`/api/stocks/quotes?symbols=${cleaned.map(encodeURIComponent).join(',')}`);
      if (!res.ok) {
        // Sur erreur réseau / serveur, on ne bloque pas l'utilisateur :
        // on enlève le 'pending' (les tickers redeviennent inconnus).
        setTickerStatus((prev) => {
          const next = new Map(prev);
          for (const s of cleaned) {
            if (next.get(s) === 'pending') next.delete(s);
          }
          return next;
        });
        return;
      }
      const data = await res.json();
      const returned = new Set<string>(
        ((data.quotes ?? []) as Array<{ symbol: string }>).map((q) => q.symbol.toUpperCase())
      );
      setTickerStatus((prev) => {
        const next = new Map(prev);
        for (const s of cleaned) {
          next.set(s, returned.has(s) ? 'valid' : 'invalid');
        }
        return next;
      });
    } catch {
      setTickerStatus((prev) => {
        const next = new Map(prev);
        for (const s of cleaned) {
          if (next.get(s) === 'pending') next.delete(s);
        }
        return next;
      });
    }
  }, []);

  // Auto-vérifie tout ticker des rows qui n'a pas encore de statut connu.
  // Debounced pour éviter un appel API à chaque keystroke quand l'utilisateur
  // tape un symbole à la main. Les tickers déjà 'valid'/'invalid'/'pending'
  // ne sont pas re-vérifiés.
  useEffect(() => {
    if (rows.length === 0) return;
    const handle = setTimeout(() => {
      const toVerify: string[] = [];
      for (const r of rows) {
        if (r.type !== 'BUY' && r.type !== 'SELL' && r.type !== 'DIVIDEND') continue;
        if (!r.stock_symbol) continue;
        const sym = r.stock_symbol.toUpperCase();
        if (!tickerStatus.has(sym)) toVerify.push(sym);
      }
      if (toVerify.length > 0) verifyTickers(toVerify);
    }, 400);
    return () => clearTimeout(handle);
  }, [rows, tickerStatus, verifyTickers]);

  async function handleParse() {
    setError(null);
    if (!accountId) {
      setError('Sélectionnez un compte');
      return;
    }
    if (mode === 'file' && !file) {
      setError('Sélectionnez un fichier');
      return;
    }
    if (mode === 'text' && pastedText.trim().length < 20) {
      setError('Collez au moins quelques lignes de transactions');
      return;
    }

    setSubmitting(true);
    try {
      let res: Response;
      if (mode === 'file' && file) {
        const fd = new FormData();
        fd.append('account_id', accountId);
        fd.append('file', file);
        res = await fetch('/api/import/parse', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/import/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: accountId, text: pastedText }),
        });
      }

      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'L\'import de transactions est reserve aux utilisateurs Pro.');
        return;
      }
      if (res.status === 429) {
        setError('Trop d\'imports récents. Réessayez dans une heure.');
        return;
      }
      if (res.status === 413) {
        setError('Fichier trop volumineux (max 10 MB).');
        return;
      }
      if (res.status === 415) {
        setError('Format non supporté. Formats acceptés : CSV, XLSX, PDF, texte collé.');
        return;
      }
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Ce fichier a déjà été importé.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? data.error ?? 'Erreur lors de l\'analyse.');
        return;
      }

      const data = await res.json();
      setJobId(data.import_job_id);
      setDetectedFormat(data.detected_format ?? null);
      const proposed: ProposedTransaction[] = data.transactions ?? [];
      setRows(proposed);
      setNotes(data.notes ?? []);
      setTickerStatus(new Map());
      setStep('preview');
      // Vérification immédiate (sans attendre le debounce de l'effet) des
      // tickers extraits par le LLM pour BUY/SELL/DIVIDEND.
      const extracted = proposed
        .filter((r) => r.type === 'BUY' || r.type === 'SELL' || r.type === 'DIVIDEND')
        .map((r) => r.stock_symbol)
        .filter((s): s is string => Boolean(s));
      if (extracted.length > 0) verifyTickers(extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  }

  function updateRow(idx: number, patch: Partial<ProposedTransaction>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  // Doublons potentiels : pour chaque ligne du preview, on cherche une tx
  // existante du même compte qui correspond (même date, même type, même
  // montant, même ticker, ± précision raisonnable). C'est un AVERTISSEMENT —
  // on ne bloque pas l'import car un utilisateur peut légitimement avoir
  // deux ordres identiques le même jour. Charge à lui de supprimer la ligne.
  const duplicatesByRow = useMemo(() => {
    const map = new Map<number, Transaction>();
    if (!accountId || rows.length === 0 || existingTxs.length === 0) return map;
    rows.forEach((r, i) => {
      if (!r.date || !Number.isFinite(r.amount)) return;
      const dup = findDuplicateTransaction(
        {
          type: r.type,
          date: r.date,
          amount: r.amount,
          stock_symbol: r.stock_symbol ?? null,
          quantity: r.quantity ?? null,
          price_per_unit: r.price_per_unit ?? null,
        },
        existingTxs,
        { accountId }
      );
      if (dup) map.set(i, dup);
    });
    return map;
  }, [rows, existingTxs, accountId]);

  // Validation locale rapide pour griser le bouton commit s'il y a des lignes invalides.
  // Inclut la vérification du ticker contre Yahoo : BUY/SELL/DIVIDEND avec un
  // symbole non 'valid' (inconnu OU vérification en cours) bloque le commit.
  const invalidRows = useMemo(() => {
    const errors: number[] = [];
    rows.forEach((r, i) => {
      if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) errors.push(i);
      else if (!Number.isFinite(r.amount) || r.amount <= 0) errors.push(i);
      else if ((r.type === 'BUY' || r.type === 'SELL') && (!r.stock_symbol || !r.quantity || !r.price_per_unit)) errors.push(i);
      else if (r.type === 'DIVIDEND' && !r.stock_symbol) errors.push(i);
      else if (
        (r.type === 'BUY' || r.type === 'SELL' || r.type === 'DIVIDEND') &&
        r.stock_symbol &&
        tickerStatus.get(r.stock_symbol.toUpperCase()) !== 'valid'
      ) {
        errors.push(i);
      }
    });
    return errors;
  }, [rows, tickerStatus]);

  async function handleCommit() {
    setError(null);
    if (!jobId) return;
    if (invalidRows.length > 0) {
      setError(`${invalidRows.length} ligne(s) invalides. Corrigez ou supprimez avant de continuer.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          import_job_id: jobId,
          account_id: accountId,
          transactions: rows,
        }),
      });
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'L\'import de transactions est reserve aux utilisateurs Pro.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? data.error ?? 'Erreur lors de l\'import.');
        return;
      }
      const data = await res.json();
      setCommittedSummary({ inserted: data.inserted ?? 0, total: data.total ?? rows.length });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au tableau de bord
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Importer des transactions
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          CSV, Excel, PDF de relevé broker, ou texte collé. Une IA extrait les transactions ; vous validez avant import.
        </p>

        {step === 'upload' && (
          <div className="mt-6 sm:mt-8 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Compte de destination
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={accountsLoading || accounts.length === 0}
                className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
              >
                {accounts.length === 0 && <option value="">Aucun compte disponible</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
              {selectedAccount && !accountAcceptsPositions && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 inline-flex items-start gap-1">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Ce compte ne supporte pas les positions : seules les transactions cash (DEPOSIT, WITHDRAWAL, INTEREST, FEE) seront acceptées.
                </p>
              )}
            </div>

            <div>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setMode('file')}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    mode === 'file'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Fichier
                </button>
                <button
                  type="button"
                  onClick={() => setMode('text')}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    mode === 'text'
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ClipboardPaste className="h-4 w-4" />
                  Texte collé
                </button>
              </div>

              {mode === 'file' && (
                <label className="flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <Upload className="h-6 w-6 text-zinc-400" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {file ? file.name : 'Cliquez pour sélectionner un fichier'}
                  </span>
                  <span className="text-xs text-zinc-400">CSV, XLSX, PDF — max 10 MB</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              )}

              {mode === 'text' && (
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={10}
                  placeholder="Collez ici un extrait de transactions (relevé email, copier-coller depuis l'app de votre courtier, etc.)"
                  className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={handleParse}
              disabled={submitting || accounts.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {submitting ? 'Analyse en cours…' : 'Analyser'}
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div className="mt-6 sm:mt-8 space-y-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {rows.length} transaction(s) extraite(s)
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Format détecté :{' '}
                    <code className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                      {detectedFormat ?? 'inconnu'}
                    </code>
                  </div>
                  {duplicatesByRow.size > 0 && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <Copy className="h-3.5 w-3.5" />
                      {duplicatesByRow.size} doublon(s) potentiel(s) détecté(s)
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setStep('upload'); setRows([]); setNotes([]); setJobId(null); }}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  Recommencer
                </button>
              </div>
            </div>

            {notes.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-200">
                <div className="font-medium mb-1 inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Remarques de l&apos;analyse
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  {notes.map((n, i) => (
                    <li key={i}>
                      {n.row !== undefined && <span className="font-mono mr-1">[L{n.row}]</span>}
                      {n.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Symbole</th>
                      <th className="px-3 py-2 font-medium text-right">Qté</th>
                      <th className="px-3 py-2 font-medium text-right">Prix</th>
                      <th className="px-3 py-2 font-medium text-right">Montant</th>
                      <th className="px-3 py-2 font-medium text-right">Frais</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const invalid = invalidRows.includes(idx);
                      const isStock = r.type === 'BUY' || r.type === 'SELL';
                      const isDividend = r.type === 'DIVIDEND';
                      const duplicate = duplicatesByRow.get(idx);
                      const rowBg = invalid
                        ? 'bg-red-50/50 dark:bg-red-900/10'
                        : duplicate
                          ? 'bg-amber-50/50 dark:bg-amber-900/10'
                          : '';
                      return (
                        <tr key={idx} className={`border-t border-zinc-100 dark:border-zinc-800 ${rowBg}`}>
                          <td className="px-2 py-1.5 align-top">
                            <input
                              type="date"
                              value={r.date}
                              onChange={(e) => updateRow(idx, { date: e.target.value })}
                              className="w-32 px-1.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
                            />
                            {duplicate && (
                              <p
                                className="mt-1 max-w-[8rem] text-[10px] text-amber-700 dark:text-amber-400 inline-flex items-start gap-1"
                                title={`Existante : ${duplicate.type} ${duplicate.amount}€ le ${formatDate(duplicate.date)}${duplicate.stock_symbol ? ` · ${duplicate.stock_symbol}` : ''}`}
                              >
                                <Copy className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                                Doublon possible
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={r.type}
                              onChange={(e) => updateRow(idx, { type: e.target.value as TransactionType })}
                              className="px-1.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
                            >
                              {TX_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <ImportSymbolCell
                              value={r.stock_symbol ?? ''}
                              disabled={!isStock && !isDividend}
                              description={r.description}
                              status={
                                !r.stock_symbol
                                  ? 'unknown'
                                  : (tickerStatus.get(r.stock_symbol.toUpperCase()) ?? 'pending')
                              }
                              onChange={(symbol) => updateRow(idx, { stock_symbol: symbol })}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              step="0.0001"
                              value={r.quantity ?? ''}
                              onChange={(e) => updateRow(idx, { quantity: e.target.value ? Number(e.target.value) : null })}
                              disabled={!isStock}
                              className="w-20 px-1.5 py-1 text-xs text-right border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 disabled:opacity-40"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={r.price_per_unit ?? ''}
                              onChange={(e) => updateRow(idx, { price_per_unit: e.target.value ? Number(e.target.value) : null })}
                              disabled={!isStock}
                              className="w-20 px-1.5 py-1 text-xs text-right border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 disabled:opacity-40"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={r.amount}
                              onChange={(e) => updateRow(idx, { amount: Number(e.target.value) })}
                              className="w-24 px-1.5 py-1 text-xs text-right border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={r.fees ?? 0}
                              onChange={(e) => updateRow(idx, { fees: Number(e.target.value) })}
                              disabled={r.type === 'FEE'}
                              className="w-20 px-1.5 py-1 text-xs text-right border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 disabled:opacity-40"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={r.description ?? ''}
                              onChange={(e) => updateRow(idx, { description: e.target.value })}
                              className="w-40 px-1.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => removeRow(idx)}
                              aria-label="Supprimer la ligne"
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                          Aucune transaction extraite. Reprenez un autre fichier ou ajustez le contenu.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {invalidRows.length > 0
                  ? `${invalidRows.length} ligne(s) à corriger avant import.`
                  : `${rows.length} transaction(s) prêtes à importer.`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('upload'); setError(null); }}
                  className="px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCommit}
                  disabled={submitting || rows.length === 0 || invalidRows.length > 0}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Importer {rows.length} transaction(s)
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && committedSummary && (
          <div className="mt-8 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Import terminé
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {committedSummary.inserted} transaction(s) ajoutée(s) sur {committedSummary.total}.
            </p>
            <div className="mt-6 flex gap-2 justify-center">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Voir le tableau de bord
              </Link>
              <button
                onClick={() => {
                  setStep('upload');
                  setRows([]); setNotes([]); setFile(null); setPastedText('');
                  setJobId(null); setCommittedSummary(null); setDetectedFormat(null);
                }}
                className="px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Importer un autre fichier
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
