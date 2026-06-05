'use client'

import { useRouter } from 'next/navigation'
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VersionHistory } from '@/components/journal/VersionHistory'
import { estimateReadingTime, JOURNAL_TAGS } from '@/lib/journal-shared'
import { deleteJournalPost, saveJournalPost } from './actions'
import {
  type SelectionState,
  extractYouTubeId,
  insertBlock,
  prefixLines,
  replaceSelection,
  wrapSelection,
} from './editor-actions'

export interface JournalPostInitial {
  id: string | null
  title: string
  slug: string
  excerpt: string
  cover_image_url: string
  tags: string[]
  content: string
  is_published: boolean
  featured: boolean
  og_title: string
  og_description: string
  canonical_url: string
  published_at: string | null
  updated_at: string | null
}

interface LinkedPost {
  id: string
  slug: string
  title: string
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
    fd.set('tags', tags)
    fd.set('content', content)
    fd.set('publish', publish ? 'true' : 'false')
    fd.set('featured', featured ? 'true' : 'false')
    fd.set('og_title', ogTitle)
    fd.set('og_description', ogDescription)
    fd.set('canonical_url', canonicalUrl)
    fd.set('published_at', publishedAt)
    const res = await saveJournalPost(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error ?? 'Save failed.')
      return
    }
    if (res.id) {
      // Persist curated Further reading links. Fire-and-await so a
      // mid-save crash leaves both records consistent.
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
    </div>
  )
}

