import { describe, expect, it } from 'vitest';
import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('prend les deux premières initiales du nom', () => {
    expect(initialsOf('Camille Démo', 'camille@example.com')).toBe('CD');
    expect(initialsOf('Jean Pierre Martin')).toBe('JP');
  });

  it('retombe sur l’e-mail sans nom', () => {
    expect(initialsOf('', 'zoe@example.com')).toBe('Z');
    expect(initialsOf(null, null)).toBe('?');
  });
});
