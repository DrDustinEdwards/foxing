'use client'

import { useRouter } from 'next/navigation'
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VersionHistory } from '@/components/journal/VersionHistory'
import { estimateReadingTime } from '@/lib/journal-shared'
import { slugify } from '@/lib/slug'
import { deleteJournalPost, saveJournalPost } from './actions'
import {
  type SelectionState,
  insertBlock,
} from './editor-actions'
import { BodyField } from './editor/BodyField'
import { CoverField } from './editor/CoverField'
import { DraftBanner } from './editor/DraftBanner'
import { FeaturedToggle } from './editor/FeaturedToggle'
import { FurtherReadingPicker } from './editor/FurtherReadingPicker'
import { SeoPreview } from './editor/SeoPreview'
import { SlugField } from './editor/SlugField'
import { TagsPreview } from './editor/TagsPreview'
import type { LinkedPost } from './editor/types'

export interface JournalPostInitial {
  id: string | null
  title: string
  slug: string
  excerpt: string
  cover_image_url: string
  cover_image_alt: string
  tags: string[]
  content: string
  is_published: boolean
  featured: boolean
  og_title: string
  og_description: string
  canonical_url: string
  published_at: string | null
  updated_at: string | null
  show_published_at: boolean
  show_updated_at: boolean
}

