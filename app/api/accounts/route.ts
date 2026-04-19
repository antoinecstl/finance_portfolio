import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLimits } from '@/lib/subscription';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || typeof body.type !== 'string') {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const limits = await getLimits(user.id);

  if (Number.isFinite(limits.maxAccounts)) {
    const { count, error: countError } = await supabase
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) >= limits.maxAccounts) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'accounts',
          limit: limits.maxAccounts,
          message: `Votre plan Free est limité à ${limits.maxAccounts} compte. Passez Pro pour en ajouter plus.`,
        },
        { status: 402 }
      );
    }
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: user.id,
      name: body.name,
      type: body.type,
      currency: body.currency ?? 'EUR',
    })
    .select()
    .single();

  if (error) {
    if (error.message?.includes('FREE_TIER_LIMIT')) {
      return NextResponse.json(
        { error: 'limit_reached', scope: 'accounts', message: error.message },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data }, { status: 201 });
}
