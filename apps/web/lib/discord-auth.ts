import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export interface DiscordSessionPayload {
  userId: string
  discordId: string
  username: string
  expiresAt: number
}

const SESSION_TTL_MS = 6 * 60 * 60 * 1000

function getSecret(): string | null {
  return process.env.DISCORD_SESSION_SECRET ?? null
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function fromBase64Url(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, 'base64')
}

async function sign(message: string, secret: string): Promise<string> {
  const { createHmac } = await import('node:crypto')
  return toBase64Url(createHmac('sha256', secret).update(message).digest())
}

export async function issueSession(
  payload: Omit<DiscordSessionPayload, 'expiresAt'>,
): Promise<string | null> {
  const secret = getSecret()
  if (!secret) return null
  const expiresAt = Date.now() + SESSION_TTL_MS
  const body = toBase64Url(
    Buffer.from(JSON.stringify({ ...payload, expiresAt })),
  )
  const sig = await sign(body, secret)
  return `${body}.${sig}`
}

export async function verifySession(
  token: string,
): Promise<DiscordSessionPayload | null> {
  const secret = getSecret()
  if (!secret) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = await sign(body, secret)
  if (expected !== sig) return null
  let payload: DiscordSessionPayload
  try {
    payload = JSON.parse(fromBase64Url(body).toString()) as DiscordSessionPayload
  } catch {
    return null
  }
  if (payload.expiresAt < Date.now()) return null
  return payload
}

export async function discordUserToProfile(
  discordId: string,
): Promise<{
  userId: string
  username: string
  display_name: string
} | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, username, display_name')
    .eq('discord_id', discordId)
    .maybeSingle()
  if (!data) return null
  const row = data as {
    id: string
    username: string
    display_name: string
  }
  return {
    userId: row.id,
    username: row.username,
    display_name: row.display_name,
  }
}

export function bearerFromHeaders(headers: Headers): string | null {
  const auth = headers.get('authorization')
  if (!auth) return null
  const [scheme, value] = auth.split(' ')
  if (scheme !== 'Bearer' || !value) return null
  return value
}
