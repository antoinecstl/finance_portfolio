import type { AdminTicket } from '@/lib/admin-tickets';

const STATUS_LABEL = {
  idea: 'Idée',
  planned: 'Planifié',
  in_progress: 'En cours',
  done: 'Terminé',
} as const;

const PRIORITY_LABEL = { low: 'Basse', medium: 'Normale', high: 'Haute' } as const;

export function buildCodexPrompt(ticket: AdminTicket): string {
  const tags = ticket.tags.length ? ticket.tags.map((tag) => `\`${tag}\``).join(', ') : 'Aucun';
  return `# Ticket — ${ticket.title}

Implémente ce ticket dans le dépôt actuel. Commence par lire les instructions AGENTS.md, inspecte l’existant, puis réalise les changements, les tests adaptés et un commit.

## Contexte
${ticket.description.trim() || 'Aucun contexte supplémentaire.'}

## Critères d’acceptation
${ticket.acceptanceCriteria.trim() || 'À préciser à partir du contexte et des conventions du projet.'}

## Métadonnées
- Priorité : ${PRIORITY_LABEL[ticket.priority]}
- Statut actuel : ${STATUS_LABEL[ticket.status]}
- Tags : ${tags}
- Référence : ${ticket.id}
`;
}
