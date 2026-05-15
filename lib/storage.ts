import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from './supabase'
import { getEpubUrl } from './gutenberg'

const BUCKET = 'epubs'

function objectPath(gutenbergId: number): string {
  return `pg${gutenbergId}.epub`
}

export function getEpubStoragePath(gutenbergId: number): string {
  return `${BUCKET}/${objectPath(gutenbergId)}`
}

export function getEpubPublicUrl(gutenbergId: number): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath(gutenbergId))
  return data.publicUrl
}

async function epubExistsInBucket(gutenbergId: number): Promise<boolean> {
  const name = objectPath(gutenbergId)
  const { data, error } = await supabase.storage.from(BUCKET).list('', { search: name })
  if (error) {
    console.log('[storage] list failed', error.message)
    return false
  }
  return data?.some((f) => f.name === name) ?? false
}

// react-native-readium's native code reads the `file.url` as a local
// filesystem path — it cannot fetch remote http(s) URLs. So once Supabase
// Storage hands us the public download URL, we mirror it into the device's
// cache directory and pass Readium a `file://` URI pointing at the cached
// copy. Subsequent opens skip the download.
function localCachePath(remoteUrl: string): string {
  // Use the URL's last path segment as the cache filename (e.g. pg84.epub).
  // No hashing needed — Supabase paths are already unique per book.
  const filename = remoteUrl.split('/').pop() || 'book.epub'
  const dir = FileSystem.cacheDirectory ?? ''
  return `${dir}foxing-epubs/${filename}`
}

export async function ensureEpubLocallyCached(remoteUrl: string): Promise<string | null> {
  try {
    const localPath = localCachePath(remoteUrl)
    const dir = localPath.substring(0, localPath.lastIndexOf('/'))

    const info = await FileSystem.getInfoAsync(localPath)
    if (info.exists && info.size && info.size > 0) {
      console.log('[storage] using cached EPUB', { localPath, size: info.size })
      return localPath
    }

    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {
      // ignore — dir already exists
    })

    console.log('[storage] downloading EPUB to cache', { remoteUrl, localPath })
    const result = await FileSystem.downloadAsync(remoteUrl, localPath)
    if (result.status !== 200) {
      console.warn('[storage] download failed', result.status)
      return null
    }
    console.log('[storage] cached EPUB', { localPath, status: result.status })
    return localPath
  } catch (e) {
    console.warn('[storage] ensureEpubLocallyCached error', e)
    return null
  }
}

export async function ensureEpubInStorage(gutenbergId: number): Promise<string | null> {
  try {
    if (await epubExistsInBucket(gutenbergId)) {
      return getEpubPublicUrl(gutenbergId)
    }

    const sourceUrl = getEpubUrl({ id: gutenbergId })
    console.log('[storage] downloading EPUB', sourceUrl)
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      console.log('[storage] mirror fetch failed', response.status, sourceUrl)
      return null
    }
    const buffer = await response.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath(gutenbergId), buffer, {
        contentType: 'application/epub+zip',
        upsert: false,
      })

    if (uploadError) {
      // Race: another client uploaded between our existence check and our upload.
      // If the object now exists, treat as success.
      if (await epubExistsInBucket(gutenbergId)) {
        return getEpubPublicUrl(gutenbergId)
      }
      console.log('[storage] upload failed', uploadError.message)
      return null
    }

    return getEpubPublicUrl(gutenbergId)
  } catch (e) {
    console.log('[storage] ensureEpubInStorage error', e)
    return null
  }
}
