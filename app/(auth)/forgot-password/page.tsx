'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="ink-card rounded-2xl pop-shadow p-6">
      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <h1 className="display text-3xl leading-tight text-[color:var(--ink)] mb-2">Mot de passe oublié</h1>
      <p className="text-sm text-[color:var(--ink-soft)] mb-4">
        Entrez votre email, nous vous enverrons un lien pour réinitialiser votre mot de passe.
      </p>

      {sent ? (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Email envoyé. Vérifiez votre boîte de réception.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[color:var(--ink-soft)]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
              className="w-full pl-10 pr-4 py-2.5 border border-[color:var(--rule)] rounded-lg bg-[color:var(--paper)] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)]"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-ink w-full py-2.5 font-medium rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Envoyer le lien'}
          </button>
        </form>
      )}
    </div>
  );
}
