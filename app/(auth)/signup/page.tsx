'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (!acceptTerms) {
      setError('Vous devez accepter les CGU pour continuer');
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Compte créé ! Vérifiez votre email pour confirmer.');
      }
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-baseline gap-2 text-[color:var(--ink)] hover:opacity-80 transition-opacity">
          <span className="display text-4xl leading-none">Fi&#8209;Hub</span>
        </Link>
        <p className="mono text-[11px] tracking-[0.16em] uppercase text-[color:var(--ink-soft)] mt-3">Créer un compte</p>
      </div>

      <div className="ink-card rounded-2xl pop-shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[color:var(--ink)] mb-1">Email</label>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-[color:var(--ink)] mb-1">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[color:var(--ink-soft)]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                required
                className="w-full pl-10 pr-12 py-2.5 border border-[color:var(--rule)] rounded-lg bg-[color:var(--paper)] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-[color:var(--ink-soft)] cursor-pointer">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 rounded border-[color:var(--rule)]"
              required
            />
            <span>
              J&apos;accepte les{' '}
              <Link href="/legal/cgu" className="text-[color:var(--accent)] hover:underline">
                CGU
              </Link>{' '}
              et la{' '}
              <Link href="/legal/confidentialite" className="text-[color:var(--accent)] hover:underline">
                politique de confidentialité
              </Link>
              .
            </span>
          </label>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-ink w-full py-2.5 px-4 font-medium rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Créer mon compte'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-[color:var(--accent)] hover:underline font-medium">
            Déjà un compte ? Se connecter
          </Link>
        </div>
      </div>
    </>
  );
}
