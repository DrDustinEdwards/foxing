'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PhotoQuoteModal } from '@/components/commonplace/photo-quote-modal'

interface InitialBook {
  id: string
  title: string
  author: string
}

interface Props {
  initialBook?: InitialBook
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function PhotoQuoteButton({
  initialBook,
  label = 'Capture passage',
  variant = 'secondary',
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <PhotoQuoteModal
        open={open}
        onClose={() => setOpen(false)}
        initialBook={initialBook}
      />
    </>
  )
}
