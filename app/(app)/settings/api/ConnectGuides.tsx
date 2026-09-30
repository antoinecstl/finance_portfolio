'use client';

import { useState } from 'react';
import { CopyButton } from './ApiTokensManager';

type GuideId = 'chatgpt' | 'claude' | 'api';

function Snippet({ value }: { value: string }) {
  return (
    <div className="mt-2 flex items-start gap-2">
      <pre className="mono min-w-0 flex-1 overflow-x-auto rounded-lg bg-[color:var(--paper-2)] px-3 py-2 text-xs text-[color:var(--ink)]">
        {value}
      </pre>
      <CopyButton value={value} />
    </div>
  );
}

export function ConnectGuides({ appUrl }: { appUrl: string }) {
  const [guide, setGuide] = useState<GuideId>('chatgpt');
  const openApiUrl = `${appUrl}/api/v1/openapi.json`;
  const mcpUrl = `${appUrl}/api/mcp`;

  const claudeCode = `claude mcp add --transport http fi-hub ${mcpUrl}`;
  const claudeCodeToken = `claude mcp add --transport http fi-hub ${mcpUrl} \\\n  --header "Authorization: Bearer VOTRE_JETON"`;
  const curl = `curl -H "Authorization: Bearer VOTRE_JETON" \\\n  ${appUrl}/api/v1/portfolio`;

  const tabs: Array<{ id: GuideId; label: string }> = [
    { id: 'chatgpt', label: 'ChatGPT' },
    { id: 'claude', label: 'Claude' },
    { id: 'api', label: 'API REST' },
  ];

  return (
    <section className="mt-10 border-t border-[color:var(--rule)] pt-8">
      <h3 className="text-base font-semibold text-[color:var(--ink)]">Connecter un assistant</h3>
      <div role="tablist" aria-label="Guides de connexion" className="mt-3 inline-flex rounded-lg bg-[color:var(--paper-2)] p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={guide === tab.id}
            onClick={() => setGuide(tab.id)}
            className={`rounded-md px-3 py-1.5 text-xs sm:text-sm transition-colors ${
              guide === tab.id
                ? 'bg-[color:var(--ink)] text-[color:var(--paper)]'
                : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-4 space-y-4 text-sm text-[color:var(--ink-soft)]">
        {guide === 'chatgpt' && (
          <div className="space-y-5">
            <div>
              <p className="font-medium text-[color:var(--ink)]">Connecteur (recommandé)</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5">
                <li>
                  Dans les paramètres de ChatGPT, section connecteurs (mode développeur), créez un connecteur avec
                  l&apos;URL :
                  <Snippet value={mcpUrl} />
                </li>
                <li>Authentification : <strong className="text-[color:var(--ink)]">OAuth</strong>. Connectez-vous à Fi-Hub et autorisez l&apos;accès.</li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-[color:var(--ink)]">GPT personnalisé (Actions)</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5">
                <li>
                  Créez un GPT, onglet <strong className="text-[color:var(--ink)]">Configurer</strong> →{' '}
                  <strong className="text-[color:var(--ink)]">Créer une action</strong> → Importer depuis une URL :
                  <Snippet value={openApiUrl} />
                </li>
                <li>
                  Authentification : <strong className="text-[color:var(--ink)]">Clé API</strong>, type Bearer, avec un jeton créé
                  ci-dessus.
                </li>
                <li>
                  Politique de confidentialité : <span className="mono text-xs">{appUrl}/legal/confidentialite</span>. Gardez le GPT
                  privé.
                </li>
              </ol>
            </div>
          </div>
        )}

        {guide === 'claude' && (
          <div className="space-y-5">
            <div>
              <p className="font-medium text-[color:var(--ink)]">Claude (web, bureau, mobile)</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5">
                <li>
                  Paramètres → <strong className="text-[color:var(--ink)]">Connecteurs</strong> →{' '}
                  <strong className="text-[color:var(--ink)]">Ajouter un connecteur personnalisé</strong>, avec l&apos;URL :
                  <Snippet value={mcpUrl} />
                </li>
                <li>Cliquez sur Se connecter, identifiez-vous sur Fi-Hub et autorisez l&apos;accès. Aucun jeton à copier.</li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-[color:var(--ink)]">Claude Code</p>
              <Snippet value={claudeCode} />
              <p className="mt-1 text-xs">Puis lancez /mcp dans Claude Code pour vous connecter. Ou, avec un jeton :</p>
              <Snippet value={claudeCodeToken} />
            </div>
            <p className="text-xs">
              Tout client MCP compatible OAuth ou acceptant un en-tête d&apos;authentification (Cursor, VS Code…) fonctionne
              avec la même URL.
            </p>
          </div>
        )}

        {guide === 'api' && (
          <div className="space-y-3">
            <p>
              Envoyez le jeton dans l&apos;en-tête <span className="mono text-xs text-[color:var(--ink)]">Authorization</span>.
              Limite : 60 requêtes par minute et par jeton.
            </p>
            <Snippet value={curl} />
            <ul className="list-disc space-y-1 pl-5">
              <li><span className="mono text-xs text-[color:var(--ink)]">GET /api/v1/portfolio</span> : totaux, comptes et positions</li>
              <li><span className="mono text-xs text-[color:var(--ink)]">GET /api/v1/accounts</span> : comptes valorisés</li>
              <li><span className="mono text-xs text-[color:var(--ink)]">GET /api/v1/positions</span> : positions ouvertes (?account_id=)</li>
              <li><span className="mono text-xs text-[color:var(--ink)]">GET /api/v1/transactions</span> : historique (?from, to, type, symbol, limit, cursor)</li>
              <li><span className="mono text-xs text-[color:var(--ink)]">GET /api/v1/me</span> : profil</li>
            </ul>
            <p>
              Spécification complète :{' '}
              <a className="underline underline-offset-4 text-[color:var(--ink)]" href="/api/v1/openapi.json" target="_blank" rel="noreferrer">
                openapi.json
              </a>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
