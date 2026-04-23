import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLimits } from '@/lib/subscription';
import { createAccountSchema, formatZodError } from '@/lib/schemas';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = createAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  const limits = await getLimits(user.id);

  if (Number.isFinite(limits.maxAccounts)) {
    const { count, error: countError } = await supabase
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('[api/accounts] count failed', countError);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
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
        {
          error: 'limit_reached',
          scope: 'accounts',
          message: 'Limite atteinte pour votre plan.',
        },
        { status: 402 }
      );
    }
    console.error('[api/accounts] insert failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ account: data }, { status: 201 });
}
