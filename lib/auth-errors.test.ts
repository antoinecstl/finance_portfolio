import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth-errors';

describe('authErrorMessage', () => {
  it('traduit par code d’erreur', () => {
    expect(authErrorMessage({ code: 'user_already_exists', message: 'User already registered' })).toMatch(/existe déjà/);
    expect(authErrorMessage({ code: 'weak_password', message: 'Password is known to be weak' })).toMatch(/trop fragile/);
    expect(authErrorMessage({ code: 'over_email_send_rate_limit' })).toMatch(/Trop d’emails/);
  });

  it('traduit par motif quand le code manque', () => {
    expect(authErrorMessage({ message: 'User already registered' })).toMatch(/existe déjà/);
    expect(authErrorMessage({ message: 'Password should be at least 8 characters.' })).toMatch(/trop fragile/);
    expect(authErrorMessage({ message: 'For security purposes, you can only request this after 30 seconds.' })).toMatch(/Trop de tentatives/);
    expect(authErrorMessage({ message: 'Unable to validate email address: invalid format' })).toMatch(/pas valide/);
  });

  it('ne montre jamais le message technique brut', () => {
    expect(authErrorMessage({ message: 'Database error saving new user' })).toBe(
      'Une erreur est survenue. Réessayez dans quelques instants.'
    );
    expect(authErrorMessage(null, 'Autre')).toBe('Autre');
    expect(authErrorMessage({ status: 429 })).toMatch(/Trop de tentatives/);
  });
});
