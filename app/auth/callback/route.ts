import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWelcome } from '@/lib/email';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user;
      if (user?.email && user.email_confirmed_at) {
        const confirmedAt = new Date(user.email_confirmed_at).getTime();
        if (Date.now() - confirmedAt < 60_000) {
          await sendWelcome(user.email);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
