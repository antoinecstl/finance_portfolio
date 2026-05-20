import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeoArticlePage } from '@/components/marketing/SeoArticlePage';
import { alternativePages, getPageBySlug, getRelatedPages } from '@/lib/seo-pages';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fi-hub.subleet.com';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return alternativePages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getPageBySlug('alternatives', slug);

  if (!page) return {};

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: page.href },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}${page.href}`,
      title: page.metaTitle,
      description: page.metaDescription,
    },
  };
}

export default async function AlternativePage({ params }: PageProps) {
  const { slug } = await params;
  const page = getPageBySlug('alternatives', slug);

  if (!page) notFound();

  return <SeoArticlePage page={page} relatedPages={getRelatedPages(page)} siteUrl={SITE_URL} />;
}
