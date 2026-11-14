// GET /api/cron/monthly-digest — tâche planifiée (vercel.json) : envoie le
// récapitulatif du mois écoulé à ceux qui ne l'ont pas encore reçu.
//
// Protégée par CRON_SECRET : Vercel l'envoie dans `Authorization: Bearer …`
// à chaque exécution planifiée. Sans cette variable, la route refuse tout.
// `?dry=1` calcule sans envoyer ; `?dry=1&html=1` renvoie l'aperçu du premier e-mail.

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runMonthlyDigest } from '@/lib/monthly-digest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const dryRun = params.get('dry') === '1';
  // Date du jour à Paris : le mois « écoulé » suit le calendrier des utilisateurs.
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

  try {
    const result = await runMonthlyDigest({ today, dryRun });
    if (dryRun && params.get('html') === '1') {
      return new NextResponse(result.preview ?? '<p>Aucun récapitulatif à envoyer.</p>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    const { preview: _preview, ...summary } = result;
    void _preview;
    return NextResponse.json({ ok: true, dryRun, ...summary }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[cron/monthly-digest] run failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
