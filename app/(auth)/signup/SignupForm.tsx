'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { freePlanSummary } from '@/components/marketing/product-facts';
import Link from 'next/link';

export function SignupForm() {
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
      <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-[color:var(--text)]">
        Créer un compte
      </h1>
      <p className="mt-2 text-[15px] text-[color:var(--text-muted)]">{freePlanSummary()}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-[color:var(--text)]">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            required
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-[color:var(--text)]">
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-describedby="signup-password-help"
              className="field-input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            >
              {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
          <p id="signup-password-help" className="mt-1.5 text-[13px] text-[color:var(--text-muted)]">
            8 caractères minimum.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="signup-terms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0"
            required
          />
          <label htmlFor="signup-terms" className="text-sm leading-relaxed text-[color:var(--text-2)]">
            J&apos;accepte les{' '}
            <Link href="/legal/cgu" className="link">
              CGU
            </Link>{' '}
            et la{' '}
            <Link href="/legal/confidentialite" className="link">
              politique de confidentialité
            </Link>
            .
          </label>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-[color:var(--danger)] bg-[color:var(--loss-soft)] p-3 text-sm text-[color:var(--danger)]"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            role="status"
            className="rounded-md border border-[color:var(--gain)] bg-[color:var(--gain-soft)] p-3 text-sm text-[color:var(--gain)]"
          >
            {success}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Création du compte en cours</span>
            </>
          ) : (
            'Créer mon compte'
          )}
        </button>
      </form>

      <p className="mt-8 border-t border-[color:var(--border)] pt-6 text-[15px] text-[color:var(--text-2)]">
        Déjà un compte ?{' '}
        <Link href="/login" className="link font-medium">
          Se connecter
        </Link>
      </p>
    </>
  );
}
