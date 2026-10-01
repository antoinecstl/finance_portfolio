import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/app-shell/PageLayout';
import { Users, UserPlus, Activity, Crown, Wallet, Receipt, Euro, RefreshCw, Target, TrendingUp } from 'lucide-react';
import { getAdminUser } from '@/lib/admin';
import { getAdminStats, type AdminStats } from '@/lib/admin-stats';
import { AdminUsersTable } from '@/components/admin/AdminUsersTable';
import { AdminTicketBoard } from '@/components/admin/AdminTicketBoard';
import { getAdminTickets } from '@/lib/admin-tickets';
import { formatAdminRate } from '@/lib/admin-insights';

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
    <div className="rounded-xl border border-[color:var(--rule)] bg-[color:var(--paper)] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[color:var(--ink-soft)]">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--ink)] tabular-nums sm:text-3xl">{value}</p>
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

  const [stats, tickets] = await Promise.all([getAdminStats(), getAdminTickets()]);

  return (
    <main className="py-5 text-[color:var(--ink)] sm:py-8">
      <PageContainer>
        <PageHeader
          title="Administration"
          description={<>Suivi de l&apos;activité de la plateforme · {admin.email}</>}
          actions={
            <div className="flex items-center gap-3 text-xs text-[color:var(--ink-soft)]">
              <span>Actualisé le {dtf.format(new Date(stats.generatedAt))}</span>
              <Link href="/admin" className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--rule)] px-2.5 py-1.5 hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)]">
                <RefreshCw className="h-3.5 w-3.5" /> Actualiser
              </Link>
            </div>
          }
        />

        <nav aria-label="Sections du dashboard" className="sticky top-[7.25rem] z-20 mb-8 xl:top-4 flex gap-1 overflow-x-auto rounded-xl border border-[color:var(--rule)] bg-[color:var(--paper)]/95 p-1 text-sm shadow-sm backdrop-blur">
          <a href="#overview" className="whitespace-nowrap rounded-lg px-3 py-2 font-medium hover:bg-[color:var(--paper-2)]">Vue d’ensemble</a>
          <a href="#users" className="whitespace-nowrap rounded-lg px-3 py-2 text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)]">Utilisateurs</a>
          <a href="#backlog" className="whitespace-nowrap rounded-lg px-3 py-2 text-[color:var(--ink-soft)] hover:bg-[color:var(--paper-2)] hover:text-[color:var(--ink)]">Tickets</a>
        </nav>

        <section id="overview" className="scroll-mt-20" aria-labelledby="overview-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 id="overview-title" className="text-xl font-semibold tracking-tight">Vue d’ensemble</h2>
              <p className="mt-1 text-sm text-[color:var(--ink-soft)]">Les signaux essentiels de la plateforme.</p>
            </div>
            <span className="hidden text-xs text-[color:var(--ink-soft)] sm:block">Périodes glissantes</span>
          </div>
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
            hint={`${stats.plans.paidPro} abonnement${stats.plans.paidPro !== 1 ? 's' : ''} payant${stats.plans.paidPro !== 1 ? 's' : ''}`}
          />
          </div>

          <div className="mt-4 grid divide-y divide-[color:var(--rule)] rounded-xl border border-[color:var(--rule)] bg-[color:var(--paper)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Insight icon={TrendingUp} label="Conversion Pro" value={formatAdminRate(stats.plans.paidPro, stats.users.total)} hint="abonnements payants" />
            <Insight icon={Target} label="Activation" value={formatAdminRate(stats.content.usersWithTransactions, stats.users.total)} hint={`${nf.format(stats.content.usersWithTransactions)} avec transaction`} />
            <Insight icon={Wallet} label="Portefeuilles créés" value={formatAdminRate(stats.content.usersWithAccounts, stats.users.total)} hint={`${nf.format(stats.content.usersWithAccounts)} avec compte`} />
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
        </section>

        {/* Graphe inscriptions */}
        <section id="users" className="mt-10 scroll-mt-20 border-t border-[color:var(--rule)] pt-8" aria-labelledby="users-title">
          <div className="mb-4">
            <p className="text-xs font-medium text-[color:var(--ink-soft)]">Communauté</p>
            <h2 id="users-title" className="mt-1 text-2xl font-semibold tracking-tight">Utilisateurs</h2>
            <p className="mt-1 text-sm text-[color:var(--ink-soft)]">Recherche, activité et gestion des accès fondateurs.</p>
          </div>
          <SignupsChart data={stats.signupsByDay} />

          <div className="mt-4">
            <AdminUsersTable users={stats.rows} />
          </div>
        </section>

        <div id="backlog" className="scroll-mt-4">
          <AdminTicketBoard initialTickets={tickets} />
        </div>
      </PageContainer>
    </main>
  );
}

function Insight({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint: string }) {
  return <div className="flex items-center gap-3 p-4"><span className="rounded-lg bg-[color:var(--paper-2)] p-2 text-[color:var(--ink-soft)]"><Icon className="h-4 w-4" /></span><div><p className="text-xs text-[color:var(--ink-soft)]">{label}</p><p className="mt-0.5 font-semibold tabular-nums text-[color:var(--ink)]">{value} <span className="text-xs font-normal text-[color:var(--ink-soft)]">· {hint}</span></p></div></div>;
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
