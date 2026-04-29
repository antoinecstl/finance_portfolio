import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeInternalRedirect } from '@/lib/redirects';

const VALID_OTP_TYPES: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

async function handle(params: {
  origin: string;
  code: string | null;
  tokenHash: string | null;
  rawType: string | null;
  next: string;
  redirectStatus?: 303 | 307;
}) {
  const supabase = await createClient();
  const redirectStatus = params.redirectStatus ?? 307;

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (!error) {
      return NextResponse.redirect(`${params.origin}${params.next}`, redirectStatus);
    }
  } else if (
    params.tokenHash &&
    params.rawType &&
    VALID_OTP_TYPES.includes(params.rawType as EmailOtpType)
  ) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.tokenHash,
      type: params.rawType as EmailOtpType,
    });
    if (!error) {
      return NextResponse.redirect(`${params.origin}${params.next}`, redirectStatus);
    }
  }

  return NextResponse.redirect(`${params.origin}/login?error=auth_callback_failed`, redirectStatus);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  return handle({
    origin,
    code: searchParams.get('code'),
    tokenHash: searchParams.get('token_hash'),
    rawType: searchParams.get('type'),
    next: safeInternalRedirect(searchParams.get('next')),
  });
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const formData = await request.formData();
  return handle({
    origin,
    code: (formData.get('code') as string | null) ?? null,
    tokenHash: (formData.get('token_hash') as string | null) ?? null,
    rawType: (formData.get('type') as string | null) ?? null,
    next: safeInternalRedirect(formData.get('next') as string | null),
    redirectStatus: 303,
  });
}
