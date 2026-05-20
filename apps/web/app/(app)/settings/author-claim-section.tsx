'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AuthorClaim } from '@/lib/author-claims-types'
import { submitAuthorClaim } from './author-claim-actions'

interface Props {
  claim: AuthorClaim | null
}

export function AuthorClaimSection({ claim }: Props) {
  const router = useRouter()
  const [authorName, setAuthorName] = useState(claim?.author_name ?? '')
  const [website, setWebsite] = useState(claim?.website_url ?? '')
  const [email, setEmail] = useState(claim?.contact_email ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('author_name', authorName)
    if (website) fd.set('website_url', website)
    fd.set('contact_email', email)
    const res = await submitAuthorClaim(fd)
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSubmitted(true)
    router.refresh()
  }

  if (claim?.status === 'verified') {
    return (
      <div className="flex flex-col gap-2">
        <Badge variant="success" className="w-fit">
          Verified author
        </Badge>
        <p className="font-source-serif-4 text-sm text-text-secondary">
          You appear as a verified author at /author/{claim.author_name}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="font-source-serif-4 text-sm text-text-secondary">
        Claim your author profile by verifying an email at the same domain as
        your author website. Verified authors can answer reader questions and
        run giveaways.
      </p>
      {claim?.status === 'pending' && !submitted && (
        <Badge variant="warning" className="w-fit">
          Pending verification
        </Badge>
      )}
      {claim?.status === 'rejected' && (
        <Badge variant="neutral" className="w-fit">
          Previous claim rejected. You can submit again.
        </Badge>
      )}
      {submitted && (
        <Badge variant="info" className="w-fit">
          Check your email for the verification link.
        </Badge>
      )}
      <Input
        label="Author name"
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        maxLength={80}
        required
      />
      <Input
        label="Author website (optional)"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        placeholder="https://example.com"
        maxLength={200}
      />
      <Input
        label="Contact email (on that domain)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        maxLength={200}
        required
      />
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={pending}
          disabled={!authorName.trim() || !email.trim()}
        >
          {claim ? 'Resubmit claim' : 'Submit claim'}
        </Button>
      </div>
    </form>
  )
}
