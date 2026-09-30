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

  const claudeCode = `claude mcp add --transport http fi-hub ${mcpUrl} \\\n  --header "Authorization: Bearer VOTRE_JETON"`;
  const claudeDesktop = JSON.stringify(
    {
      mcpServers: {
        'fi-hub': {
          command: 'npx',
          args: ['-y', 'mcp-remote', mcpUrl, '--header', 'Authorization:Bearer ${FIHUB_TOKEN}'],
          env: { FIHUB_TOKEN: 'VOTRE_JETON' },
        },
      },
    },
    null,
    2
  );
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
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Dans ChatGPT, ouvrez <strong className="text-[color:var(--ink)]">Explorer les GPT → Créer</strong>, onglet{' '}
              <strong className="text-[color:var(--ink)]">Configurer</strong>, puis{' '}
              <strong className="text-[color:var(--ink)]">Créer une action</strong>.
            </li>
            <li>
              Choisissez <strong className="text-[color:var(--ink)]">Importer depuis une URL</strong> et collez :
              <Snippet value={openApiUrl} />
            </li>
            <li>
              Authentification : <strong className="text-[color:var(--ink)]">Clé API</strong>, type{' '}
              <strong className="text-[color:var(--ink)]">Bearer</strong>, et collez votre jeton.
            </li>
            <li>
              Politique de confidentialité : <span className="mono text-xs">{appUrl}/legal/confidentialite</span>. Gardez le
              GPT privé : il lit vos données avec votre jeton.
            </li>
          </ol>
        )}

        {guide === 'claude' && (
          <div className="space-y-4">
            <p>
              Fi-Hub expose un serveur MCP (lecture seule) à l&apos;adresse{' '}
              <span className="mono text-xs text-[color:var(--ink)]">{mcpUrl}</span>.
            </p>
            <div>
              <p className="font-medium text-[color:var(--ink)]">Claude Code</p>
              <Snippet value={claudeCode} />
            </div>
            <div>
              <p className="font-medium text-[color:var(--ink)]">Claude Desktop</p>
              <p className="mt-1">
                Réglages → Développeur → Modifier la configuration, puis ajoutez (Node.js requis) :
              </p>
              <Snippet value={claudeDesktop} />
            </div>
            <p className="text-xs">
              Tout client MCP acceptant un en-tête d&apos;authentification (Cursor, VS Code…) fonctionne de la même façon.
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
