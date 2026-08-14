import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Emails autorisés à accéder au dashboard admin.
// Configurable via ADMIN_EMAILS (liste séparée par des virgules) ; défaut = fondateur.
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? 'antoinecstl@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}

/**
 * Retourne l'utilisateur courant s'il est admin, sinon null.
 * À appeler AVANT toute lecture de données admin (service-role) pour ne rien
 * exposer aux non-admins.
 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
