import { Logo } from '@/components/marketing/Logo';
import { AuthProvider } from '@/lib/auth';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-10">
          <Logo />
        </div>
        {/* Le client Supabase n'est chargé que sur les pages qui s'en servent
            (connexion, application), pas sur les pages publiques. */}
        <main>
          <AuthProvider>{children}</AuthProvider>
        </main>
      </div>
    </div>
  );
}
