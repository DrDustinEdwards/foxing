import { NextResponse } from 'next/server'

export const revalidate = 86_400

/**
 * RFC 9116 security.txt served at /.well-known/security.txt.
 * The Expires field auto-rolls to 1 year ahead on each revalidation,
 * so no manual maintenance is needed.
 */
export async function GET() {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  const expiresISO = expires.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const content = `Contact: mailto:security@foxing.app
Expires: ${expiresISO}
Preferred-Languages: en
Canonical: https://foxing.app/.well-known/security.txt
Policy: https://foxing.app/security
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
