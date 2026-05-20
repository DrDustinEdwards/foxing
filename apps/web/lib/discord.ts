import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export const FOXING_EMBED_COLOR = 0xd4622e

export interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  timestamp?: string
  footer?: { text: string; icon_url?: string }
  fields?: Array<{ name: string; value: string; inline?: boolean }>
}

export function isValidDiscordWebhook(url: string): boolean {
  return /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\//.test(
    url,
  )
}

export async function postToDiscord(
  webhookUrl: string,
  content: string,
  embeds?: DiscordEmbed[],
): Promise<boolean> {
  if (!isValidDiscordWebhook(webhookUrl)) return false
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        embeds: embeds && embeds.length > 0 ? embeds : undefined,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function getClubDiscordWebhook(
  clubId: string,
): Promise<{ url: string; slug: string | null; name: string | null } | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('clubs')
    .select('discord_webhook_url, slug, name')
    .eq('id', clubId)
    .maybeSingle()
  const row = data as {
    discord_webhook_url: string | null
    slug: string | null
    name: string | null
  } | null
  if (!row?.discord_webhook_url) return null
  return {
    url: row.discord_webhook_url,
    slug: row.slug,
    name: row.name,
  }
}
