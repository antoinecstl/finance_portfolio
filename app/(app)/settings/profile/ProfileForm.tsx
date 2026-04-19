'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Check, User as UserIcon } from 'lucide-react';

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
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        avatar_url: avatarUrl || null,
        marketing_opt_in: marketing,
      })
      .eq('id', user.id);
    setSaving(false);
    setMessage(
      error
        ? { type: 'err', text: error.message }
        : { type: 'ok', text: 'Profil mis à jour avec succès' }
    );
  };

  const initials =
    (fullName || 'U')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="w-14 h-14 rounded-full object-cover border border-zinc-200 dark:border-zinc-800"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-semibold text-lg">
            {initials}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {fullName || 'Sans nom'}
          </p>
          <p className="text-xs text-zinc-500">Votre avatar apparaît dans le dashboard.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Nom complet
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full pl-10 pr-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            URL de l&apos;avatar{' '}
            <span className="text-zinc-400 font-normal">(optionnel)</span>
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Emails produit
            </p>
            <p className="text-xs text-zinc-500">
              Recevoir des nouvelles occasionnelles sur les évolutions de Fi-Hub.
            </p>
          </div>
        </label>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
            message.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400'
          }`}
        >
          {message.type === 'ok' && <Check className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </form>
  );
}
