import { ShieldCheck } from 'lucide-react';

type Search = Record<string, string | string[] | undefined>;

const TYPE_LABELS: Record<string, { title: string; cta: string }> = {
  recovery: { title: 'Réinitialisation du mot de passe', cta: 'Réinitialiser mon mot de passe' },
  magiclink: { title: 'Connexion par lien magique', cta: 'Me connecter' },
  signup: { title: 'Confirmation d’inscription', cta: 'Confirmer mon compte' },
  invite: { title: 'Invitation', cta: 'Accepter l’invitation' },
  email_change: { title: 'Confirmation de changement d’email', cta: 'Confirmer le changement' },
  email: { title: 'Confirmation', cta: 'Confirmer' },
};

function pick(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const tokenHash = pick(params.token_hash);
  const type = pick(params.type);
  const next = pick(params.next);

  const meta = TYPE_LABELS[type] ?? TYPE_LABELS.email;
  const valid = Boolean(tokenHash && type);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-full bg-blue-50 dark:bg-blue-950/30 p-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{meta.title}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Pour des raisons de sécurité, cliquez sur le bouton ci-dessous pour valider l&apos;action.
          </p>
        </div>
      </div>

      {valid ? (
        <form method="POST" action="/auth/callback">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          {next && <input type="hidden" name="next" value={next} />}
          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          >
            {meta.cta}
          </button>
        </form>
      ) : (
        <p className="text-sm text-red-600">Lien invalide ou incomplet.</p>
      )}
    </div>
  );
}