interface Props {
  initial: JournalPostInitial
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const DRAFT_PREFIX = 'journal-draft-'

interface DraftSnapshot {
  savedAt: number
  title: string
  slug: string
  excerpt: string
  cover_image_url: string
  tags: string
  content: string
  featured: boolean
  is_published: boolean
  og_title: string
  og_description: string
  canonical_url: string
  published_at: string
}

export function JournalEditor({ initial }: Props) {
  const router = useRouter()
  const draftKey = `${DRAFT_PREFIX}${initial.id ?? 'new'}`

  const [title, setTitle] = useState(initial.title)
  const [slug, setSlug] = useState(initial.slug)
  const [slugTouched, setSlugTouched] = useState(initial.slug.length > 0)
  const [excerpt, setExcerpt] = useState(initial.excerpt)
  const [coverUrl, setCoverUrl] = useState(initial.cover_image_url)
  const [coverImageAlt, setCoverImageAlt] = useState(initial.cover_image_alt)
  const [tags, setTags] = useState(initial.tags.join(', '))
  const [content, setContent] = useState(initial.content)
  const [featured, setFeatured] = useState(initial.featured)
  const [isPublished, setIsPublished] = useState(initial.is_published)
  const [ogTitle, setOgTitle] = useState(initial.og_title)
  const [ogDescription, setOgDescription] = useState(initial.og_description)
  const [canonicalUrl, setCanonicalUrl] = useState(initial.canonical_url)
  const [publishedAt, setPublishedAt] = useState(
    toDatetimeLocal(initial.published_at),
  )
  const [showPublishedAt, setShowPublishedAt] = useState(
    initial.show_published_at ?? true,
  )
  const [showUpdatedAt, setShowUpdatedAt] = useState(
    initial.show_updated_at ?? false,
  )
  const [linkedPosts, setLinkedPosts] = useState<LinkedPost[]>([])
  const [pending, setPending] = useState<'draft' | 'publish' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftAvailable, setDraftAvailable] = useState<DraftSnapshot | null>(
    null,
  )
  const [previewHtml, setPreviewHtml] = useState('')
  const [slugStatus, setSlugStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle')
  const [showFullPreview, setShowFullPreview] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<{ start: number; end: number } | null>(null)

  // Load curated Further reading links for existing posts.
  useEffect(() => {
    if (!initial.id) return
    let alive = true
    fetch(`/api/admin/journal/posts/${initial.id}/links`)
      .then((r) => (r.ok ? r.json() : { links: [] }))
      .then((d: { links?: LinkedPost[] }) => {
        if (alive) setLinkedPosts(d.links ?? [])
      })
      .catch(() => {
        // Network errors here are non-fatal; admin can re-pick links.
      })
    return () => {
      alive = false
    }
  }, [initial.id])

  // Restore-from-draft detection. Only surface drafts saved after the
  // server-side updated_at so a stale local snapshot does not overwrite
  // newer remote edits.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(draftKey)
    if (!raw) return
    try {
      const draft = JSON.parse(raw) as DraftSnapshot
      const serverTs = initial.updated_at
        ? new Date(initial.updated_at).getTime()
        : 0
      if (draft.savedAt > serverTs) {
        setDraftAvailable(draft)
      } else {
        window.localStorage.removeItem(draftKey)
      }
    } catch {
      window.localStorage.removeItem(draftKey)
    }
  }, [draftKey, initial.updated_at])

  // 30s autosave to localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = window.setInterval(() => {
      const snapshot: DraftSnapshot = {
        savedAt: Date.now(),
        title,
        slug,
        excerpt,
        cover_image_url: coverUrl,
        tags,
        content,
        featured,
        is_published: isPublished,
        og_title: ogTitle,
        og_description: ogDescription,
        canonical_url: canonicalUrl,
        published_at: publishedAt,
      }
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(snapshot))
      } catch {
        // Ignore quota / privacy errors. Autosave is best-effort.
      }
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [
    draftKey,
    title,
    slug,
    excerpt,
    coverUrl,
    tags,
    content,
    featured,
    isPublished,
    ogTitle,
    ogDescription,
    canonicalUrl,
    publishedAt,
  ])

  // Debounced live preview via server-rendered markdown.
  useEffect(() => {
    let alive = true
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/journal/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
        if (!res.ok) return
        const data = (await res.json()) as { html?: string }
        if (alive) setPreviewHtml(data.html ?? '')
      } catch {
        // Keep last preview on transient failure.
      }
    }, 400)
    return () => {
      alive = false
      window.clearTimeout(handle)
    }
  }, [content])

  // Apply pending textarea selection after a toolbar action settles.
  useEffect(() => {
    if (!pendingSelection.current || !textareaRef.current) return
    const ta = textareaRef.current
    const { start, end } = pendingSelection.current
    ta.focus()
    ta.setSelectionRange(start, end)
    pendingSelection.current = null
  }, [content])

  function handleTitle(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setTitle(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  const applyAction = useCallback(
    (fn: (s: SelectionState) => SelectionState) => {
      const ta = textareaRef.current
      if (!ta) return
      const next = fn({
        value: content,
        selectionStart: ta.selectionStart,
        selectionEnd: ta.selectionEnd,
      })
      pendingSelection.current = {
        start: next.selectionStart,
        end: next.selectionEnd,
      }
      setContent(next.value)
    },
    [content],
  )

  async function uploadImage(file: File): Promise<string | null> {
    const fd = new FormData()
    fd.set('image', file)
    setUploading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/journal/upload-image', {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Upload failed.')
        return null
      }
      return data.url
    } finally {
      setUploading(false)
    }
  }

  async function handleCoverPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await uploadImage(file)
    if (url) setCoverUrl(url)
  }

  async function handleBodyImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await uploadImage(file)
    if (!url) return
    applyAction((s) =>
      insertBlock(s, `![](${url})`, '![](\\)'.length - 1 + url.length),
    )
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
    fd.set('cover_image_alt', coverImageAlt)
    fd.set('tags', tags)
    fd.set('content', content)
    fd.set('publish', publish ? 'true' : 'false')
    fd.set('featured', featured ? 'true' : 'false')
    fd.set('og_title', ogTitle)
    fd.set('og_description', ogDescription)
    fd.set('canonical_url', canonicalUrl)
    fd.set('published_at', publishedAt)
    fd.set('show_published_at', showPublishedAt ? 'true' : 'false')
    fd.set('show_updated_at', showUpdatedAt ? 'true' : 'false')
    const res = await saveJournalPost(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error ?? 'Save failed.')
      return
    }
    if (res.id) {
      try {
        await fetch(`/api/admin/journal/posts/${res.id}/links`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetIds: linkedPosts.map((p) => p.id) }),
        })
      } catch {
        // Non-fatal: editor can be reopened to retry.
      }
    }
    setIsPublished(publish)
    if (publish) {
      try {
        await fetch('/api/admin/journal/revalidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        })
      } catch {
        // Non-fatal: ISR will pick changes up at the next revalidate tick.
      }
      setMessage('Saved. Cache cleared. Changes are live.')
    } else {
      setMessage('Saved as draft.')
    }
    try {
      window.localStorage.removeItem(draftKey)
    } catch {
      // Ignore.
    }
    setDraftAvailable(null)
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
    try {
      window.localStorage.removeItem(draftKey)
    } catch {
      // Ignore.
    }
    await deleteJournalPost(fd)
  }

  function restoreDraft() {
    if (!draftAvailable) return
    setTitle(draftAvailable.title)
    setSlug(draftAvailable.slug)
    setSlugTouched(true)
    setExcerpt(draftAvailable.excerpt)
    setCoverUrl(draftAvailable.cover_image_url)
    setTags(draftAvailable.tags)
    setContent(draftAvailable.content)
    setFeatured(draftAvailable.featured)
    setIsPublished(draftAvailable.is_published)
    setOgTitle(draftAvailable.og_title)
    setOgDescription(draftAvailable.og_description)
    setCanonicalUrl(draftAvailable.canonical_url)
    setPublishedAt(draftAvailable.published_at)
    setDraftAvailable(null)
  }

  function discardDraft() {
    try {
      window.localStorage.removeItem(draftKey)
    } catch {
      // Ignore.
    }
    setDraftAvailable(null)
  }

  const words = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content],
  )
  const minutes = useMemo(() => estimateReadingTime(content), [content])

  return (
    <div className="flex flex-col gap-5">
      {draftAvailable && (
        <DraftBanner
          savedAt={draftAvailable.savedAt}
          onRestore={restoreDraft}
          onDiscard={discardDraft}
        />
      )}

      <Input
        label="Title"
        value={title}
        onChange={handleTitle}
        required
        placeholder="Post title"
      />
      <SlugField
        slug={slug}
        status={slugStatus}
        onChange={(v) => {
          setSlug(v)
          setSlugTouched(true)
          setSlugStatus('idle')
        }}
        onBlur={async () => {
          const trimmed = slug.trim()
          if (!trimmed) {
            setSlugStatus('idle')
            return
          }
          setSlugStatus('checking')
          try {
            const params = new URLSearchParams({ slug: trimmed })
            if (initial.id) params.set('exclude', initial.id)
            const res = await fetch(
              `/api/admin/journal/check-slug?${params.toString()}`,
            )
            if (!res.ok) {
              setSlugStatus('idle')
              return
            }
            const data = (await res.json()) as { available?: boolean }
            setSlugStatus(data.available ? 'available' : 'taken')
          } catch {
            setSlugStatus('idle')
          }
        }}
      />

      <FieldTextarea
        id="excerpt"
        label="Excerpt"
        value={excerpt}
        onChange={setExcerpt}
        maxLength={200}
        rows={3}
        prose
        placeholder="Short summary shown on the journal index."
      />

      <Input
        label="OG title (falls back to title)"
        value={ogTitle}
        onChange={(e) => setOgTitle(e.target.value.slice(0, 160))}
        maxLength={160}
        hint={`${ogTitle.length} / 160`}
        placeholder="Custom social title"
      />
      <FieldTextarea
        id="og_description"
        label="OG description (falls back to excerpt)"
        value={ogDescription}
        onChange={(v) => setOgDescription(v.slice(0, 160))}
        maxLength={160}
        rows={2}
        prose
        placeholder="Custom social description."
      />

      <SeoPreview
        slug={slug}
        title={title}
        excerpt={excerpt}
        ogTitle={ogTitle}
        ogDescription={ogDescription}
      />

      <Input
        label="Canonical URL (optional)"
        value={canonicalUrl}
        onChange={(e) => setCanonicalUrl(e.target.value)}
        placeholder="https://..."
      />

      <CoverField
        url={coverUrl}
        uploading={uploading}
        onPick={handleCoverPick}
        onRemove={() => setCoverUrl('')}
        onUrlChange={setCoverUrl}
        alt={coverImageAlt}
        onAltChange={setCoverImageAlt}
      />

      <BodyField
        textareaRef={textareaRef}
        content={content}
        setContent={setContent}
        previewHtml={previewHtml}
        words={words}
        minutes={minutes}
        applyAction={applyAction}
        onImagePick={handleBodyImagePick}
        uploading={uploading}
        onShowFullPreview={() => setShowFullPreview(true)}
      />

      <FurtherReadingPicker
        selfId={initial.id}
        linked={linkedPosts}
        onChange={setLinkedPosts}
      />

      <Input
        label="Tags (comma separated)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="reading-guides, book-analysis"
      />
      <TagsPreview value={tags} />

      <FeaturedToggle value={featured} onChange={setFeatured} />

      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
        <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          Published
        </label>
        {!isPublished && publishedAt && new Date(publishedAt) > new Date() ? (
          <span className="font-dm-mono text-xs text-brand-text">
            Scheduled for{' '}
            {new Date(publishedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ) : null}
        {(isPublished || publishedAt) && (
          <label className="flex flex-col gap-1.5 font-dm-sans text-sm text-text-secondary">
            Published at
            <input
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="w-full max-w-xs rounded-md border border-border-subtle bg-bg-surface px-3 py-2 font-dm-mono text-sm text-text-primary focus:border-brand-ui focus:outline-none"
            />
            <span className="font-dm-mono text-xs text-text-tertiary">
              {isPublished
                ? 'Leave blank to use the current time on publish.'
                : 'Set a future date to schedule auto-publish.'}
            </span>
          </label>
        )}
        {isPublished && (
          <>
            <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={showPublishedAt}
                onChange={(e) => setShowPublishedAt(e.target.checked)}
              />
              Show published date on the post
            </label>
            <label className="flex items-center gap-2 font-dm-sans text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={showUpdatedAt}
                onChange={(e) => setShowUpdatedAt(e.target.checked)}
              />
              Show &ldquo;Updated [date]&rdquo; when content has changed
            </label>
          </>
        )}
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

      {initial.id && (
        <details className="rounded-md border border-border-subtle bg-bg-surface p-3">
          <summary className="cursor-pointer font-dm-mono text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">
            Version history
          </summary>
          <VersionHistory
            postId={initial.id}
            onRestore={(restoredContent, restoredTitle) => {
              setContent(restoredContent)
              setTitle(restoredTitle)
            }}
          />
        </details>
      )}

      {showFullPreview && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-bg-base"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFullPreview(false)
          }}
        >
          <div className="mx-auto max-w-[680px] px-6 py-16">
            <button
              type="button"
              onClick={() => setShowFullPreview(false)}
              className="mb-8 cursor-pointer font-dm-mono text-sm text-text-tertiary hover:text-text-primary"
            >
              Close preview
            </button>
            <h1 className="mb-4 font-fraunces text-[2rem] leading-tight text-text-primary">
              {title}
            </h1>
            {excerpt && (
              <p className="mb-8 border-b border-border-subtle pb-8 font-source-serif-4 text-[1.0625rem] leading-relaxed text-text-secondary">
                {excerpt}
              </p>
            )}
            <div
              className="journal-prose"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FieldTextarea({
  id,
  label,
  value,
  onChange,
  maxLength,
  rows,
  prose,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
  rows: number
  prose?: boolean
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-dm-sans text-sm text-text-secondary"
      >
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        className={`rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-ui focus:outline-none ${
          prose ? 'font-source-serif-4' : 'font-dm-mono'
        }`}
      />
      {maxLength && (
        <span className="font-dm-mono text-xs text-text-tertiary">
          {value.length} / {maxLength}
        </span>
      )}
    </div>
  )
}
