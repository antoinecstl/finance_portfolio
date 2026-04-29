'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Check, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

const MIN_LENGTH = 8;

type Strength = { score: 0 | 1 | 2 | 3; label: string; color: string };

function scorePassword(pw: string): Strength {
  if (pw.length === 0) return { score: 0, label: '', color: '' };
  let s = 0;
  if (pw.length >= MIN_LENGTH) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 1, label: 'Faible', color: 'bg-red-500' };
  if (s === 2) return { score: 2, label: 'Moyen', color: 'bg-amber-500' };
  return { score: 3, label: 'Fort', color: 'bg-emerald-500' };
}

export function ChangePasswordForm() {
  const [email, setEmail] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const strength = scorePassword(next);
  const mismatch = confirm.length > 0 && next !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!email) {
      setMessage({ type: 'err', text: 'Session introuvable. Reconnectez-vous.' });
      return;
    }
    if (next.length < MIN_LENGTH) {
      setMessage({ type: 'err', text: `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.` });
      return;
    }
    if (next !== confirm) {
      setMessage({ type: 'err', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    if (next === current) {
      setMessage({ type: 'err', text: 'Le nouveau mot de passe doit être différent de l’actuel.' });
      return;
    }

    setLoading(true);

    // Reauthenticate by signing in with the current password. This both
    // verifies the user typed the right one and refreshes the session before
    // the privileged update.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (reauthError) {
      setLoading(false);
      setMessage({ type: 'err', text: 'Mot de passe actuel incorrect.' });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);

    if (error) {
      setMessage({ type: 'err', text: error.message });
      return;
    }

    setMessage({ type: 'ok', text: 'Mot de passe mis à jour. Vos autres sessions seront déconnectées.' });
    setCurrent('');
    setNext('');
    setConfirm('');
    // Best-effort: invalidate sessions on other devices.
    void supabase.auth.signOut({ scope: 'others' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Mot de passe actuel
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type={showCurrent ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full pl-10 pr-12 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            aria-label={showCurrent ? 'Masquer' : 'Afficher'}
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Nouveau mot de passe
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type={showNext ? 'text' : 'password'}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={`${MIN_LENGTH} caractères minimum`}
            autoComplete="new-password"
            required
            className="w-full pl-10 pr-12 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <button
            type="button"
            onClick={() => setShowNext((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            aria-label={showNext ? 'Masquer' : 'Afficher'}
          >
            {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {next.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all ${strength.color}`}
                style={{ width: `${(strength.score / 3) * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 w-12 text-right">{strength.label}</span>
          </div>
        )}
        <p className="text-xs text-zinc-500 mt-1.5">
          Utilisez au moins {MIN_LENGTH} caractères, mélangez lettres, chiffres et symboles.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Confirmer le nouveau mot de passe
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type={showNext ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className={`w-full pl-10 pr-10 py-2.5 border rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:border-transparent transition ${
              mismatch
                ? 'border-red-400 dark:border-red-700 focus:ring-red-500'
                : 'border-zinc-300 dark:border-zinc-700 focus:ring-blue-500'
            }`}
          />
          {confirm.length > 0 && !mismatch && next === confirm && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
          )}
          {mismatch && (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
          )}
        </div>
        {mismatch && <p className="text-xs text-red-600 mt-1.5">Les mots de passe ne correspondent pas.</p>}
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
            message.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400'
          }`}
        >
          {message.type === 'ok' && <Check className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Mettre à jour le mot de passe
      </button>
    </form>
  );
}
