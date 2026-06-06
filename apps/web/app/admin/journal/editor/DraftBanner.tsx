'use client'

export function DraftBanner({
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
