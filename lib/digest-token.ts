import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Jeton du lien de désabonnement du récapitulatif mensuel : il prouve que le
// lien vient bien d'un e-mail envoyé à cet utilisateur, sans session.
// Il ne donne aucun autre droit que de couper cet e-mail.

function secret(): string | null {
  return process.env.DIGEST_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function signDigestToken(userId: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac('sha256', key).update(`digest-unsubscribe:${userId}`).digest('base64url');
}

export function verifyDigestToken(userId: string, token: string): boolean {
  const expected = signDigestToken(userId);
  if (!expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
