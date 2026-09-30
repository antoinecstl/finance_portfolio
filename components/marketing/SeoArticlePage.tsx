import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { FeatureMockup } from '@/components/marketing/FeatureMockups';
import { JsonLd, buildBreadcrumbJsonLd } from '@/components/marketing/JsonLd';
import { PRO_FEATURE_SLUGS, freePlanSummary } from '@/components/marketing/product-facts';
import { MONTHLY_TRIAL_LABEL } from '@/lib/plans';
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

function closingCopy(page: SeoPage, isPro: boolean) {
  if (page.collection === 'fonctionnalites') {
    return isPro
      ? {
          title: 'Une fonctionnalité de l’offre Pro',
          body: `Créez d’abord votre compte gratuit, puis activez Pro depuis les paramètres : ${MONTHLY_TRIAL_LABEL.toLowerCase()} en mensuel.`,
        }
      : {
          title: 'Essayer avec vos propres comptes',
          body: 'Ajoutez un compte et quelques transactions : positions, PRU et performance se calculent aussitôt.',
        };
  }
  if (page.collection === 'alternatives') {
    return {
      title: 'Comparer sur vos propres données',
      body: 'Créez un compte gratuit et saisissez quelques transactions pour juger Fi-Hub sur votre portefeuille.',
    };
  }
  return {
    title: 'Appliquer cette méthode dans Fi-Hub',
    body: 'Ajoutez vos comptes et vos transactions : Fi-Hub recalcule positions, PRU et performance hors apports.',
  };
}

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

  const isFeature = page.collection === 'fonctionnalites';
  const isPro = isFeature && PRO_FEATURE_SLUGS.has(page.slug);
  const closing = closingCopy(page, isPro);
  const label = isFeature ? `${page.eyebrow} · ${isPro ? 'Offre Pro' : 'Inclus dans l’offre Free'}` : page.eyebrow;

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:py-16 lg:px-8">
      <JsonLd data={[buildBreadcrumbJsonLd(siteUrl, breadcrumbItems), articleJsonLd]} />
      <Breadcrumbs items={breadcrumbItems} />

      <article>
        <header className="max-w-3xl">
          <p className="text-[13px] font-medium text-[color:var(--text-muted)]">{label}</p>
          <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] text-[color:var(--text)] lg:text-5xl">
            {page.h1}
          </h1>
          <p className="mt-6 max-w-[62ch] text-lg leading-[1.55] text-[color:var(--text-2)] lg:text-[19px]">
            {page.intro}
          </p>
        </header>

        {isFeature && (
          <div className="mt-12">
            <FeatureMockup slug={page.slug} />
          </div>
        )}

        <div className="mt-12 max-w-[68ch]">
          <section aria-labelledby="en-bref">
            <h2 id="en-bref" className="text-xl font-semibold leading-[1.3] text-[color:var(--text)]">
              En bref
            </h2>
            <ul className="mt-4 border-t border-[color:var(--border)]">
              {page.takeaways.map((takeaway) => (
                <li
                  key={takeaway}
                  className="border-b border-[color:var(--border)] py-3 text-[17px] leading-snug text-[color:var(--text-2)]"
                >
                  {takeaway}
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-12 space-y-12">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--text)] lg:text-[32px]">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-4 text-[17px] leading-[1.6] text-[color:var(--text-2)]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.bullets && (
                  <ul className="mt-5 list-disc space-y-2 pl-5 text-[17px] leading-snug text-[color:var(--text-2)] marker:text-[color:var(--text-muted)]">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <section aria-labelledby="closing-title" className="mt-16 border-t border-[color:var(--text)] pt-8">
            <h2 id="closing-title" className="text-2xl font-semibold leading-[1.2] text-[color:var(--text)]">
              {closing.title}
            </h2>
            <p className="mt-3 text-[17px] leading-relaxed text-[color:var(--text-2)]">{closing.body}</p>
            <div className="mt-6">
              <Link href="/signup" className="btn-primary">
                Créer un compte gratuit
              </Link>
            </div>
            <p className="mt-3 text-sm text-[color:var(--text-muted)]">{freePlanSummary()}</p>
          </section>

          {relatedPages.length > 0 && (
            <nav aria-labelledby="related-title" className="mt-16">
              <h2 id="related-title" className="text-xl font-semibold text-[color:var(--text)]">
                À lire aussi
              </h2>
              <ul className="mt-4 border-t border-[color:var(--border)]">
                {relatedPages.map((relatedPage) => (
                  <li key={relatedPage.href} className="border-b border-[color:var(--border)]">
                    <Link
                      href={relatedPage.href}
                      className="group flex items-center justify-between gap-4 py-4"
                    >
                      <span>
                        <span className="block text-base font-medium text-[color:var(--text)] underline-offset-4 group-hover:underline">
                          {relatedPage.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-[color:var(--text-muted)]">
                          {collectionLabels[relatedPage.collection]}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" strokeWidth={1.75} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </article>
    </main>
  );
}
