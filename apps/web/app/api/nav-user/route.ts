import { NextResponse } from 'next/server'
import { getNavUser, getUnreadNotificationCount } from '@/lib/nav-user'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [user, unread] = await Promise.all([
    getNavUser(),
    getUnreadNotificationCount(),
  ])
  return NextResponse.json(
    { user, unread },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
