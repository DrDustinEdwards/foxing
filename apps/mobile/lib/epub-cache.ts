// Downloads a remote EPUB once and reuses the local copy on subsequent
// opens. Foliate-js runs entirely inside a WebView; we feed it the EPUB
// as base64 (rather than a file:// URL) so we don't depend on the WebView
// having permission to fetch from arbitrary file paths, that surface is
// inconsistent across Android/iOS WebView versions.
//
// Cache key is a hash of the remote URL. To make sure a hash collision
// (or a hash function change between app versions) never serves the wrong
// bytes, every cached EPUB has a sidecar `.url` file storing the URL it
// was downloaded from. On every lookup we verify the sidecar matches the
// URL we're asking for; mismatch → treat as cache miss, delete, redownload.
//
// This also handles the dedupe scenario where a book row's epub_url
// changes in the database (e.g. Gutenberg → Standard Ebooks promotion):
// the URL keyed in the cache no longer matches the DB value, so the next
// open swaps to the correct file.

import * as FileSystem from 'expo-file-system/legacy'

const CACHE_DIR = `${FileSystem.documentDirectory}epubs/`

// Stable filename derived from the URL. FNV-1a × 2 (two seeds) gives a
// 64-bit fingerprint as 16 hex chars, meaningfully stronger than the
// 32-bit djb2 previously used here, and still pure JS with no native
// crypto dependency.
function cacheKey(remoteUrl: string): string {
  let a = 0x811c9dc5
  let b = 0x84222325
  for (let i = 0; i < remoteUrl.length; i++) {
    const c = remoteUrl.charCodeAt(i)
    a ^= c; a = Math.imul(a, 0x01000193)
    b ^= c; b = Math.imul(b, 0x05f5e101)
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  return `${hex(a)}${hex(b)}`
}

function epubPath(key: string): string { return `${CACHE_DIR}${key}.epub` }
function sidecarPath(key: string): string { return `${CACHE_DIR}${key}.url` }

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR)
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
}

async function readSidecar(key: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(sidecarPath(key))
    if (!info.exists) return null
    return await FileSystem.readAsStringAsync(sidecarPath(key))
  } catch {
    return null
  }
}

async function writeSidecar(key: string, remoteUrl: string): Promise<void> {
  await FileSystem.writeAsStringAsync(sidecarPath(key), remoteUrl)
}

async function evictCacheEntry(key: string): Promise<void> {
  await FileSystem.deleteAsync(epubPath(key), { idempotent: true })
  await FileSystem.deleteAsync(sidecarPath(key), { idempotent: true })
}

// One-time-per-session sweep: any .epub file without a matching .url
// sidecar is from an older app version that wrote files under a
// different naming scheme. Delete those orphans so they don't waste
// disk and so the next download lands a fresh, sidecar-tagged copy.
// Cheap (10s of files, one stat each) and runs at most once per launch.
let cleanedOnce = false
async function cleanupOrphans(): Promise<void> {
  if (cleanedOnce) return
  cleanedOnce = true
  try {
    const entries = await FileSystem.readDirectoryAsync(CACHE_DIR)
    const epubs = entries.filter((n) => n.endsWith('.epub'))
    let removed = 0
    for (const name of epubs) {
      const key = name.replace(/\.epub$/, '')
      const sidecar = await FileSystem.getInfoAsync(sidecarPath(key))
      if (!sidecar.exists) {
        await FileSystem.deleteAsync(epubPath(key), { idempotent: true })
        removed++
      }
    }
    if (removed > 0) console.log(`[epub-cache] swept ${removed} orphan file(s) from older cache scheme`)
  } catch (e) {
    console.warn('[epub-cache] orphan sweep failed', e instanceof Error ? e.message : e)
  }
}

// Downloads (if needed) and returns the file:// URI of the cached EPUB.
// Used by ReadiumView which only accepts local file paths -- it cannot
// open an HTTPS URL directly. Skips the Base64 read that
// ensureEpubLocallyCached does, so this is the cheap path for callers
// that don't need the raw bytes.
export async function ensureEpubLocalUri(remoteUrl: string): Promise<string> {
  await ensureDir()
  await cleanupOrphans()

  const key = cacheKey(remoteUrl)
  const epub = epubPath(key)

  const info = await FileSystem.getInfoAsync(epub)
  let cached = info.exists

  if (cached) {
    const sidecarUrl = await readSidecar(key)
    if (sidecarUrl !== remoteUrl) {
      console.log('[epub-cache] sidecar mismatch, evicting', {
        key,
        sidecar: sidecarUrl,
        requested: remoteUrl,
      })
      await evictCacheEntry(key)
      cached = false
    }
  }

  if (!cached) {
    console.log(`[epub-cache] downloading ${remoteUrl}`)
    const result = await FileSystem.downloadAsync(remoteUrl, epub)
    if (result.status !== 200) {
      await evictCacheEntry(key)
      throw new Error(`download failed: HTTP ${result.status}`)
    }
    await writeSidecar(key, remoteUrl)
  }

  console.log(`[epub-cache] ${cached ? 'hit' : 'miss'} ${epub}`)
  return epub
}
