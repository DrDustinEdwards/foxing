// next.config.ts isn't supported on Next 14 (introduced in 15); use .mjs.
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ekjpsuewrkvqzbuteurc.supabase.co' },
      { protocol: 'https', hostname: 'standardebooks.org' },
      { protocol: 'https', hostname: 'covers.openlibrary.org' },
    ],
  },
  transpilePackages: ['@foxing/types', '@foxing/utils'],
}

export default nextConfig
