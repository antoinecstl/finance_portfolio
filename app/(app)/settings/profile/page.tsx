import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from './ProfileForm';

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
    <>
      <h2 className="text-lg font-semibold mb-1">Profil</h2>
      <p className="text-sm text-zinc-500 mb-6">Votre email : {user!.email}</p>
      <ProfileForm initial={profile ?? { full_name: null, avatar_url: null, locale: 'fr', marketing_opt_in: false }} />
    </>
  );
}
