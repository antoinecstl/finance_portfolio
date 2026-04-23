'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

type PdfPeriod = 'month' | 'quarter' | 'year' | 'all';

export function DangerZone() {
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState<PdfPeriod | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) throw new Error('Export échoué');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fi-hub-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur export');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async (period: PdfPeriod) => {
    setExportingPdf(period);
    setError(null);
    try {
      const res = await fetch(`/api/account/export/pdf?period=${period}`);
      if (!res.ok) throw new Error('Export PDF échoué');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fi-hub-rapport-${period}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur export PDF');
    } finally {
      setExportingPdf(null);
    }
  };

  const handleDelete = async () => {
    if (confirmText !== 'SUPPRIMER') {
      setError('Tapez SUPPRIMER pour confirmer.');
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Suppression échouée' }));
        throw new Error(body.error ?? 'Suppression échouée');
      }
      await supabase.auth.signOut();
      router.push('/');
      router.refresh();
    } catch (e) {
      setDeleting(false);
      setError(e instanceof Error ? e.message : 'Erreur suppression');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Exporter mes données</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Téléchargez l&apos;intégralité de vos données (profil, comptes, transactions,
              positions) au format JSON, conformément au RGPD.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 py-2 px-4 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-sm font-medium transition flex-shrink-0"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Télécharger l&apos;export JSON
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
        <div className="min-w-0 mb-4">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Rapport patrimonial (PDF)</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Générez un rapport PDF synthétique avec votre patrimoine, la liste des comptes,
            vos positions actuelles et l&apos;activité sur la période choisie.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'month', label: 'Mois' },
            { key: 'quarter', label: 'Trimestre' },
            { key: 'year', label: 'Année' },
            { key: 'all', label: 'Depuis le début' },
          ] as Array<{ key: PdfPeriod; label: string }>).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleExportPdf(key)}
              disabled={exportingPdf !== null}
              className="inline-flex items-center gap-2 py-2 px-3 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 rounded-lg text-sm font-medium transition"
            >
              {exportingPdf === key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-red-700 dark:text-red-400">Supprimer mon compte</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Action <strong>irréversible</strong>. Toutes vos données (comptes, transactions,
              positions) seront définitivement supprimées.
            </p>
          </div>
        </div>
        <div className="space-y-3 max-w-md">
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Tapez SUPPRIMER pour confirmer"
            className="w-full px-3 py-2.5 border border-red-300 dark:border-red-900/50 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== 'SUPPRIMER'}
            className="inline-flex items-center gap-2 py-2.5 px-5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Supprimer définitivement
          </button>
        </div>
      </section>
    </div>
  );
}
