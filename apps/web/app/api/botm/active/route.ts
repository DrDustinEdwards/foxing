import { NextResponse } from 'next/server'
import { fetchActiveBOTM } from '@/lib/botm-queries'

export const revalidate = 3600

export async function GET() {
  const botm = await fetchActiveBOTM()
  return NextResponse.json(botm)
}
