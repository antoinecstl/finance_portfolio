import { Logo } from '@/components/marketing/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-10">
          <Logo />
        </div>
        <main>{children}</main>
      </div>
    </div>
  );
}
