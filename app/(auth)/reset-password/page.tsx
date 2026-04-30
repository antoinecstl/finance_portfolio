'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Lock, Loader2, Eye, EyeOff, Check, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let recoveryDetected = false;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') recoveryDetected = true;
      setHasSession(Boolean(session));
    });

    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      // Defer the "no session" state briefly so the recovery event from the
      // URL hash has a chance to land before we render the error UI.
      setTimeout(() => setReady(true), 200);
    });

    return () => {
      subscription.subscription.unsubscribe();
      void recoveryDetected;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  if (ready && !hasSession) {
    return (
      <div className="ink-card rounded-2xl pop-shadow p-6">
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 px-4 py-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Lien expiré ou invalide
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Ce lien de réinitialisation n&apos;est plus valide. Demandez-en un nouveau.
            </p>
          </div>
        </div>
        <Link
          href="/forgot-password"
          className="btn-ink inline-block w-full text-center py-2.5 font-medium rounded-lg"
        >
          Renvoyer un lien
        </Link>
      </div>
    );
  }

  return (
    <div className="ink-card rounded-2xl pop-shadow p-6">
      <h1 className="display text-3xl leading-tight text-[color:var(--ink)] mb-2">Nouveau mot de passe</h1>
      <p className="text-sm text-[color:var(--ink-soft)] mb-4">
        Choisissez un nouveau mot de passe pour votre compte.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[color:var(--ink-soft)]" />
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
            autoComplete="new-password"
            required
            className="w-full pl-10 pr-12 py-2.5 border border-[color:var(--rule)] rounded-lg bg-[color:var(--paper)] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)]"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
            aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[color:var(--ink-soft)]" />
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmer le mot de passe"
            autoComplete="new-password"
            required
            className="w-full pl-10 pr-4 py-2.5 border border-[color:var(--rule)] rounded-lg bg-[color:var(--paper)] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)]"
          />
          {confirm.length > 0 && password === confirm && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !ready}
          className="btn-ink w-full py-2.5 font-medium rounded-lg flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Mettre à jour'}
        </button>
      </form>
    </div>
  );
}
