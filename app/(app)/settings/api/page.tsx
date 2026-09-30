import { ApiTokensManager } from './ApiTokensManager';
import { ConnectGuides } from './ConnectGuides';

export default function ApiAccessPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fi-hub.subleet.com';

  return (
    <div>
      <header className="mb-6 pb-6 border-b border-[color:var(--rule)]">
        <h2 className="display text-3xl leading-none text-[color:var(--ink)]">Accès API</h2>
        <p className="text-sm text-[color:var(--ink-soft)] mt-2">
          Connectez ChatGPT, Claude ou vos propres outils à votre patrimoine, en lecture seule.
        </p>
      </header>

      <ApiTokensManager />
      <ConnectGuides appUrl={appUrl} />
    </div>
  );
}
