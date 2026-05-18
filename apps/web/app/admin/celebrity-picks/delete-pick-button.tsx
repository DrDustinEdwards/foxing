'use client'

import { useTransition } from 'react'
import { deleteCelebrityPick } from './actions'

export function DeletePickButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!window.confirm('Remove this pick?')) return
    const fd = new FormData()
    fd.set('id', id)
    startTransition(() => {
      void deleteCelebrityPick(fd)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="font-dm-sans text-sm text-error hover:underline disabled:opacity-50"
    >
      {pending ? 'Removing...' : 'Remove'}
    </button>
  )
}
