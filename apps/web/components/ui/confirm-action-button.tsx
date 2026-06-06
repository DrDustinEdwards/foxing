'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ConfirmActionButtonProps {
  action: (fd: FormData) => Promise<unknown>
  fields: Record<string, string>
  confirmText: string
  label: string
  pendingLabel: string
  className?: string
}

export function ConfirmActionButton({
  action,
  fields,
  confirmText,
  label,
  pendingLabel,
  className,
}: ConfirmActionButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm(confirmText)) return
        setPending(true)
        const fd = new FormData()
        for (const [key, value] of Object.entries(fields)) {
          fd.set(key, value)
        }
        await action(fd)
        setPending(false)
        router.refresh()
      }}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  )
}
