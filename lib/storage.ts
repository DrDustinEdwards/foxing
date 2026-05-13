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
