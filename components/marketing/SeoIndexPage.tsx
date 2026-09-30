import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { JsonLd, buildBreadcrumbJsonLd } from '@/components/marketing/JsonLd';
import type { SeoPage } from '@/lib/seo-pages';

type SeoIndexPageProps = {
  title: string;
  description: string;
  eyebrow: string;
  href: string;
  pages: SeoPage[];
  siteUrl: string;
};

export function SeoIndexPage({
  title,
  description,
  eyebrow,
  href,
  pages,
  siteUrl,
}: SeoIndexPageProps) {
  const breadcrumbItems = [
    { label: 'Accueil', href: '/' },
    { label: title, href },
  ];

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    inLanguage: 'fr-FR',
    url: `${siteUrl}${href}`,
    hasPart: pages.map((page) => ({
      '@type': 'Article',
      name: page.title,
      url: `${siteUrl}${page.href}`,
    })),
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:py-16 lg:px-8">
      <JsonLd data={[buildBreadcrumbJsonLd(siteUrl, breadcrumbItems), collectionJsonLd]} />
      <Breadcrumbs items={breadcrumbItems} />

      <header className="max-w-3xl">
        <p className="text-[13px] font-medium text-[color:var(--text-muted)]">{eyebrow}</p>
        <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] text-[color:var(--text)] lg:text-5xl">
          {title}
        </h1>
        <p className="mt-6 max-w-[62ch] text-lg leading-[1.55] text-[color:var(--text-2)]">
          {description}
        </p>
      </header>

      <ul className="mt-12 max-w-4xl border-t border-[color:var(--text)]">
        {pages.map((page) => (
          <li key={page.href} className="border-b border-[color:var(--border)]">
            <Link href={page.href} className="group grid gap-1 py-6 sm:grid-cols-[1fr_auto] sm:gap-x-8">
              <h2 className="text-xl font-semibold leading-[1.3] tracking-[-0.01em] text-[color:var(--text)] underline-offset-4 group-hover:underline">
                {page.title}
              </h2>
              <ArrowRight
                className="hidden h-5 w-5 text-[color:var(--text-muted)] sm:row-span-2 sm:block sm:self-center"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <p className="max-w-[62ch] text-[15px] leading-relaxed text-[color:var(--text-2)]">
                {page.metaDescription}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
