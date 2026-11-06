'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export function DangerZone() {
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
        throw new Error(body.message ?? body.error ?? 'Suppression échouée');
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
      <section className="rounded-lg border border-[color:var(--loss)] bg-[color:var(--loss-soft)] p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[color:var(--paper)] text-[color:var(--loss)] flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-red-700 dark:text-red-400">Supprimer mon compte</h3>
            <p className="text-sm text-[color:var(--ink-soft)] mt-1">
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
            className="w-full px-3 py-2.5 border border-[color:var(--loss)] rounded-lg bg-[color:var(--paper)] text-[color:var(--ink)] focus:ring-2 focus:ring-[color:var(--loss)] focus:border-transparent transition"
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
