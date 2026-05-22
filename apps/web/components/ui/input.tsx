import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy =
    [error ? errorId : null, hint && !error ? hintId : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="font-dm-sans text-sm text-text-secondary"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-11 rounded-md border bg-bg-surface px-3 text-base text-text-primary',
          'font-dm-sans placeholder:text-text-tertiary',
          'transition-[border-color,box-shadow] duration-150',
          error
            ? 'border-[var(--error-border-interactive)]'
            : 'border-border-interactive',
          'focus:outline-none focus:ring-2 focus:ring-border-focus/40 focus:border-border-focus',
          className,
        )}
        {...props}
      />
      {error ? (
        <span id={errorId} className="text-sm text-error">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="text-sm text-text-tertiary">
          {hint}
        </span>
      ) : null}
    </div>
  )
})
