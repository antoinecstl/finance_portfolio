import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { FeatureMockup } from '@/components/marketing/FeatureMockups';
import { JsonLd, buildBreadcrumbJsonLd } from '@/components/marketing/JsonLd';
import {
  collectionHrefs,
  collectionLabels,
  type SeoPage,
} from '@/lib/seo-pages';

type SeoArticlePageProps = {
  page: SeoPage;
  relatedPages: SeoPage[];
  siteUrl: string;
};

export function SeoArticlePage({ page, relatedPages, siteUrl }: SeoArticlePageProps) {
  const breadcrumbItems = [
    { label: 'Accueil', href: '/' },
    { label: collectionLabels[page.collection], href: collectionHrefs[page.collection] },
    { label: page.title, href: page.href },
  ];

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.h1,
    description: page.metaDescription,
    inLanguage: 'fr-FR',
    mainEntityOfPage: `${siteUrl}${page.href}`,
    publisher: {
      '@type': 'Organization',
      name: 'Fi-Hub',
      url: siteUrl,
      logo: `${siteUrl}/icon.png`,
    },
  };

  return (
    <main className="max-w-5xl mx-auto px-5 py-14 sm:py-20">
      <JsonLd data={[buildBreadcrumbJsonLd(siteUrl, breadcrumbItems), articleJsonLd]} />
      <Breadcrumbs items={breadcrumbItems} />

      <article className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-10 lg:gap-14">
        <div>
          <p className="eyebrow">{page.eyebrow}</p>
          <h1 className="display text-4xl sm:text-6xl leading-tight mt-3 text-[color:var(--ink)]">
            {page.h1}
          </h1>
          <p className="mt-6 text-[18px] leading-relaxed text-[color:var(--ink-2)]">
            {page.intro}
          </p>

          {page.collection === 'fonctionnalites' && <FeatureMockup slug={page.slug} />}

          <section className="mt-10 ink-card rounded-2xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-[color:var(--ink)]">À retenir</h2>
            <ul className="mt-5 space-y-3 text-[color:var(--ink-2)]">
              {page.takeaways.map((takeaway) => (
                <li key={takeaway} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] shrink-0" />
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-12 space-y-12">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="display text-3xl leading-tight text-[color:var(--ink)]">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-4 text-[color:var(--ink-2)] leading-relaxed">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.bullets && (
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="rounded-xl border border-[color:var(--rule)] bg-[color:var(--paper)] p-4 text-sm text-[color:var(--ink-2)]"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <section className="mt-14 rounded-2xl bg-[color:var(--ink)] p-7 sm:p-9 text-[color:var(--paper)]">
            <h2 className="display text-3xl leading-tight">Mettre le suivi en place</h2>
            <p className="mt-3 max-w-2xl text-[color:var(--paper-2)]">
              Créez un compte Fi-Hub, ajoutez vos comptes et commencez à suivre vos positions,
              dividendes et performances sans maintenir un fichier fragile.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[color:var(--paper)] px-5 py-3 text-sm font-medium text-[color:var(--ink)]"
            >
              {page.ctaLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>

        <aside className="lg:pt-24">
          <div className="sticky top-24 space-y-4">
            <div className="ink-card rounded-2xl p-5">
              <h2 className="font-semibold text-[color:var(--ink)]">Pages liées</h2>
              <div className="mt-4 space-y-3">
                {relatedPages.map((relatedPage) => (
                  <Link
                    key={relatedPage.href}
                    href={relatedPage.href}
                    className="block rounded-xl border border-[color:var(--rule)] p-4 hover:bg-[color:var(--paper-2)]"
                  >
                    <span className="text-sm font-medium text-[color:var(--ink)]">
                      {relatedPage.title}
                    </span>
                    <span className="mt-1 block text-xs text-[color:var(--ink-soft)]">
                      {collectionLabels[relatedPage.collection]}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </article>
    </main>
  );
}
