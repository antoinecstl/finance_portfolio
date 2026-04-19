'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export function ChangePasswordForm() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage({ type: 'err', text: 'Le mot de passe doit contenir au moins 8 caractères' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setMessage({ type: 'err', text: error.message });
    else {
      setMessage({ type: 'ok', text: 'Mot de passe mis à jour' });
      setPassword('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 caractères minimum"
          required
          className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
        />
      </div>
      {message && (
        <p className={`text-sm ${message.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg flex items-center gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Mettre à jour
      </button>
    </form>
  );
}
