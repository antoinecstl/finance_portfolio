import type { Metadata } from 'next';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = {
  title: 'Créer un compte',
  description: 'Créez votre compte Fi-Hub gratuitement. Suivez votre PEA, CTO, livrets et assurance-vie en un tableau de bord — sans carte bancaire.',
  alternates: { canonical: '/signup' },
};

export default function SignupPage() {
  return <SignupForm />;
}
