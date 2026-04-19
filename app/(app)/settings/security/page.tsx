import { ChangePasswordForm } from './ChangePasswordForm';
import { ShieldCheck } from 'lucide-react';

export default function SecurityPage() {
  return (
    <div>
      <header className="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Sécurité</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Protégez l&apos;accès à votre compte.
        </p>
      </header>

      <div className="mb-6 flex items-start gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Connexion sécurisée
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
            Votre session est chiffrée et vos données sont isolées par utilisateur (RLS Supabase).
          </p>
        </div>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
