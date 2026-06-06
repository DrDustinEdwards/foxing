'use client'

export function FeaturedToggle({
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
