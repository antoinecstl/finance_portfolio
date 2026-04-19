import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendAccountDeletion } from '@/lib/email';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY manquant côté serveur' },
      { status: 500 }
    );
  }

  const email = user.email;
  const admin = await createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    console.error('[api/account/delete] deleteUser failed', error);
    return NextResponse.json({ error: 'deletion_failed' }, { status: 500 });
  }

  if (email) {
    await sendAccountDeletion(email);
  }

  return NextResponse.json({ ok: true });
}
