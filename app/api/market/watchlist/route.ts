// Favoris de l'explorateur de marchés (table watchlist_items, RLS).
// GET : liste de l'utilisateur, du plus ancien au plus récent.
// POST { symbol, name? } : ajoute un favori (sans effet s'il existe déjà).
// DELETE ?symbol=… : retire un favori.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthenticatedJsonMutation, enforceAuthenticatedMutation } from '@/lib/api-security';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { stockLookupSymbolSchema } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/server';

const WATCHLIST_LIMIT = 100;

const addSchema = z.object({
  symbol: stockLookupSymbolSchema,
  name: z.string().trim().max(120).optional().nullable(),
});

async function authenticate(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  const rl = rateLimit(`watchlist:${clientKey(request, user.id)}`, 60, 60_000);
  if (!rl.ok) {
    return {
      error: NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': Math.ceil(rl.resetMs / 1000).toString() } }
      ),
    };
  }
  return { supabase, user };
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if ('error' in auth) return auth.error;
  const { data, error } = await auth.supabase
    .from('watchlist_items')
    .select('symbol, name, created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[api/market/watchlist] list failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [], limit: WATCHLIST_LIMIT });
}

export async function POST(request: NextRequest) {
  const securityError = enforceAuthenticatedJsonMutation(request);
  if (securityError) return securityError;
  const auth = await authenticate(request);
  if ('error' in auth) return auth.error;

  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_symbol' }, { status: 400 });
  const { symbol, name } = parsed.data;

  const { count, error: countError } = await auth.supabase
    .from('watchlist_items')
    .select('symbol', { count: 'exact', head: true })
    .eq('user_id', auth.user.id);
  if (countError) {
    console.error('[api/market/watchlist] count failed', countError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  const limitReached = NextResponse.json(
    { error: 'limit_reached', limit: WATCHLIST_LIMIT, message: `Vous suivez déjà ${WATCHLIST_LIMIT} titres : retirez-en un pour en ajouter un autre.` },
    { status: 409 }
  );
  if ((count ?? 0) >= WATCHLIST_LIMIT) return limitReached;

  const { error } = await auth.supabase
    .from('watchlist_items')
    .insert({ user_id: auth.user.id, symbol, name: name || null });
  // Déjà en favori : rien à faire.
  if (error && error.code !== '23505') {
    if (error.message?.includes('watchlist_limit_reached')) return limitReached;
    console.error('[api/market/watchlist] insert failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, symbol }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const securityError = enforceAuthenticatedMutation(request);
  if (securityError) return securityError;
  const auth = await authenticate(request);
  if ('error' in auth) return auth.error;

  const parsed = stockLookupSymbolSchema.safeParse(request.nextUrl.searchParams.get('symbol') ?? '');
  if (!parsed.success) return NextResponse.json({ error: 'invalid_symbol' }, { status: 400 });
  const { error } = await auth.supabase
    .from('watchlist_items')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('symbol', parsed.data);
  if (error) {
    console.error('[api/market/watchlist] delete failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