function DraftBanner({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: number
  onRestore: () => void
  onDiscard: () => void
}) {
  const when = new Date(savedAt).toLocaleString()
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-ui bg-brand-subtle px-3 py-2 text-sm text-brand-subtle-text">
      <span className="font-dm-sans">
        Unsaved draft from {when} found in this browser.
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="font-dm-sans text-sm font-medium text-brand-text hover:underline"
        >
          Restore
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
        >
          Discard
        </button>
      </span>
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

function CoverField({
  url,
  uploading,
  onPick,
  onRemove,
  onUrlChange,
}: {
  url: string
  uploading: boolean
  onPick: (e: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  onUrlChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="font-dm-sans text-sm text-text-secondary">Cover image</p>
      <div className="flex flex-wrap items-start gap-4">
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={url}
            alt="Cover preview"
            className="h-32 w-48 rounded border border-border-subtle object-cover"
          />
        ) : (
          <div className="flex h-32 w-48 items-center justify-center rounded border border-dashed border-border-subtle bg-bg-sunken font-dm-mono text-xs text-text-tertiary">
            No cover yet
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-3 py-2 font-dm-sans text-sm text-text-primary hover:border-brand-ui">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onPick}
            />
            {uploading ? 'Uploading...' : 'Upload image'}
          </label>
          <Input
            label="Or paste a URL"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://..."
          />
          {url && (
            <button
              type="button"
              onClick={onRemove}
              className="self-start font-dm-sans text-xs text-text-tertiary hover:text-error"
            >
              Remove cover
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function FeaturedToggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
        value
          ? 'border-brand-ui bg-brand-subtle'
          : 'border-border-subtle bg-bg-surface hover:border-brand-ui'
      }`}
    >
      <span className="flex flex-col gap-0.5">
        <span
          className={`font-dm-sans text-sm font-medium ${value ? 'text-brand-subtle-text' : 'text-text-primary'}`}
        >
          Featured post
        </span>
        <span className="font-dm-sans text-xs text-text-tertiary">
          Pin to the journal index hero and homepage strip.
        </span>
      </span>
      <span
        className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
          value ? 'bg-brand-ui' : 'bg-border-default'
        }`}
        aria-hidden="true"
      >
        <span
          className={`h-5 w-5 rounded-full bg-bg-surface transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

function TagsPreview({ value }: { value: string }) {
  const tags = value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  const valid = new Set<string>(JOURNAL_TAGS.map((t) => t.slug))
  const canonical = JOURNAL_TAGS.map((t) => t.slug).join(', ')
  return (
    <div className="flex flex-col gap-1">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const ok = valid.has(t)
            return (
              <span
                key={t}
                className={`rounded-full border px-2 py-0.5 font-dm-mono text-[0.6875rem] ${
                  ok
                    ? 'bg-brand-subtle text-brand-text border-brand-ui'
                    : 'bg-error-bg text-error border-error'
                }`}
              >
                {t}
              </span>
            )
          })}
        </div>
      )}
      <p className="font-dm-mono text-xs text-text-tertiary">
        Valid tags: {canonical}
      </p>
    </div>
  )
}

function SlugField({
  slug,
  status,
  onChange,
  onBlur,
}: {
  slug: string
  status: 'idle' | 'checking' | 'available' | 'taken'
  onChange: (v: string) => void
  onBlur: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="slug"
        className="font-dm-sans text-sm text-text-secondary"
      >
        Slug
      </label>
      <input
        id="slug"
        value={slug}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2 font-dm-mono text-sm text-text-primary focus:border-brand-ui focus:outline-none"
      />
      <p className="font-dm-mono text-xs text-text-tertiary">
        /journal/{slug || '...'}
      </p>
      {status === 'checking' && (
        <p className="font-dm-mono text-xs text-text-tertiary">Checking...</p>
      )}
      {status === 'taken' && (
        <p className="font-dm-mono text-xs text-error">
          This slug is already in use.
        </p>
      )}
      {status === 'available' && (
        <p className="font-dm-mono text-xs text-success">Slug is available.</p>
      )}
    </div>
  )
}

function SeoPreview({
  slug,
  title,
  excerpt,
  ogTitle,
  ogDescription,
}: {
  slug: string
  title: string
  excerpt: string
  ogTitle: string
  ogDescription: string
}) {
  const [tab, setTab] = useState<'search' | 'social'>('search')
  const effectiveTitle = ogTitle.trim() || title.trim() || 'Untitled'
  const effectiveDesc = ogDescription.trim() || excerpt.trim() || ''
  const titleOver = effectiveTitle.length > 60
  const descOver = effectiveDesc.length > 160
  const shownTitle = titleOver
    ? `${effectiveTitle.slice(0, 60).trimEnd()}...`
    : effectiveTitle
  const shownDesc = descOver
    ? `${effectiveDesc.slice(0, 160).trimEnd()}...`
    : effectiveDesc

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-dm-sans text-sm text-text-secondary">SEO preview</p>
        <div className="flex gap-1 rounded-md border border-border-subtle p-0.5">
          {(['search', 'social'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-2 py-0.5 font-dm-sans text-xs ${
                tab === t
                  ? 'bg-brand-subtle text-brand-subtle-text'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {tab === 'search' ? (
        <div className="flex flex-col gap-1">
          <p className="font-dm-mono text-xs text-text-tertiary">
            foxing.app › journal › {slug || '...'}
          </p>
          <p className="font-fraunces text-base text-brand-text line-clamp-2">
            <span className={titleOver ? 'text-error' : ''}>{shownTitle}</span>
          </p>
          <p className="font-source-serif-4 text-sm text-text-secondary line-clamp-2">
            <span className={descOver ? 'text-error' : ''}>{shownDesc}</span>
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border-subtle bg-brand-subtle">
          <div className="aspect-[2/1] bg-bg-sunken" aria-hidden="true" />
          <div className="flex flex-col gap-1 p-4">
            <p className="font-dm-mono text-xs text-text-tertiary">foxing.app</p>
            <p className="font-fraunces text-base text-text-primary line-clamp-2">
              {shownTitle}
            </p>
            <p className="font-source-serif-4 text-sm text-text-secondary line-clamp-2">
              {shownDesc}
            </p>
          </div>
        </div>
      )}
      <p className="flex gap-3 font-dm-mono text-xs">
        <span className={titleOver ? 'text-error' : 'text-text-tertiary'}>
          Title: {effectiveTitle.length} / 60
        </span>
        <span className={descOver ? 'text-error' : 'text-text-tertiary'}>
          Description: {effectiveDesc.length} / 160
        </span>
      </p>
    </div>
  )
}

function ShortcodePanel() {
  const rows: Array<[string, string]> = [
    ['## Heading', 'H2 section heading'],
    ['### Heading', 'H3 subheading'],
    ['**text**', 'Bold'],
    ['_text_', 'Italic'],
    ['`code`', 'Inline code'],
    ['[text](url)', 'Link'],
    ['> text', 'Blockquote'],
    ['---', 'Horizontal rule'],
    [':::tip / :::warning / :::note / :::danger', 'Callout block'],
    [':::pullquote', 'Pull quote'],
    [':::toggle[Header]', 'Collapsible section'],
    ['::youtube[videoId]', 'YouTube embed'],
    ['::bookmark[url]', 'Bookmark card'],
    ['::postlink[slug]', 'Internal post link (or type @ in editor)'],
    ['![alt](url)', 'Image (or use toolbar Image button)'],
  ]
  return (
    <details className="rounded-md border border-border-subtle bg-bg-surface p-2">
      <summary className="flex cursor-pointer items-center justify-between px-2 py-1 font-dm-sans text-xs text-text-secondary">
        <span>Shortcodes</span>
        <span aria-hidden="true" className="font-dm-mono text-xs">
          +
        </span>
      </summary>
      <table className="mt-2 w-full border-collapse text-left font-dm-sans text-xs">
        <tbody>
          {rows.map(([code, what]) => (
            <tr
              key={code}
              className="border-t border-border-subtle align-top"
            >
              <td className="px-2 py-1 font-dm-mono text-xs text-text-primary">
                {code}
              </td>
              <td className="px-2 py-1 text-text-tertiary">{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

function FurtherReadingPicker({
  selfId,
  linked,
  onChange,
}: {
  selfId: string | null
  linked: LinkedPost[]
  onChange: (next: LinkedPost[]) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LinkedPost[]>([])
  const [searching, setSearching] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    let alive = true
    const handle = window.setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/admin/journal/posts/search?q=${encodeURIComponent(q)}`,
        )
        if (!res.ok) {
          setResults([])
          return
        }
        const data = (await res.json()) as { results?: LinkedPost[] }
        if (alive) setResults(data.results ?? [])
      } finally {
        if (alive) setSearching(false)
      }
    }, 200)
    return () => {
      alive = false
      window.clearTimeout(handle)
    }
  }, [query])

  function add(p: LinkedPost) {
    if (p.id === selfId) return
    if (linked.some((x) => x.id === p.id)) return
    onChange([...linked, p])
    setQuery('')
    setResults([])
  }

  function remove(id: string) {
    onChange(linked.filter((p) => p.id !== id))
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="font-dm-sans text-sm text-text-secondary">
        Further reading
      </p>
      <p className="font-dm-mono text-xs text-text-tertiary">
        Curated links shown at the end of this article.
      </p>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts by title..."
          className="w-full rounded-md border border-border-subtle bg-bg-base px-3 py-2 font-dm-sans text-sm text-text-primary focus:border-brand-ui focus:outline-none"
        />
        {results.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border border-border-subtle bg-bg-surface shadow-lg">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => add(r)}
                  disabled={r.id === selfId || linked.some((x) => x.id === r.id)}
                  className="flex w-full flex-col px-3 py-2 text-left font-dm-sans text-sm text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{r.title}</span>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    /journal/{r.slug}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searching && results.length === 0 && query.trim() && (
          <p className="absolute left-0 top-full mt-1 font-dm-mono text-xs text-text-tertiary">
            Searching...
          </p>
        )}
      </div>
      {linked.length > 0 && (
        <ol className="flex flex-col gap-1">
          {linked.map((p, i) => (
            <li
              key={p.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(i)
              }}
              onDrop={() => {
                if (dragIndex === null || dragIndex === i) {
                  setDragIndex(null)
                  setDragOverIndex(null)
                  return
                }
                const copy = linked.slice()
                const [moved] = copy.splice(dragIndex, 1)
                copy.splice(i, 0, moved)
                onChange(copy)
                setDragIndex(null)
                setDragOverIndex(null)
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setDragOverIndex(null)
              }}
              className={`flex cursor-grab items-center justify-between gap-2 rounded-md border bg-bg-base px-3 py-2 font-dm-sans text-sm text-text-primary transition-colors active:cursor-grabbing ${
                dragOverIndex === i
                  ? 'border-brand-ui bg-brand-subtle'
                  : 'border-border-subtle'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="select-none font-dm-mono text-text-tertiary"
                >
                  ⠿
                </span>
                <span className="min-w-0 truncate">{p.title}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="shrink-0 px-2 font-dm-mono text-xs text-text-tertiary hover:text-error"
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function BodyField({
  textareaRef,
  content,
  setContent,
  previewHtml,
  words,
  minutes,
  applyAction,
  onImagePick,
  uploading,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  content: string
  setContent: (v: string) => void
  previewHtml: string
  words: number
  minutes: number
  applyAction: (fn: (s: SelectionState) => SelectionState) => void
  onImagePick: (e: ChangeEvent<HTMLInputElement>) => void
  uploading: boolean
}) {
  const [mention, setMention] = useState<{
    query: string
    start: number
  } | null>(null)
  const [mentionResults, setMentionResults] = useState<LinkedPost[]>([])
  const [mentionLoading, setMentionLoading] = useState(false)

  useEffect(() => {
    if (!mention) {
      setMentionResults([])
      return
    }
    const q = mention.query.trim()
    if (!q) {
      setMentionResults([])
      return
    }
    let alive = true
    const handle = window.setTimeout(async () => {
      setMentionLoading(true)
      try {
        const res = await fetch(
          `/api/admin/journal/posts/search?q=${encodeURIComponent(q)}`,
        )
        if (!res.ok) return
        const data = (await res.json()) as { results?: LinkedPost[] }
        if (alive) setMentionResults(data.results ?? [])
      } finally {
        if (alive) setMentionLoading(false)
      }
    }, 200)
    return () => {
      alive = false
      window.clearTimeout(handle)
    }
  }, [mention])

  function detectMention(value: string, caret: number) {
    const slice = value.slice(0, caret)
    const at = slice.lastIndexOf('@')
    if (at === -1) {
      setMention(null)
      return
    }
    const prevChar = at === 0 ? '\n' : slice[at - 1]
    if (!/\s/.test(prevChar) && at !== 0) {
      setMention(null)
      return
    }
    const query = slice.slice(at + 1)
    if (/\s/.test(query)) {
      setMention(null)
      return
    }
    setMention({ query, start: at })
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    detectMention(e.target.value, e.target.selectionStart)
  }

  function pickMention(p: LinkedPost) {
    if (!mention || !textareaRef.current) return
    const caret = textareaRef.current.selectionStart
    const insertion = `::postlink[${p.slug}]`
    const before = content.slice(0, mention.start)
    const after = content.slice(caret)
    const value = `${before}${insertion}${after}`
    const cursor = before.length + insertion.length
    setContent(value)
    setMention(null)
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor="content"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Body (markdown)
        </label>
        <span className="font-dm-mono text-xs text-text-tertiary">
          Words: {words} · ~{minutes} min read
        </span>
      </div>
      <Toolbar
        applyAction={applyAction}
        onImagePick={onImagePick}
        uploading={uploading}
      />
      <ShortcodePanel />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="relative">
          <textarea
            ref={textareaRef}
            id="content"
            value={content}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMention(null)
            }}
            rows={24}
            spellCheck
            className="w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2 font-dm-mono text-sm text-text-primary focus:border-brand-ui focus:outline-none"
            placeholder="# Heading&#10;&#10;Your prose goes here. Type @ to mention another post."
          />
          {mention && (mentionResults.length > 0 || mentionLoading) && (
            <ul className="absolute left-3 right-3 top-full z-30 mt-1 max-h-64 overflow-auto rounded-md border border-border-subtle bg-bg-surface shadow-lg">
              {mentionResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pickMention(r)}
                    className="flex w-full flex-col px-3 py-2 text-left font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
                  >
                    <span>{r.title}</span>
                    <span className="font-dm-mono text-xs text-text-tertiary">
                      ::postlink[{r.slug}]
                    </span>
                  </button>
                </li>
              ))}
              {mentionLoading && mentionResults.length === 0 && (
                <li className="px-3 py-2 font-dm-mono text-xs text-text-tertiary">
                  Searching...
                </li>
              )}
            </ul>
          )}
        </div>
        <div
          className="journal-prose min-h-[420px] overflow-auto rounded-md border border-border-subtle bg-bg-surface p-4"
          dangerouslySetInnerHTML={{
            __html:
              previewHtml ||
              '<p class="text-text-tertiary">Nothing to preview yet.</p>',
          }}
        />
      </div>
    </div>
  )
}

function Toolbar({
  applyAction,
  onImagePick,
  uploading,
}: {
  applyAction: (fn: (s: SelectionState) => SelectionState) => void
  onImagePick: (e: ChangeEvent<HTMLInputElement>) => void
  uploading: boolean
}) {
  const [calloutOpen, setCalloutOpen] = useState(false)

  function callout(kind: 'tip' | 'warning' | 'note' | 'danger') {
    setCalloutOpen(false)
    applyAction((s) =>
      insertBlock(s, `:::${kind}\nBody text.\n:::`, `:::${kind}\n`.length),
    )
  }

  function pullQuote() {
    applyAction((s) =>
      insertBlock(s, `:::pullquote\nQuote text.\n:::`, ':::pullquote\n'.length),
    )
  }

  function toggle() {
    applyAction((s) =>
      insertBlock(
        s,
        `:::toggle Title\nBody.\n:::`,
        ':::toggle '.length,
      ),
    )
  }

  function bookmark() {
    const url = window.prompt('Bookmark URL')
    if (!url) return
    applyAction((s) =>
      insertBlock(s, `::bookmark[${url}]`, `::bookmark[`.length + url.length),
    )
  }

  function youtube() {
    const raw = window.prompt('YouTube URL or video ID')
    if (!raw) return
    const id = extractYouTubeId(raw)
    if (!id) {
      window.alert('Could not parse a YouTube id from that input.')
      return
    }
    applyAction((s) =>
      insertBlock(s, `::youtube[${id}]`, `::youtube[`.length + id.length),
    )
  }

  function link() {
    const href = window.prompt('Link URL') ?? ''
    if (!href) return
    applyAction((s) => wrapSelection(s, '[', `](${href})`, 'link text'))
  }

  function table() {
    const block = [
      '| Column A | Column B |',
      '| --- | --- |',
      '| Cell 1 | Cell 2 |',
      '| Cell 3 | Cell 4 |',
    ].join('\n')
    applyAction((s) => insertBlock(s, block, block.length))
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-border-subtle bg-bg-surface p-1.5">
      <TBtn
        label="H2"
        onClick={() =>
          applyAction((s) => prefixLines(s, '## '))
        }
      />
      <TBtn
        label="H3"
        onClick={() => applyAction((s) => prefixLines(s, '### '))}
      />
      <TSep />
      <TBtn
        label="B"
        title="Bold"
        bold
        onClick={() =>
          applyAction((s) => wrapSelection(s, '**', '**', 'bold text'))
        }
      />
      <TBtn
        label="I"
        title="Italic"
        italic
        onClick={() =>
          applyAction((s) => wrapSelection(s, '*', '*', 'italic text'))
        }
      />
      <TBtn label="Link" title="Link" onClick={link} />
      <TBtn
        label="Code"
        title="Inline code"
        onClick={() =>
          applyAction((s) => wrapSelection(s, '`', '`', 'code'))
        }
      />
      <TBtn
        label="```"
        title="Code block"
        onClick={() =>
          applyAction((s) =>
            insertBlock(s, '```\ncode\n```', '```\n'.length),
          )
        }
      />
      <TBtn
        label="Quote"
        onClick={() => applyAction((s) => prefixLines(s, '> '))}
      />
      <TSep />
      <div className="relative">
        <button
          type="button"
          onClick={() => setCalloutOpen((v) => !v)}
          className="rounded px-2 py-1 font-dm-sans text-xs text-text-primary hover:bg-bg-hover"
        >
          Callout ▾
        </button>
        {calloutOpen && (
          <ul className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] rounded-md border border-border-subtle bg-bg-surface shadow-lg">
            {(['tip', 'warning', 'note', 'danger'] as const).map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => callout(k)}
                  className="block w-full px-3 py-1.5 text-left font-dm-sans text-sm text-text-primary hover:bg-bg-hover"
                >
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <TBtn label="Pull quote" onClick={pullQuote} />
      <TBtn label="Toggle" onClick={toggle} />
      <TSep />
      <label className="cursor-pointer rounded px-2 py-1 font-dm-sans text-xs text-text-primary hover:bg-bg-hover">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onImagePick}
        />
        {uploading ? 'Uploading...' : 'Image'}
      </label>
      <TBtn label="YouTube" onClick={youtube} />
      <TBtn label="Bookmark" onClick={bookmark} />
      <TSep />
      <TBtn label="Table" onClick={table} />
      <TBtn
        label="---"
        title="Horizontal rule"
        onClick={() => applyAction((s) => insertBlock(s, '---', 3))}
      />
    </div>
  )
}

function TBtn({
  label,
  title,
  bold,
  italic,
  onClick,
}: {
  label: ReactNode
  title?: string
  bold?: boolean
  italic?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded px-2 py-1 font-dm-sans text-xs text-text-primary hover:bg-bg-hover ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''}`}
    >
      {label}
    </button>
  )
}

function TSep() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 inline-block h-4 w-px bg-border-subtle"
    />
  )
}
