'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { redeemClubInvite } from '@/app/clubs/[slug]/actions'

interface Props {
  clubId: string
  clubSlug: string
  code: string
}

export function JoinViaInviteButton({ clubId, clubSlug, code }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('club_id', clubId)
    fd.set('code', code)
    const res = await redeemClubInvite(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.push(`/clubs/${clubSlug}`)
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="primary"
        size="md"
        loading={pending}
        onClick={handleClick}
      >
        Accept invite and join
      </Button>
      {error && <p className="font-dm-sans text-sm text-error">{error}</p>}
    </div>
  )
}
