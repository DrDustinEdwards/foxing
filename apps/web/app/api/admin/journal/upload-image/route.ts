import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUserId } from '@/lib/nav-user'

const BUCKET = 'journal-images'
const MAX_BYTES = 5 * 1024 * 1024
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminUserId()
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const form = await request.formData()
  const file = form.get('image')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'image field required' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large' }, { status: 400 })
  }
  const ext = MIME_EXT[file.type]
  if (!ext) {
    return NextResponse.json(
      { error: 'unsupported file type' },
      { status: 400 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const filename = `journal-${Date.now()}.${ext}`
  const admin = createAdminClient()
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: file.type, upsert: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`
  return NextResponse.json({ url })
}
