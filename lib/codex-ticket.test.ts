import { describe, expect, it } from 'vitest';
import { buildCodexPrompt } from './codex-ticket';

describe('buildCodexPrompt', () => {
  it('produces a self-contained implementation brief', () => {
    const prompt = buildCodexPrompt({
      id: '6f5f51af-5dce-4e04-8b20-f29ee57394de',
      title: 'Ajouter une vue annuelle',
      description: 'Comparer les dividendes par année.',
      acceptanceCriteria: '- Afficher un histogramme\n- Ajouter un filtre',
      tags: ['dashboard', 'dividendes'],
      status: 'planned',
      priority: 'high',
      createdAt: '2026-09-28T10:00:00Z',
      updatedAt: '2026-09-28T10:00:00Z',
    });

    expect(prompt).toContain('# Ticket — Ajouter une vue annuelle');
    expect(prompt).toContain('Comparer les dividendes par année.');
    expect(prompt).toContain('- Priorité : Haute');
    expect(prompt).toContain('`dashboard`, `dividendes`');
    expect(prompt).toContain('AGENTS.md');
  });

  it('provides useful defaults for an intentionally terse ticket', () => {
    const prompt = buildCodexPrompt({
      id: '6f5f51af-5dce-4e04-8b20-f29ee57394de', title: 'Idée', description: '',
      acceptanceCriteria: '', tags: [], status: 'idea', priority: 'low',
      createdAt: '', updatedAt: '',
    });

    expect(prompt).toContain('Aucun contexte supplémentaire.');
    expect(prompt).toContain('À préciser');
    expect(prompt).toContain('- Tags : Aucun');
  });
});
