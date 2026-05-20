import { NextResponse, type NextRequest } from 'next/server'
import { discordUserToProfile, issueSession } from '@/lib/discord-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Body {
  code?: string
}

interface DiscordTokenResponse {
  access_token: string
  token_type: string
  scope: string
}

interface DiscordUserResponse {
  id: string
  username: string
}

export async function POST(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'not_configured' },
      { status: 503 },
    )
  }
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body.code) {
    return NextResponse.json({ error: 'missing_code' }, { status: 400 })
  }

  const params = new URLSearchParams()
  params.set('client_id', clientId)
  params.set('client_secret', clientSecret)
  params.set('grant_type', 'authorization_code')
  params.set('code', body.code)

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'oauth_failed' }, { status: 502 })
  }
  const token = (await tokenRes.json()) as DiscordTokenResponse

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  })
  if (!userRes.ok) {
    return NextResponse.json({ error: 'user_lookup_failed' }, { status: 502 })
  }
  const user = (await userRes.json()) as DiscordUserResponse

  const profile = await discordUserToProfile(user.id)
  if (!profile) {
    return NextResponse.json({ needsLink: true })
  }

  const session = await issueSession({
    userId: profile.userId,
    discordId: user.id,
    username: user.username,
  })
  if (!session) {
    return NextResponse.json({ error: 'session_failed' }, { status: 500 })
  }

  return NextResponse.json({
    token: session,
    userId: profile.userId,
    username: profile.username,
  })
}
