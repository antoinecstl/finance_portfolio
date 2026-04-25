import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [profile, accounts, transactions, positions] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('transactions').select('*').eq('user_id', user.id),
    supabase.from('stock_positions').select('*').eq('user_id', user.id),
  ]);

  const failed = [profile, accounts, transactions, positions].find((res) => res.error);
  if (failed?.error) {
    console.error('[api/account/export] fetch failed', failed.error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    accounts: accounts.data ?? [],
    transactions: transactions.data ?? [],
    stock_positions: positions.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="fi-hub-export-${user.id}.json"`,
    },
  });
}
