// Downloads a remote EPUB once and reuses the local copy on subsequent
// opens. Foliate-js runs entirely inside a WebView; we feed it the EPUB
// as base64 (rather than a file:// URL) so we don't depend on the WebView
// having permission to fetch from arbitrary file paths — that surface is
// inconsistent across Android/iOS WebView versions.

import * as FileSystem from 'expo-file-system/legacy'

const CACHE_DIR = `${FileSystem.documentDirectory}epubs/`

// Stable filename derived from the URL — different titles can't share a
// download path, and re-opening the same book skips the download.
function cacheFilename(remoteUrl: string): string {
  let h = 0
  for (let i = 0; i < remoteUrl.length; i++) {
    h = (h * 31 + remoteUrl.charCodeAt(i)) | 0
  }
  return `${(h >>> 0).toString(36)}.epub`
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR)
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
}

export interface CachedEpub {
  base64: string
  bytes: number
  cached: boolean // true if already on disk before this call
}

export async function ensureEpubLocallyCached(remoteUrl: string): Promise<CachedEpub> {
  await ensureDir()
  const localPath = `${CACHE_DIR}${cacheFilename(remoteUrl)}`

  const info = await FileSystem.getInfoAsync(localPath)
  let cached = info.exists
  if (!cached) {
    console.log(`[epub-cache] downloading ${remoteUrl}`)
    const result = await FileSystem.downloadAsync(remoteUrl, localPath)
    if (result.status !== 200) {
      // Clean up the partial file so a retry doesn't see a zero-byte cache hit.
      await FileSystem.deleteAsync(localPath, { idempotent: true })
      throw new Error(`download failed: HTTP ${result.status}`)
    }
  }

  // Read as base64 — foliate's view.open() takes a File which we build
  // from a Blob in the WebView. base64 is the only encoding expo-file-system
  // returns for binary that survives passing through injectJavaScript intact.
  const base64 = await FileSystem.readAsStringAsync(localPath, {
    encoding: FileSystem.EncodingType.Base64,
  })

  // base64 length × 3/4 ≈ original byte size.
  const bytes = Math.floor(base64.length * 0.75)
  console.log(`[epub-cache] ${cached ? 'hit' : 'miss'} → ${(bytes / 1024).toFixed(0)} KB`)

  return { base64, bytes, cached }
}
