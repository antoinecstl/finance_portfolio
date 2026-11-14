import { NextResponse } from 'next/server';
import { enforceAuthenticatedJsonMutation } from '@/lib/api-security';
import { createClient } from '@/lib/supabase/server';
import { deleteAccountSchema, formatZodError, updateAccountSchema } from '@/lib/schemas';
import { accountSupportsPositions, canChangeAccountType } from '@/lib/utils';
import type { IdRouteContext } from '@/lib/route-types';

export async function PATCH(request: Request, { params }: IdRouteContext) {
  const securityError = enforceAuthenticatedJsonMutation(request);
  if (securityError) return securityError;

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  const { data: account, error: accError } = await supabase
    .from('accounts')
    .select('id, type, supports_positions')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (accError) {
    console.error('[api/accounts/:id] PATCH fetch failed', accError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!canChangeAccountType(account.type, body.type)) {
    return NextResponse.json(
      {
        error: 'crypto_type_change_forbidden',
        message: 'Un compte Crypto ne peut pas être transformé en compte classique, et inversement.',
      },
      { status: 400 }
    );
  }

  const nextSupportsPositions = accountSupportsPositions({
    type: body.type,
    supports_positions: body.type === 'AUTRE' ? body.supports_positions ?? null : null,
  });

  if (!nextSupportsPositions) {
    const { count: txCount, error: txError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', id)
      .eq('user_id', user.id)
      .in('type', ['BUY', 'SELL', 'DIVIDEND']);

    if (txError) {
      console.error('[api/accounts/:id] PATCH position activity check failed', txError);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    if ((txCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error: 'account_has_positions',
          message: 'Ce compte contient déjà une activité titres.',
        },
        { status: 409 }
      );
    }
  }

  if (body.opened_on) {
    const tomorrow = new Date(Date.now() + 14 * 3_600_000).toISOString().slice(0, 10); // tolère tous les fuseaux
    if (body.opened_on > tomorrow || body.opened_on < '1970-01-01') {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'La date d’ouverture doit être une date passée.' },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from('accounts')
    .update({
      name: body.name,
      type: body.type,
      supports_positions: body.type === 'AUTRE' ? body.supports_positions ?? null : null,
      // Envoyée seulement si la requête la porte : la modification du nom ou
      // du type ne touche pas à la date d'ouverture.
      ...(body.opened_on !== undefined ? { opened_on: body.opened_on } : {}),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    const message = error.message ?? '';
    if (message.includes('account_has_positions')) {
      return NextResponse.json(
        {
          error: 'account_has_positions',
          message: 'Ce compte contient déjà des positions ou transactions boursières.',
        },
        { status: 409 }
      );
    }
    console.error('[api/accounts/:id] update failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}

export async function DELETE(request: Request, { params }: IdRouteContext) {
  const securityError = enforceAuthenticatedJsonMutation(request);
  if (securityError) return securityError;

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: account, error: accError } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (accError) {
    console.error('[api/accounts/:id] fetch failed', accError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Confirmation by name retyped in body — guardrail against accidental deletion
  // of an account with attached transactions/positions (all cascade on FK).
  const raw = await request.json().catch(() => ({}));
  const parsed = deleteAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  if (parsed.data.confirmName !== account.name) {
    return NextResponse.json(
      { error: 'confirm_mismatch', reason: 'Le nom saisi ne correspond pas au compte.' },
      { status: 400 }
    );
  }

  const { error: delError } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (delError) {
    console.error('[api/accounts/:id] delete failed', delError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
