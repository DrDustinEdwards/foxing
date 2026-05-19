import type { MetadataRoute } from 'next'

/**
 * PWA web app manifest served at /manifest.webmanifest.
 * Next.js automatically injects the corresponding <link rel="manifest">
 * into <head> when this file is present, so layout.tsx needs no changes.
 *
 * TODO before launch: add the real icon files. The src paths below point
 * at /icon-192.png and /icon-512.png in the public/ directory (which does
 * not exist yet). Generate them from the FoxMark SVG in
 * components/ui/fox-mark.tsx: the rounded-square auburn tile
 * (--brand-ui = #D4622E) with simplified ears, muzzle, eyes, and nose.
 * Export at 192x192 and 512x512 PNG, place at
 * apps/web/public/icon-192.png and apps/web/public/icon-512.png.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Foxing',
    short_name: 'Foxing',
    description:
      'Read, track, and discuss classic literature. 1,400+ public domain books with an AI companion and book clubs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF6EE',
    theme_color: '#D4622E',
    orientation: 'portrait',
    categories: ['books', 'education', 'lifestyle'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'My Library',
        url: '/library',
        description: 'View your reading library',
      },
      {
        name: 'Browse Books',
        url: '/books',
        description: 'Browse the catalog',
      },
      {
        name: 'Book Clubs',
        url: '/clubs',
        description: 'Your reading clubs',
      },
    ],
  }
}
