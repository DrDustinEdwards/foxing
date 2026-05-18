'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteJournalPost, saveJournalPost } from './actions'

export interface JournalPostInitial {
  id: string | null
  title: string
  slug: string
  excerpt: string
  cover_image_url: string
  tags: string[]
  content: string
  is_published: boolean
}

interface Props {
  initial: JournalPostInitial
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function JournalEditor({ initial }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initial.title)
  const [slug, setSlug] = useState(initial.slug)
  const [slugTouched, setSlugTouched] = useState(initial.slug.length > 0)
  const [excerpt, setExcerpt] = useState(initial.excerpt)
  const [coverUrl, setCoverUrl] = useState(initial.cover_image_url)
  const [tags, setTags] = useState(initial.tags.join(', '))
  const [content, setContent] = useState(initial.content)
  const [pending, setPending] = useState<'draft' | 'publish' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleTitle(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setTitle(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  async function save(publish: boolean) {
    setPending(publish ? 'publish' : 'draft')
    setError(null)
    setMessage(null)
    const fd = new FormData()
    if (initial.id) fd.set('id', initial.id)
    fd.set('title', title)
    fd.set('slug', slug)
    fd.set('excerpt', excerpt)
    fd.set('cover_image_url', coverUrl)
    fd.set('tags', tags)
    fd.set('content', content)
    fd.set('publish', publish ? 'true' : 'false')
    const res = await saveJournalPost(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error ?? 'Save failed.')
      return
    }
    setMessage(publish ? 'Published.' : 'Saved as draft.')
    if (!initial.id && res.id) {
      router.replace(`/admin/journal/${res.id}`)
    } else {
      router.refresh()
    }
  }

  async function handleDelete() {
    if (!initial.id) return
    if (
      !window.confirm(
        `Delete "${title}"? This permanently removes the post.`,
      )
    )
      return
    setDeleting(true)
    const fd = new FormData()
    fd.set('id', initial.id)
    await deleteJournalPost(fd)
  }

  const preview = useMemo(() => renderMarkdown(content), [content])

  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Title"
        value={title}
        onChange={handleTitle}
        required
        placeholder="Post title"
      />
      <Input
        label="Slug"
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value)
          setSlugTouched(true)
        }}
        hint="Auto-generated from the title until you edit it."
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="excerpt"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Excerpt
        </label>
        <textarea
          id="excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          maxLength={200}
          rows={3}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
          placeholder="Short summary shown on the journal index, 200 chars max."
        />
        <span className="font-dm-mono text-xs text-text-tertiary">
          {excerpt.length} / 200
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_120px]">
        <Input
          label="Cover image URL"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://..."
        />
        {coverUrl && (
          <div className="flex items-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt="Cover preview"
              className="h-24 w-32 rounded border border-border-subtle object-cover"
            />
          </div>
        )}
      </div>
      <Input
        label="Tags (comma separated)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="essays, classics, criticism"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="content"
            className="font-dm-sans text-sm text-text-secondary"
          >
            Content (markdown)
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-dm-mono text-sm text-text-primary"
            placeholder="# Heading&#10;&#10;Your prose goes here."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="font-dm-sans text-sm text-text-secondary">Preview</p>
          <div
            className="prose-foxing min-h-[420px] rounded-md border border-border-subtle bg-bg-surface p-4"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => save(false)}
            loading={pending === 'draft'}
          >
            Save draft
          </Button>
          <Button
            variant="primary"
            onClick={() => save(true)}
            loading={pending === 'publish'}
          >
            {initial.is_published ? 'Update and keep published' : 'Publish'}
          </Button>
        </div>
        {initial.id && (
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={deleting}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Minimal markdown renderer for the preview pane. Supports headings,
 * bold, italics, inline code, links, blockquotes, lists, and paragraphs.
 * Public journal pages can render markdown more fully later.
 */
function renderMarkdown(src: string): string {
  if (!src.trim()) {
    return '<p class="text-text-tertiary">Nothing to preview yet.</p>'
  }
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const lines = src.split('\n')
  const out: string[] = []
  let inList = false
  let inQuote = false
  let paragraph: string[] = []

  function flushParagraph() {
    if (paragraph.length === 0) return
    const html = inlineFormat(paragraph.join(' '))
    out.push(`<p>${html}</p>`)
    paragraph = []
  }

  function inlineFormat(s: string): string {
    let v = escape(s)
    v = v.replace(/`([^`]+)`/g, '<code>$1</code>')
    v = v.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    v = v.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    v = v.replace(/_([^_]+)_/g, '<em>$1</em>')
    v = v.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    return v
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line === '') {
      flushParagraph()
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      if (inQuote) {
        out.push('</blockquote>')
        inQuote = false
      }
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      const level = heading[1].length
      out.push(`<h${level}>${inlineFormat(heading[2])}</h${level}>`)
      continue
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      flushParagraph()
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${inlineFormat(bullet[1])}</li>`)
      continue
    }
    if (inList) {
      out.push('</ul>')
      inList = false
    }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) {
      flushParagraph()
      if (!inQuote) {
        out.push('<blockquote>')
        inQuote = true
      }
      out.push(`<p>${inlineFormat(quote[1])}</p>`)
      continue
    }
    if (inQuote) {
      out.push('</blockquote>')
      inQuote = false
    }
    paragraph.push(line)
  }
  flushParagraph()
  if (inList) out.push('</ul>')
  if (inQuote) out.push('</blockquote>')
  return out.join('\n')
}
