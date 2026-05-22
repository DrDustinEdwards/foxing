// next.config.ts isn't supported on Next 14 (introduced in 15); use .mjs.
/** @type {import('next').NextConfig} */

import { withSentryConfig } from '@sentry/nextjs'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  { key: 'X-Robots-Tag', value: 'index, follow' },
]

const nextConfig = {
  images: {
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: 'https', hostname: 'ekjpsuewrkvqzbuteurc.supabase.co' },
      { protocol: 'https', hostname: 'standardebooks.org' },
      { protocol: 'https', hostname: 'covers.openlibrary.org' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
      { protocol: 'https', hostname: 'images.amazon.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['recharts'],
    instrumentationHook: true,
  },
  transpilePackages: ['@foxing/types', '@foxing/utils'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.foxing.app' }],
        destination: 'https://foxing.app/:path*',
        permanent: true,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: 'recova',
  project: 'foxing-web',
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
