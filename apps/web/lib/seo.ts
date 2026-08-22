import type { Metadata } from 'next'
import { toolDefinitions } from './tools/definitions'

export const SITE_URL = 'https://sufyanjaxs.github.io'
export const BASE_PATH = '/pdf-saas'

export function absoluteUrl(path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${BASE_PATH}${clean === '/' ? '/' : clean}`
}

/** Shared OpenGraph/Twitter defaults merged into per-page metadata. */
function withOpenGraph(metadata: Metadata): Metadata {
  return {
    ...metadata,
    alternates: {
      canonical: typeof metadata.alternates?.canonical === 'string' ? metadata.alternates.canonical : undefined,
    },
    openGraph: {
      type: 'website',
      siteName: 'PDF & Image Tools',
      url: typeof metadata.alternates?.canonical === 'string' ? metadata.alternates.canonical : undefined,
      ...metadata.openGraph,
    },
    twitter: {
      card: 'summary',
      ...metadata.twitter,
    },
  }
}

export function homeMetadata(): Metadata {
  return withOpenGraph({
    title: {
      default: 'PDF & Image Tools — Fast · Free · No Login · 100% Private',
      template: '%s | PDF & Image Tools',
    },
    description:
      '34 free browser-based PDF and image tools. Split, merge, compress, convert and more — your files never leave your device.',
    keywords:
      'pdf tools, merge pdf, split pdf, compress pdf, pdf to jpg, jpg to pdf, image compressor, free online tools, private pdf tools',
    alternates: { canonical: absoluteUrl('/') },
  })
}

export function toolMetadata(slug: string, name: string, description: string, keywords: string[]): Metadata {
  return withOpenGraph({
    title: `${name} — Free & Online`,
    description,
    keywords: keywords.join(', '),
    // NOTE: no trailing slash — GitHub Pages serves /tools/<slug> (static
    // export emits <slug>.html) and the slashed variant returns 404.
    alternates: { canonical: absoluteUrl(`/tools/${slug}`) },
  })
}

type JsonLd = Record<string, unknown>

/**
 * Structured data for a tool page. Every fact below (name, description,
 * price=0, category) is visible on the page itself.
 */
export function toolJsonLd(slug: string, name: string, description: string): JsonLd[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: `${name} — Free Online Tool`,
      description,
      url: absoluteUrl(`/tools/${slug}`),
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (runs in your web browser)',
      browserRequirements: 'Requires JavaScript',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isAccessibleForFree: true,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name },
      ],
    },
  ]
}

export function sitemapEntries(): { url: string; changeFrequency: 'weekly'; priority: number }[] {
  return [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    ...toolDefinitions.map((t) => ({
      url: absoluteUrl(`/tools/${t.slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
