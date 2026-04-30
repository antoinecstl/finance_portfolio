import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { CookieBanner } from '@/components/marketing/CookieBanner';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-shell min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
      <CookieBanner />
    </div>
  );
}
