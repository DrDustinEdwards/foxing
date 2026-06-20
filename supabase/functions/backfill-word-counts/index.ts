import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import JSZip from 'https://esm.sh/jszip@3.10.1'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

const SKIP_PATTERNS = [
  /toc/i, /nav/i, /index/i, /cover/i, /title/i, /halftitle/i,
  /colophon/i, /copyright/i, /imprint/i, /dedication/i,
]

function shouldSkip(filename: string): boolean {
  const base = filename.split('/').pop() ?? filename
  return SKIP_PATTERNS.some((p) => p.test(base))
}

async function getWordCountFromEpub(epubUrl: string): Promise<number | null> {
  try {
    const res = await fetch(epubUrl, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)

    let totalWords = 0
    const contentFiles = Object.keys(zip.files).filter((name) => {
      const isContent = /\.(xhtml|html)$/i.test(name)
      return isContent && !shouldSkip(name) && !zip.files[name].dir
    })

    for (const filename of contentFiles) {
      const content = await zip.files[filename].async('string')
      const text = stripHtml(content)
      totalWords += countWords(text)
    }

    return totalWords > 0 ? totalWords : null
  } catch {
    return null
  }
}

serve(async (req) => {
  const url = new URL(req.url)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)
  const batchSize = 5

  const { data: books, error } = await supabase
    .from('books')
    .select('id, slug, epub_url')
    .eq('source', 'standard_ebooks')
    .is('word_count', null)
    .not('epub_url', 'is', null)
    .order('slug', { ascending: true })
    .range(offset, offset + batchSize - 1)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!books || books.length === 0) {
    return new Response(JSON.stringify({ done: true, processed: 0 }), { status: 200 })
  }

  const results: Array<{ slug: string; word_count: number | null; ok: boolean }> = []

  for (const book of books) {
    const wordCount = await getWordCountFromEpub(book.epub_url)
    if (wordCount !== null) {
      await supabase
        .from('books')
        .update({ word_count: wordCount })
        .eq('id', book.id)
    }
    results.push({ slug: book.slug, word_count: wordCount, ok: wordCount !== null })
  }

  const succeeded = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  const nextOffset = offset + books.length

  return new Response(
    JSON.stringify({
      done: books.length < batchSize,
      processed: books.length,
      succeeded,
      failed,
      next_offset: nextOffset,
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
