'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { safeInternalRedirect } from '@/lib/redirects';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeInternalRedirect(searchParams.get('next'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError('Email ou mot de passe incorrect');
      } else {
        router.push(next);
        router.refresh();
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
        Se connecter
      </h1>
      <p className="mt-2 text-[15px] text-[color:var(--text-muted)]">Accédez à votre suivi Fi-Hub.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-[color:var(--text)]">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            className="field-input"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <label htmlFor="login-password" className="block text-sm font-medium text-[color:var(--text)]">
              Mot de passe
            </label>
            <Link href="/forgot-password" className="link text-sm">
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
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
        </div>

        {error && (
          <p
            id="login-error"
            role="alert"
            className="rounded-md border border-[color:var(--danger)] bg-[color:var(--loss-soft)] p-3 text-sm text-[color:var(--danger)]"
          >
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span className="sr-only">Connexion en cours</span>
            </>
          ) : (
            'Se connecter'
          )}
        </button>
      </form>

      <p className="mt-8 border-t border-[color:var(--border)] pt-6 text-[15px] text-[color:var(--text-2)]">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="link font-medium">
          Créer un compte gratuit
        </Link>
      </p>
    </>
  );
}
