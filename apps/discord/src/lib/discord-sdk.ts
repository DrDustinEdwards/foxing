import { DiscordSDK } from '@discord/embedded-app-sdk'

export interface DiscordSession {
  token: string
  userId: string
  username: string
}

declare const __FOXING_API__: string

function clientId(): string {
  const id =
    (import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined) ?? ''
  return id
}

export async function authenticate(): Promise<DiscordSession | null> {
  const id = clientId()
  if (!id) {
    throw new Error(
      'VITE_DISCORD_CLIENT_ID is not configured. Set it in the Discord activity environment.',
    )
  }
  const sdk = new DiscordSDK(id)
  await sdk.ready()
  const { code } = await sdk.commands.authorize({
    client_id: id,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  })

  const res = await fetch(`${__FOXING_API__}/api/discord/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) {
    return null
  }
  const data = (await res.json()) as
    | { token: string; userId: string; username: string }
    | { needsLink: true }
  if ('needsLink' in data) return null
  return { token: data.token, userId: data.userId, username: data.username }
}
