'use client'

import { ConfirmActionButton } from '@/components/ui/confirm-action-button'
import { deleteBookmark } from './actions'

export function BookmarkDeleteButton({
  bookmarkId,
  bookSlug,
}: {
  bookmarkId: string
  bookSlug: string | null
}) {
  const fields: Record<string, string> = { bookmark_id: bookmarkId }
  if (bookSlug) fields.book_slug = bookSlug
  return (
    <ConfirmActionButton
      action={deleteBookmark}
      fields={fields}
      confirmText="Delete this bookmark?"
      label="Delete"
      pendingLabel="Removing..."
      className="font-dm-mono text-xs text-text-tertiary hover:text-error disabled:opacity-50"
    />
  )
}
