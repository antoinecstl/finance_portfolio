import Link from 'next/link';
import { User, CreditCard, Shield, AlertTriangle, ArrowLeft } from 'lucide-react';

const tabs = [
  { href: '/settings/profile', label: 'Profil', icon: User },
  { href: '/settings/billing', label: 'Abonnement', icon: CreditCard },
  { href: '/settings/security', label: 'Sécurité', icon: Shield },
  { href: '/settings/danger', label: 'Zone danger', icon: AlertTriangle },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au dashboard
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Paramètres</h1>
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          <nav className="space-y-1">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
