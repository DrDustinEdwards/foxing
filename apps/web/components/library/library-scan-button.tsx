'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BarcodeScannerModal } from '@/components/library/barcode-scanner-modal'

export function LibraryScanButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Scan
      </Button>
      <BarcodeScannerModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
