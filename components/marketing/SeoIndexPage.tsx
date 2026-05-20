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
    <main className="max-w-6xl mx-auto px-5 py-14 sm:py-20">
      <JsonLd data={[buildBreadcrumbJsonLd(siteUrl, breadcrumbItems), collectionJsonLd]} />
      <Breadcrumbs items={breadcrumbItems} />

      <section className="max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display text-4xl sm:text-6xl leading-tight mt-3 text-[color:var(--ink)]">
          {title}
        </h1>
        <p className="mt-6 text-[18px] leading-relaxed text-[color:var(--ink-2)]">
          {description}
        </p>
      </section>

      <section className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="ink-card rounded-2xl p-6 hover:-translate-y-0.5 transition-transform"
          >
            <p className="eyebrow">{page.eyebrow}</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
              {page.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-2)]">
              {page.metaDescription}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--accent)]">
              Lire la page
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
