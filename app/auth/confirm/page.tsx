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
    <div className="ink-card rounded-2xl pop-shadow p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-full bg-[color:var(--accent-soft)] p-2">
          <ShieldCheck className="h-5 w-5 text-[color:var(--accent)]" />
        </div>
        <div>
          <h1 className="display text-2xl leading-tight text-[color:var(--ink)]">{meta.title}</h1>
          <p className="text-sm text-[color:var(--ink-soft)] mt-1">
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
            className="btn-ink w-full py-2.5 rounded-lg"
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
