import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { PLANS } from '@/lib/plans';
import type { AdminUserRow } from '@/lib/admin-types';

export type AdminStats = {
  generatedAt: string;
  users: {
    total: number;
    signupsToday: number;
    signups7d: number;
    signups30d: number;
    active7d: number;
    active30d: number;
  };
  plans: {
    free: number;
    proActive: number;
    founders: number;
    proByStatus: Record<string, number>;
    mrrCents: number;
  };
  content: {
    accounts: number;
    transactions: number;
    accountsByType: { type: string; count: number }[];
  };
  signupsByDay: { date: string; count: number }[];
  rows: AdminUserRow[];
};

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE_PRO_STATUSES = new Set(['active', 'trialing', 'past_due']);

type AuthUserLite = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

/**
 * Agrège l'activité de la plateforme via le client service-role (bypass RLS).
 * Ne doit être appelé qu'après vérification admin (voir lib/admin.ts).
 */
export async function getAdminStats(): Promise<AdminStats> {
  const admin = await createAdminClient();

  // --- Utilisateurs (auth) : email, date d'inscription, dernière connexion ---
  const authUsers: AuthUserLite[] = [];
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;
    for (const u of data.users) {
      authUsers.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < perPage) break;
  }

  // --- Abonnements, fondateurs, contenu (en parallèle) ---
  const [subsRes, foundersRes, accountsRes, txRes] = await Promise.all([
    admin.from('subscriptions').select('user_id, plan_id, status'),
    admin.from('profiles').select('id').eq('is_founder', true),
    admin.from('accounts').select('user_id, type'),
    admin.from('transactions').select('user_id'),
  ]);

  const subByUser = new Map<string, { plan_id: string; status: string }>();
  for (const s of subsRes.data ?? []) {
    subByUser.set(s.user_id, { plan_id: s.plan_id, status: s.status });
  }

  const founderIds = new Set<string>((foundersRes.data ?? []).map((r) => r.id));

  // Comptes : total, répartition par type, et compte par utilisateur.
  const accountsByTypeMap = new Map<string, number>();
  const accountsByUser = new Map<string, number>();
  for (const a of accountsRes.data ?? []) {
    const t: string = a.type ?? 'AUTRE';
    accountsByTypeMap.set(t, (accountsByTypeMap.get(t) ?? 0) + 1);
    accountsByUser.set(a.user_id, (accountsByUser.get(a.user_id) ?? 0) + 1);
  }

  // Transactions : total et compte par utilisateur.
  const txByUser = new Map<string, number>();
  for (const t of txRes.data ?? []) {
    txByUser.set(t.user_id, (txByUser.get(t.user_id) ?? 0) + 1);
  }

  // --- Agrégats & lignes par utilisateur ---
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  let signupsToday = 0;
  let signups7d = 0;
  let signups30d = 0;
  let active7d = 0;
  let active30d = 0;
  let free = 0;
  let proActive = 0;
  const proByStatus: Record<string, number> = {};

  const dayCounts = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    dayCounts.set(new Date(todayMs - i * DAY).toISOString().slice(0, 10), 0);
  }

  const rows: AdminUserRow[] = [];

  for (const u of authUsers) {
    const created = new Date(u.created_at).getTime();
    if (created >= todayMs) signupsToday++;
    if (created >= now - 7 * DAY) signups7d++;
    if (created >= now - 30 * DAY) signups30d++;

    const dayKey = u.created_at.slice(0, 10);
    if (dayCounts.has(dayKey)) dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);

    if (u.last_sign_in_at) {
      const seen = new Date(u.last_sign_in_at).getTime();
      if (seen >= now - 7 * DAY) active7d++;
      if (seen >= now - 30 * DAY) active30d++;
    }

    const sub = subByUser.get(u.id);
    const isFounder = founderIds.has(u.id);
    const proSub = sub?.plan_id === 'pro' && ACTIVE_PRO_STATUSES.has(sub.status);
    const effectivePro = isFounder || proSub;
    if (effectivePro) {
      proActive++;
      const st = isFounder && !proSub ? 'founder' : sub?.status ?? 'active';
      proByStatus[st] = (proByStatus[st] ?? 0) + 1;
    } else {
      free++;
    }

    rows.push({
      id: u.id,
      email: u.email,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      // Plan de base (abonnement), indépendant du statut fondateur : l'UI
      // affiche « founder » quand isFounder, sinon ce plan.
      plan: proSub ? 'pro' : 'free',
      status: sub?.status ?? null,
      isFounder,
      accounts: accountsByUser.get(u.id) ?? 0,
      transactions: txByUser.get(u.id) ?? 0,
    });
  }

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    generatedAt: new Date().toISOString(),
    users: {
      total: authUsers.length,
      signupsToday,
      signups7d,
      signups30d,
      active7d,
      active30d,
    },
    plans: {
      free,
      proActive,
      founders: founderIds.size,
      proByStatus,
      // Estimation : abonnés Pro actifs × prix mensuel (fondateurs et annuel non
      // déduits — MRR indicatif).
      mrrCents: proActive * PLANS.pro.priceCents,
    },
    content: {
      accounts: accountsRes.data?.length ?? 0,
      transactions: txRes.data?.length ?? 0,
      accountsByType: Array.from(accountsByTypeMap.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    },
    signupsByDay: Array.from(dayCounts.entries()).map(([date, count]) => ({ date, count })),
    rows,
  };
}
