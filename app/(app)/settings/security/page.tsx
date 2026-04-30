import { ChangePasswordForm } from './ChangePasswordForm';
import { ShieldCheck } from 'lucide-react';

export default function SecurityPage() {
  return (
    <div>
      <header className="mb-6 pb-6 border-b border-[color:var(--rule)]">
        <h2 className="display text-3xl leading-none text-[color:var(--ink)]">Sécurité</h2>
        <p className="text-sm text-[color:var(--ink-soft)] mt-2">
          Protégez l&apos;accès à votre compte.
        </p>
      </header>

      <div className="mb-6 flex items-start gap-3 rounded-lg bg-[color:var(--gain-soft)] border border-[color:var(--gain)] px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-[color:var(--gain)] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-[color:var(--ink)]">
            Connexion sécurisée
          </p>
          <p className="text-xs text-[color:var(--ink-soft)] mt-0.5">
            Votre session est chiffrée et vos données sont isolées par utilisateur (RLS Supabase).
          </p>
        </div>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
