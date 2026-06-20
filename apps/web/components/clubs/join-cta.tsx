import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RequestJoinButton } from '@/app/clubs/[slug]/request-join-button'
import { WaitlistButton } from '@/app/clubs/[slug]/waitlist-button'
import { JoinClubButton } from '@/app/clubs/[slug]/join-club-button'

export function JoinCta({
  clubId,
  slug,
  userId,
  isFull,
  isOnWaitlist,
  requiresApproval,
  membershipStatus,
}: {
  clubId: string
  slug: string
  userId: string | null
  isFull: boolean
  isOnWaitlist: boolean
  requiresApproval: boolean
  membershipStatus: 'active' | 'pending' | 'banned' | 'muted' | null
}) {
  if (isFull) {
    if (userId) {
      return <WaitlistButton clubId={clubId} onWaitlist={isOnWaitlist} />
    }
    return (
      <Link href="/sign-in">
        <Button variant="primary" size="md">
          Sign in to join waitlist
        </Button>
      </Link>
    )
  }
  if (requiresApproval) {
    if (userId) {
      return (
        <RequestJoinButton
          clubId={clubId}
          alreadyPending={membershipStatus === 'pending'}
        />
      )
    }
    return (
      <Link href={`/sign-in?next=/clubs/${slug}`}>
        <Button variant="primary" size="md">
          Sign in to request to join
        </Button>
      </Link>
    )
  }
  if (userId) {
    return <JoinClubButton clubId={clubId} />
  }
  return (
    <Link href={`/sign-in?next=/clubs/${slug}`}>
      <Button variant="primary" size="md">
        Sign in to join
      </Button>
    </Link>
  )
}
