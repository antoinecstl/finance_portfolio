import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscription } from '@/lib/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ctx = await getUserSubscription(user.id);
  return NextResponse.json({
    planId: ctx.planId,
    status: ctx.status,
    currentPeriodEnd: ctx.currentPeriodEnd,
    isFounder: ctx.isFounder,
  });
}
