import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceAuthenticatedJsonMutation } from '@/lib/api-security';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { formatZodError } from '@/lib/schemas';
import { generateApiToken, MAX_ACTIVE_TOKENS_PER_USER } from '@/lib/public-api/tokens';

const TOKEN_COLUMNS = 'id, name, token_prefix, scopes, created_at, last_used_at, expires_at, revoked_at';

const createTokenSchema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(60, '60 caractères maximum'),
  // Durée de validité en jours ; null = sans expiration.
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]).default(90),
});

// GET /api/api-tokens : jetons de l'utilisateur connecté (sans secret).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('api_tokens')
    .select(TOKEN_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/api-tokens] list failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

// POST /api/api-tokens : crée un jeton. Le secret n'est renvoyé qu'ici, une seule fois.
export async function POST(request: Request) {
  const securityError = enforceAuthenticatedJsonMutation(request);
  if (securityError) return securityError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = createTokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }

  const db = await createAdminClient();
  const nowIso = new Date().toISOString();
  const { count, error: countError } = await db
    .from('api_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (countError) {
    console.error('[api/api-tokens] count failed', countError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS_PER_USER) {
    return NextResponse.json(
      {
        error: 'limit_reached',
        message: `Vous avez déjà ${MAX_ACTIVE_TOKENS_PER_USER} jetons actifs. Révoquez-en un pour en créer un nouveau.`,
      },
      { status: 409 }
    );
  }

  const { token, tokenHash, tokenPrefix } = generateApiToken();
  const { expiresInDays } = parsed.data;
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
    : null;

  const { data, error } = await db
    .from('api_tokens')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      token_prefix: tokenPrefix,
      token_hash: tokenHash,
      scopes: ['read'],
      expires_at: expiresAt,
    })
    .select(TOKEN_COLUMNS)
    .single();

  if (error) {
    console.error('[api/api-tokens] insert failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ item: data, token }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
