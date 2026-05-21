import 'server-only'
import { FOXING_BASE_URL } from '@/lib/metadata'

/**
 * IndexNow client. When content is published or updated, ping the
 * IndexNow API so Bing, Yandex, and other supported engines crawl
 * the new URL immediately instead of waiting for their scheduled
 * crawl.
 *
 * Setup: set INDEXNOW_KEY to a stable UUID and create a static
 * verification file at public/{INDEXNOW_KEY}.txt containing the
 * same key. See .env.example for details.
 */

const HOST = new URL(FOXING_BASE_URL).host
const ENDPOINT = 'https://api.indexnow.org/indexnow'

export async function notifyIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY
  if (!key) return
  const list = urls.filter(Boolean)
  if (list.length === 0) return
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: `${FOXING_BASE_URL}/${key}.txt`,
        urlList: list,
      }),
    })
  } catch {
    // Best-effort. Never block the caller on a search-engine ping.
  }
}
