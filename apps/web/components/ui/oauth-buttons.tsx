interface OAuthButtonsProps {
  onSelect: (provider: 'apple' | 'google') => void
  disabled?: boolean
}

export function OAuthButtons({ onSelect, disabled }: OAuthButtonsProps) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect('apple')}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-text-primary font-dm-sans text-sm font-medium text-bg-base hover:bg-text-secondary disabled:opacity-50"
      >
        Continue with Apple
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect('google')}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border-interactive bg-bg-surface font-dm-sans text-sm font-medium text-text-primary hover:bg-bg-hover disabled:opacity-50"
      >
        Continue with Google
      </button>
    </div>
  )
}
