import './globals.css'
import type { Metadata } from 'next'
import { Fraunces, Source_Serif_4, DM_Sans, DM_Mono } from 'next/font/google'
import { FOXING_BASE_URL } from '@/lib/metadata'

// Runs before any paint. Reads the stored preference from localStorage and
// sets data-mode + color-scheme on <html> so there is no flash of the
// wrong theme. Falls back to the OS preference when stored is 'system'
// or absent. Failures swallow silently because localStorage can throw in
// some embedded contexts.
const THEME_INIT_SCRIPT = `(function() {
  try {
    var theme = localStorage.getItem('theme') || 'system';
    var resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-mode', resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();`

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif-4',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(FOXING_BASE_URL),
  title: {
    default: 'Foxing · reading, together.',
    template: '%s · Foxing',
  },
  description:
    'Read 1,400+ classic books free. AI companion, book clubs, and a community of serious readers. Frankenstein, Pride and Prejudice, Sherlock Holmes, and more.',
  applicationName: 'Foxing',
  keywords: [
    'classic books',
    'public domain books',
    'read online free',
    'book clubs',
    'AI reading companion',
    'Frankenstein',
    'Jane Austen',
    'reading app',
    'Sherlock Holmes',
    'Standard Ebooks',
  ],
  authors: [{ name: 'Foxing', url: FOXING_BASE_URL }],
  creator: 'Foxing',
  publisher: 'Foxing',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: FOXING_BASE_URL,
    siteName: 'Foxing',
    title: 'Foxing · reading, together.',
    description:
      'Read 1,400+ classic books free. AI companion, book clubs, and serious readers.',
    images: [
      {
        url: `${FOXING_BASE_URL}/og`,
        width: 1200,
        height: 630,
        alt: 'Foxing, reading together.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Foxing · reading, together.',
    description:
      'Read 1,400+ classic books free. AI companion, book clubs, and serious readers.',
    images: [`${FOXING_BASE_URL}/og`],
    creator: '@foxingreads',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: FOXING_BASE_URL,
    types: { 'application/rss+xml': `${FOXING_BASE_URL}/feed.rss` },
  },
}

const ORGANIZATION_JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${FOXING_BASE_URL}/#organization`,
  name: 'Foxing',
  url: FOXING_BASE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${FOXING_BASE_URL}/icon.png`,
    width: 512,
    height: 512,
  },
  description:
    'Foxing is a reading platform offering 1,400+ free public domain classic books with an AI companion, book clubs, and a community reading experience.',
  sameAs: [
    'https://twitter.com/foxingreads',
    'https://instagram.com/foxingreads',
    'https://apps.apple.com/app/foxing',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'hello@foxing.app',
    contactType: 'customer support',
  },
  foundingDate: '2026',
  knowsAbout: [
    'Classic literature',
    'Public domain books',
    'Reading communities',
    'AI-assisted reading',
    'Book clubs',
    'Literary analysis',
  ],
})

const WEBSITE_JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${FOXING_BASE_URL}/#website`,
  url: FOXING_BASE_URL,
  name: 'Foxing',
  description: 'reading, together.',
  publisher: { '@id': `${FOXING_BASE_URL}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${FOXING_BASE_URL}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      data-mode="light"
      className={`${fraunces.variable} ${sourceSerif.variable} ${dmSans.variable} ${dmMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="preconnect"
          href="https://ekjpsuewrkvqzbuteurc.supabase.co"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://ekjpsuewrkvqzbuteurc.supabase.co"
        />
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: ORGANIZATION_JSONLD }}
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: WEBSITE_JSONLD }}
        />
        {children}
      </body>
    </html>
  )
}
