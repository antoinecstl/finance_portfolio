// Désabonnement du récapitulatif mensuel depuis le lien de l'e-mail.
// GET : lien cliqué (page de confirmation). POST : désabonnement en un clic
// déclenché par la messagerie (en-tête List-Unsubscribe-Post).
// Aucune session : le jeton signé du lien identifie le destinataire.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyDigestToken } from '@/lib/digest-token';
import { clientKey, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(title: string, message: string, status: number): NextResponse {
  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Fi-Hub</title></head>
<body style="margin:0;background:#f7f2e8;color:#0e0c0a;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <main style="max-width:480px;margin:0 auto;padding:64px 20px">
    <p style="font-size:20px;font-weight:600;margin:0 0 32px">Fi-Hub</p>
    <h1 style="font-size:24px;margin:0 0 12px">${title}</h1>
    <p style="line-height:1.6;color:#5b524a;margin:0 0 24px">${message}</p>
    <a href="/settings/profile" style="color:#0e0c0a">Gérer mes e-mails dans Paramètres</a>
  </main>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function unsubscribe(request: NextRequest): Promise<{ ok: boolean; status: number }> {
  const rl = rateLimit(`digest-unsubscribe:${clientKey(request)}`, 20, 60_000);
  if (!rl.ok) return { ok: false, status: 429 };

  const userId = request.nextUrl.searchParams.get('u') ?? '';
  const token = request.nextUrl.searchParams.get('t') ?? '';
  if (!UUID.test(userId) || !token || !verifyDigestToken(userId, token)) return { ok: false, status: 400 };

  const db = await createAdminClient();
  const { error } = await db.from('profiles').update({ monthly_digest: false }).eq('id', userId);
  if (error) {
    console.error('[digest/unsubscribe] update failed', error);
    return { ok: false, status: 500 };
  }
  return { ok: true, status: 200 };
}

export async function GET(request: NextRequest) {
  const result = await unsubscribe(request);
  if (result.ok) {
    return page(
      'Récapitulatif désactivé',
      'Vous ne recevrez plus le récapitulatif mensuel de votre patrimoine. Vous pouvez le réactiver à tout moment.',
      200
    );
  }
  return page(
    'Lien invalide',
    result.status === 429
      ? 'Trop de tentatives. Réessayez dans une minute.'
      : 'Ce lien de désabonnement n’est plus valide. Connectez-vous pour gérer vos e-mails.',
    result.status
  );
}

export async function POST(request: NextRequest) {
  const result = await unsubscribe(request);
  return NextResponse.json(result.ok ? { ok: true } : { error: 'invalid_link' }, { status: result.status });
}
