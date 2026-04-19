import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLimits } from '@/lib/subscription';

type PositionPayload = {
  account_id: string;
  symbol: string;
  name: string;
  quantity: number;
  average_price: number;
  currency?: string;
  sector?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PositionPayload | null;
  if (!body || !body.account_id || !body.symbol) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const limits = await getLimits(user.id);

  if (Number.isFinite(limits.maxPositions)) {
    const { count, error: countError } = await supabase
      .from('stock_positions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) >= limits.maxPositions) {
      return NextResponse.json(
        {
          error: 'limit_reached',
          scope: 'positions',
          limit: limits.maxPositions,
          message: `Votre plan Free est limité à ${limits.maxPositions} positions boursières. Passez Pro pour en ajouter plus.`,
        },
        { status: 402 }
      );
    }
  }

  const { data, error } = await supabase
    .from('stock_positions')
    .insert({
      user_id: user.id,
      account_id: body.account_id,
      symbol: body.symbol.toUpperCase(),
      name: body.name,
      quantity: body.quantity,
      average_price: body.average_price,
      currency: body.currency ?? 'EUR',
      sector: body.sector ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.message?.includes('FREE_TIER_LIMIT')) {
      return NextResponse.json(
        { error: 'limit_reached', scope: 'positions', message: error.message },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ position: data }, { status: 201 });
}
