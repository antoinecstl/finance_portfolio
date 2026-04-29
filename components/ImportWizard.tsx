'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileText, ClipboardPaste, Loader2, CheckCircle2, AlertTriangle, Trash2, Info } from 'lucide-react';
import { useAccounts } from '@/lib/hooks';
import type { ProposedTransaction, ImportNote } from '@/lib/import/types';
import type { TransactionType } from '@/lib/types';
import { accountSupportsPositions } from '@/lib/utils';

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

// Le wizard tient en local (pas de persist Zustand/Redux) : la state vit le temps
// de la session UI. Recharger la page = repartir de zéro, c'est volontaire.
export function ImportWizard() {
  const { accounts, loading: accountsLoading } = useAccounts();
  const [step, setStep] = useState<Step>('upload');
  const [accountId, setAccountId] = useState('');
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

  // Compte sélectionné par défaut : le premier compte trouvé.
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );
  const accountAcceptsPositions = selectedAccount ? accountSupportsPositions(selectedAccount) : false;

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
      setRows(data.transactions ?? []);
      setNotes(data.notes ?? []);
      setStep('preview');
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

  // Validation locale rapide pour griser le bouton commit s'il y a des lignes invalides.
  const invalidRows = useMemo(() => {
    const errors: number[] = [];
    rows.forEach((r, i) => {
      if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) errors.push(i);
      else if (!Number.isFinite(r.amount) || r.amount <= 0) errors.push(i);
      else if ((r.type === 'BUY' || r.type === 'SELL') && (!r.stock_symbol || !r.quantity || !r.price_per_unit)) errors.push(i);
      else if (r.type === 'DIVIDEND' && !r.stock_symbol) errors.push(i);
    });
    return errors;
  }, [rows]);

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
        setError(data.message ?? 'Plan limite atteinte.');
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
                      return (
                        <tr key={idx} className={`border-t border-zinc-100 dark:border-zinc-800 ${invalid ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                          <td className="px-2 py-1.5">
                            <input
                              type="date"
                              value={r.date}
                              onChange={(e) => updateRow(idx, { date: e.target.value })}
                              className="w-32 px-1.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
                            />
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
                            <input
                              type="text"
                              value={r.stock_symbol ?? ''}
                              onChange={(e) => updateRow(idx, { stock_symbol: e.target.value.toUpperCase() || null })}
                              disabled={!isStock && !isDividend}
                              placeholder={isStock || isDividend ? 'AAPL' : '—'}
                              className="w-24 px-1.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 disabled:opacity-40"
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
