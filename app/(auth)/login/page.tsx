import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à Fi-Hub pour accéder à votre tableau de bord de suivi de patrimoine.',
  alternates: { canonical: '/login' },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
