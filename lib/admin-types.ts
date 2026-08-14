// Types partagés entre le code serveur (lib/admin-stats.ts) et les composants
// client (components/admin/*). Aucun import server-only ici.

export type AdminPlanTag = 'free' | 'pro' | 'founder';

export type AdminUserRow = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  plan: AdminPlanTag;
  status: string | null;
  isFounder: boolean;
  accounts: number;
  transactions: number;
};
