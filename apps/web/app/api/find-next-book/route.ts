import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Body {
  mood?: string[]
  pace?: string
  era?: string
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .maybeSingle()
  const tier = (profile as { subscription_tier: string | null } | null)
    ?.subscription_tier
  if (tier !== 'plus' && tier !== 'patron') {
    return NextResponse.json(
      { error: 'subscription_required' },
      { status: 402 },
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = {
    action: 'recommendations',
    mood: body.mood ?? [],
    pace: body.pace ?? 'any',
    era: body.era ?? 'anytime',
  }

  const { data, error } = await supabase.functions.invoke('ai-companion', {
    body: payload,
  })
  if (error) {
    return NextResponse.json(
      { error: 'edge_function_failed', detail: error.message },
      { status: 502 },
    )
  }
  return NextResponse.json(data)
}
