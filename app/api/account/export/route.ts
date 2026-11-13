import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateAllPositionsAtDate } from '@/lib/portfolio-calculator';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [profile, accounts, transactions, watchlist] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('transactions').select('*').eq('user_id', user.id),
    supabase.from('watchlist_items').select('symbol, name, created_at').eq('user_id', user.id),
  ]);

  // Favoris : table récente, l'export ne doit pas échouer si elle n'est pas encore migrée.
  if (watchlist.error) console.warn('[api/account/export] watchlist unavailable', watchlist.error.message);
  const failed = [profile, accounts, transactions].find((res) => res.error);
  if (failed?.error) {
    console.error('[api/account/export] fetch failed', failed.error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const transactionRows = transactions.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const positions = Array.from(calculateAllPositionsAtDate(transactionRows, today).values()).map((position) => ({
    account_id: position.accountId,
    symbol: position.symbol,
    name: position.symbol,
    quantity: position.quantity,
    average_price: position.averagePrice,
    currency: position.currency,
    total_invested: position.totalInvested,
  }));

  const payload = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    accounts: accounts.data ?? [],
    transactions: transactionRows,
    positions,
    watchlist: watchlist.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="fi-hub-export-${user.id}.json"`,
    },
  });
}
