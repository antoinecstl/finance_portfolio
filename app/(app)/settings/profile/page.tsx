import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from './ProfileForm';
import { Mail } from 'lucide-react';

export const metadata: Metadata = { title: 'Profil' };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // monthly_digest arrive avec la migration 20261114_b : si elle n'est pas
  // encore appliquée, le profil se charge sans ce réglage (il est alors masqué).
  const withDigest = await supabase
    .from('profiles')
    .select('full_name, avatar_url, locale, marketing_opt_in, monthly_digest')
    .eq('id', user!.id)
    .single();
  const profile =
    withDigest.data ??
    (
      await supabase
        .from('profiles')
        .select('full_name, avatar_url, locale, marketing_opt_in')
        .eq('id', user!.id)
        .single()
    ).data;

  return (
    <div>
      <header className="mb-6 pb-6 border-b border-[color:var(--rule)]">
        <h2 className="display text-3xl leading-none text-[color:var(--ink)]">Profil</h2>
        <p className="text-sm text-[color:var(--ink-soft)] mt-2">
          Informations personnelles associées à votre compte.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-3 rounded-lg bg-[color:var(--paper-2)] border border-[color:var(--rule)] px-4 py-3">
        <Mail className="h-4 w-4 text-[color:var(--accent)] flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-[color:var(--ink-soft)]">Adresse email</p>
          <p className="text-sm font-medium text-[color:var(--ink)] truncate">
            {user!.email}
          </p>
        </div>
      </div>

      <ProfileForm
        email={user!.email}
        initial={
          profile ?? { full_name: null, avatar_url: null, locale: 'fr', marketing_opt_in: false }
        }
      />
    </div>
  );
}
