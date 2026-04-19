'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
  locale: string;
  marketing_opt_in: boolean;
};

export function ProfileForm({ initial }: { initial: Profile }) {
  const [fullName, setFullName] = useState(initial.full_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? '');
  const [marketing, setMarketing] = useState(initial.marketing_opt_in);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      full_name: fullName || null,
      avatar_url: avatarUrl || null,
      marketing_opt_in: marketing,
    }).eq('id', user.id);
    setSaving(false);
    setMessage(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Profil mis à jour' });
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">Nom complet</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jean Dupont"
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">URL avatar</label>
        <input
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
        />
      </div>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
        />
        <span>J&apos;accepte de recevoir des emails sur les nouveautés produit</span>
      </label>
      {message && (
        <p className={`text-sm ${message.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg flex items-center gap-2"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Enregistrer
      </button>
    </form>
  );
}
