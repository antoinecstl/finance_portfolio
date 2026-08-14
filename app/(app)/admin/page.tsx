import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, UserPlus, Activity, Crown, Wallet, Receipt, Euro } from 'lucide-react';
import { getAdminUser } from '@/lib/admin';
import { getAdminStats, type AdminStats } from '@/lib/admin-stats';
import { AdminUsersTable } from '@/components/admin/AdminUsersTable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

const nf = new Intl.NumberFormat('fr-FR');
const dtf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

function eur(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  PEA: 'PEA',
  CTO: 'CTO',
  LIVRET_A: 'Livret A',
  LDDS: 'LDDS',
  ASSURANCE_VIE: 'Assurance-vie',
  PEL: 'PEL',
  AUTRE: 'Autre',
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="ink-card rounded-2xl p-5">
      <div className="flex items-center gap-2 text-[color:var(--ink-soft)]">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-[color:var(--ink)] tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-[color:var(--ink-soft)]">{hint}</p>}
    </div>
  );
}

function SignupsChart({ data }: { data: AdminStats['signupsByDay'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="ink-card rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-[color:var(--ink)]">Inscriptions — 30 derniers jours</h3>
      <div className="mt-4 flex items-end gap-[3px] h-28">
        {data.map((d) => (
          <div
            key={d.date}
            className="flex-1 rounded-t bg-[color:var(--accent)] min-h-[2px] transition-all"
            style={{ height: `${(d.count / max) * 100}%`, opacity: d.count === 0 ? 0.15 : 1 }}
            title={`${new Date(d.date).toLocaleDateString('fr-FR')} — ${d.count} inscription${d.count > 1 ? 's' : ''}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[color:var(--ink-soft)]">
        <span>
          {data[0]
            ? new Date(data[0].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
            : ''}
        </span>
        <span>Aujourd&apos;hui</span>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const stats = await getAdminStats();

  return (
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--accent)] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au dashboard
        </Link>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="display text-4xl leading-none text-[color:var(--ink)]">Admin</h1>
            <p className="text-sm text-[color:var(--ink-soft)] mt-2">
              Suivi de l&apos;activité de la plateforme · {admin.email}
            </p>
          </div>
          <p className="text-xs text-[color:var(--ink-soft)]">
            Généré le {dtf.format(new Date(stats.generatedAt))}
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={Users}
            label="Utilisateurs"
            value={nf.format(stats.users.total)}
            hint={`+${stats.users.signupsToday} aujourd'hui`}
          />
          <StatCard
            icon={UserPlus}
            label="Inscriptions 30j"
            value={nf.format(stats.users.signups30d)}
            hint={`${stats.users.signups7d} sur 7j`}
          />
          <StatCard
            icon={Activity}
            label="Actifs 7j"
            value={nf.format(stats.users.active7d)}
            hint={`${stats.users.active30d} sur 30j`}
          />
          <StatCard
            icon={Euro}
            label="MRR estimé"
            value={eur(stats.plans.mrrCents)}
            hint={`${stats.plans.proActive} abonnés Pro`}
          />
        </div>

        {/* Répartition plans + contenu */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-4">
          <div className="ink-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[color:var(--ink)] flex items-center gap-2">
              <Crown className="h-4 w-4" /> Répartition des plans
            </h3>
            <div className="mt-4 space-y-3">
              <PlanRow label="Free" value={stats.plans.free} total={stats.users.total} tone="free" />
              <PlanRow label="Pro (actifs)" value={stats.plans.proActive} total={stats.users.total} tone="pro" />
              <PlanRow label="Fondateurs" value={stats.plans.founders} total={stats.users.total} tone="founder" />
            </div>
            {Object.keys(stats.plans.proByStatus).length > 0 && (
              <p className="mt-4 text-xs text-[color:var(--ink-soft)]">
                Statuts Pro :{' '}
                {Object.entries(stats.plans.proByStatus)
                  .map(([s, n]) => `${s} (${n})`)
                  .join(' · ')}
              </p>
            )}
          </div>

          <div className="ink-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[color:var(--ink)]">Contenu</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 text-[color:var(--ink-soft)]">
                  <Wallet className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Comptes</span>
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">{nf.format(stats.content.accounts)}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-[color:var(--ink-soft)]">
                  <Receipt className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Transactions</span>
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">{nf.format(stats.content.transactions)}</p>
              </div>
            </div>
            {stats.content.accountsByType.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {stats.content.accountsByType.map((a) => (
                  <span
                    key={a.type}
                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--paper-2)] px-2.5 py-1 text-xs text-[color:var(--ink-soft)]"
                  >
                    {ACCOUNT_TYPE_LABELS[a.type] ?? a.type}
                    <span className="font-semibold text-[color:var(--ink)]">{a.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Graphe inscriptions */}
        <div className="mt-4">
          <SignupsChart data={stats.signupsByDay} />
        </div>

        {/* Utilisateurs — recherche, tri, filtre, drill-down & actions */}
        <div className="mt-4">
          <AdminUsersTable users={stats.rows} />
        </div>
      </div>
    </div>
  );
}

function PlanRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: 'free' | 'pro' | 'founder';
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const bar =
    tone === 'pro'
      ? 'bg-emerald-500'
      : tone === 'founder'
        ? 'bg-[color:var(--accent)]'
        : 'bg-[color:var(--ink-soft)]';
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[color:var(--ink)]">{label}</span>
        <span className="tabular-nums text-[color:var(--ink-soft)]">
          {nf.format(value)} · {pct}%
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-[color:var(--paper-2)] overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
