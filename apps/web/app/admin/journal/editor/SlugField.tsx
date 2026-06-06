'use client'

export function SlugField({
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
