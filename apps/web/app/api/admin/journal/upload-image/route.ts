import { NextResponse, type NextRequest } from 'next/server'
import { uploadToR2 } from '@/lib/r2'
import { requireAdminUserId } from '@/lib/nav-user'

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
  try {
    const url = await uploadToR2('journalImages', filename, buffer, file.type)
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
