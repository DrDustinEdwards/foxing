'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/**
 * Accessible select-only listbox -- the shared replacement for native <select>,
 * styled to match the app's rounded-full pill controls (no OS-native chrome).
 *
 * - Controlled (`value` + `onChange`) OR uncontrolled (`defaultValue`).
 * - `name` renders a hidden input so it still submits inside a native <form>.
 * - Per-option `count` (shown trailing) and `disabled` (e.g. 0-result facets).
 * - Keyboard: arrows / Home / End / Enter / Space / Esc / typeahead.
 * - ARIA: button[aria-haspopup=listbox] + ul[role=listbox] + li[role=option]
 *   with aria-activedescendant; focus moves into the list and back to the
 *   trigger on close.
 */
export interface SelectOption {
  value: string
  label: string
  count?: number
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  /** Renders a hidden input so the value submits with a native <form>. */
  name?: string
  /** Shown when the current value matches no option (e.g. the "Any" state). */
  placeholder?: string
  disabled?: boolean
  required?: boolean
  id?: string
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

const sizeCls = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-4 text-base',
} as const

function firstEnabled(options: SelectOption[]): number {
  return options.findIndex((o) => !o.disabled)
}
function lastEnabled(options: SelectOption[]): number {
  for (let i = options.length - 1; i >= 0; i--) if (!options[i].disabled) return i
  return -1
}

export function Select({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  name,
  placeholder = 'Select',
  disabled = false,
  required = false,
  id,
  size = 'sm',
  className,
  'aria-label': ariaLabel,
}: SelectProps) {
  const isControlled = controlledValue !== undefined
  const [internal, setInternal] = useState(defaultValue ?? '')
  const value = isControlled ? controlledValue : internal

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  // The listbox is portaled to <body> with fixed positioning so it is never
  // clipped by an overflow ancestor (e.g. the FilterBar's scrollable Filters
  // popover) -- the way a native <select> popup escapes its container.
  const [pos, setPos] = useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    maxHeight: number
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef({ buf: '', t: 0 })
  const baseId = useId()
  const listId = `${baseId}-list`

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const spaceAbove = r.top
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow
    setPos({
      left: r.left,
      width: r.width,
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.min(264, (openUp ? spaceAbove : spaceBelow) - 8),
    })
  }, [])

  const selected = options.find((o) => o.value === value) ?? null
  const selectedIndex = options.findIndex((o) => o.value === value)

  const commit = useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  const close = useCallback((focusTrigger = true) => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }, [])

  const openList = useCallback(() => {
    if (disabled) return
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabled(options))
    updatePosition()
    setOpen(true)
  }, [disabled, options, selectedIndex, updatePosition])

  // Close on an outside pointer press (the listbox lives in a portal, so check
  // both the root and the list).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!rootRef.current?.contains(t) && !listRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  // Keep the portaled list aligned to the trigger while open.
  useEffect(() => {
    if (!open) return
    const onMove = () => updatePosition()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, updatePosition])

  // Move focus into the list when it opens; keep the active option in view.
  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])
  useEffect(() => {
    if (!open || activeIndex < 0) return
    document
      .getElementById(`${baseId}-opt-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, baseId])

  const move = (dir: 1 | -1) => {
    setActiveIndex((i) => {
      let n = i
      for (let step = 0; step < options.length; step++) {
        n = (n + dir + options.length) % options.length
        if (!options[n]?.disabled) return n
      }
      return i
    })
  }

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(firstEnabled(options))
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(lastEnabled(options))
        break
      case 'Enter':
      case ' ': {
        e.preventDefault()
        const opt = options[activeIndex]
        if (opt && !opt.disabled) {
          commit(opt.value)
          close()
        }
        break
      }
      case 'Escape':
        e.preventDefault()
        // Consume it so a parent overlay (e.g. the FilterBar popover) does not
        // also close on the same keypress.
        e.stopPropagation()
        close()
        break
      case 'Tab':
        close(false)
        break
      default:
        if (e.key.length === 1) {
          const now = Date.now()
          typeahead.current.buf =
            now - typeahead.current.t > 700
              ? e.key
              : typeahead.current.buf + e.key
          typeahead.current.t = now
          const buf = typeahead.current.buf.toLowerCase()
          const idx = options.findIndex(
            (o) => !o.disabled && o.label.toLowerCase().startsWith(buf),
          )
          if (idx >= 0) setActiveIndex(idx)
        }
    }
  }

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (open) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openList()
    }
  }

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      {name && (
        <input type="hidden" name={name} value={value} required={required} />
      )}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'inline-flex w-full items-center justify-between gap-2 rounded-full border border-border-subtle bg-bg-surface font-dm-sans text-text-primary transition-colors hover:border-border-interactive focus:border-border-interactive focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          sizeCls[size],
        )}
      >
        <span className={cn('truncate', !selected && 'text-text-tertiary')}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className={cn('shrink-0 transition-transform', open && 'rotate-180')}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open &&
        pos &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={
              activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined
            }
            onKeyDown={onListKeyDown}
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              minWidth: pos.width,
              maxHeight: pos.maxHeight,
            }}
            className="z-50 overflow-auto rounded-xl border border-border-subtle bg-bg-surface p-1 shadow-md focus:outline-none"
          >
          {options.map((opt, i) => {
            const isSelected = opt.value === value
            const isActive = i === activeIndex
            return (
              <li
                key={opt.value}
                id={`${baseId}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                onPointerEnter={() => !opt.disabled && setActiveIndex(i)}
                onClick={() => {
                  if (!opt.disabled) {
                    commit(opt.value)
                    close()
                  }
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-1.5 font-dm-sans text-sm text-text-primary',
                  isActive && !opt.disabled && 'bg-brand-subtle text-brand-subtle-text',
                  isSelected && 'font-medium',
                  opt.disabled && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="truncate">{opt.label}</span>
                {opt.count != null && (
                  <span className="shrink-0 font-dm-mono text-[0.6875rem] opacity-70">
                    {opt.count}
                  </span>
                )}
              </li>
            )
          })}
          </ul>,
          document.body,
        )}
    </div>
  )
}
