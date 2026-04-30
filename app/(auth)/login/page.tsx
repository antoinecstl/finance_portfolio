'use client';

import { Suspense, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { safeInternalRedirect } from '@/lib/redirects';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
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
      <div className="text-center mb-8">
        <h1 className="display text-4xl leading-none text-[color:var(--ink)]">Fi&#8209;Hub</h1>
        <p className="mono text-[11px] tracking-[0.16em] uppercase text-[color:var(--ink-soft)] mt-3">Connexion</p>
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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-[color:var(--ink)]">Mot de passe</label>
              <Link href="/forgot-password" className="text-xs text-[color:var(--accent)] hover:underline">
                Oublié ?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[color:var(--ink-soft)]" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-ink w-full py-2.5 px-4 font-medium rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/signup" className="text-sm text-[color:var(--accent)] hover:underline font-medium">
            Pas de compte ? S&apos;inscrire
          </Link>
        </div>
      </div>
    </>
  );
}
