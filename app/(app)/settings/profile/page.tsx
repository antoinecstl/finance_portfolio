import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from './ProfileForm';
import { Mail } from 'lucide-react';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, locale, marketing_opt_in')
    .eq('id', user!.id)
    .single();

  return (
    <div>
      <header className="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Profil</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Informations personnelles associées à votre compte.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <Mail className="h-4 w-4 text-zinc-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">Adresse email</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {user!.email}
          </p>
        </div>
      </div>

      <ProfileForm
        initial={
          profile ?? { full_name: null, avatar_url: null, locale: 'fr', marketing_opt_in: false }
        }
      />
    </div>
  );
}
