import { NextResponse } from 'next/server'
import { LEVEL_LABEL, levelForXp } from '@/lib/badges'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchIsFollowing, fetchTasteCompatibility } from '@/lib/queries'
import { fetchProgressProfile } from '@/lib/user-queries'

export const dynamic = 'force-dynamic'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: profileId } = await params
  const viewerId = await getAuthedUserId()
  if (!viewerId) {
    return NextResponse.json(
      {
        viewerId: null,
        isOwnProfile: false,
        isFollowing: false,
        taste: null,
        ownLevel: null,
      },
      { headers: PRIVATE_HEADERS },
    )
  }
  const isOwnProfile = viewerId === profileId
  if (isOwnProfile) {
    const progress = await fetchProgressProfile(profileId)
    const ownLevel = progress
      ? {
          label: LEVEL_LABEL[levelForXp(progress.xp_points).level],
          xp: progress.xp_points,
        }
      : null
    return NextResponse.json(
      {
        viewerId,
        isOwnProfile: true,
        isFollowing: false,
        taste: null,
        ownLevel,
      },
      { headers: PRIVATE_HEADERS },
    )
  }
  const [isFollowing, taste] = await Promise.all([
    fetchIsFollowing({ followerId: viewerId, followingId: profileId }),
    fetchTasteCompatibility({ viewerId, profileId }),
  ])
  return NextResponse.json(
    {
      viewerId,
      isOwnProfile: false,
      isFollowing,
      taste,
      ownLevel: null,
    },
    { headers: PRIVATE_HEADERS },
  )
}
