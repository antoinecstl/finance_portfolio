'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export function DangerZone() {
  const [exporting, setExporting] = useState(false);
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

  const handleDelete = async () => {
    if (confirmText !== 'SUPPRIMER') {
      setError('Tape SUPPRIMER pour confirmer');
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
    <div className="space-y-8">
      <section>
        <h3 className="font-medium mb-1">Exporter mes données</h3>
        <p className="text-sm text-zinc-500 mb-3">
          Téléchargez l&apos;intégralité de vos données (profil, comptes, transactions, positions) au format
          JSON.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 py-2 px-4 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-sm font-medium"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Télécharger l&apos;export JSON
        </button>
      </section>

      <section className="pt-6 border-t border-red-200 dark:border-red-900/40">
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-700 dark:text-red-400">Supprimer mon compte</h3>
            <p className="text-sm text-zinc-500">
              Action irréversible. Toutes vos données (comptes, transactions, positions) seront
              définitivement supprimées.
            </p>
          </div>
        </div>
        <div className="space-y-3 max-w-md">
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Tape SUPPRIMER pour confirmer"
            className="w-full px-3 py-2 border border-red-300 dark:border-red-900 rounded-lg bg-white dark:bg-zinc-800"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== 'SUPPRIMER'}
            className="inline-flex items-center gap-2 py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg text-sm font-medium"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Supprimer définitivement
          </button>
        </div>
      </section>
    </div>
  );
}
