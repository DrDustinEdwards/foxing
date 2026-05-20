import { NextResponse } from 'next/server'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchMenuStats } from '@/lib/user-queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getAuthedUserId()
  if (!userId) return NextResponse.json(null, { status: 401 })
  const stats = await fetchMenuStats(userId)
  return NextResponse.json(stats)
}
