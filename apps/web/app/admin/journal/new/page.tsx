import Link from 'next/link'
import type { Metadata } from 'next'
import { JournalEditor } from '../editor'

export const metadata: Metadata = {
  title: 'New journal post · Admin · Foxing',
}

export default function NewJournalPostPage() {
  return (
    <div className="p-6 md:p-10">
      <p className="mb-4 font-dm-sans text-sm">
        <Link
          href="/admin/journal"
          className="text-brand-text hover:underline"
        >
          ← Journal
        </Link>
      </p>
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        New post
      </h1>
      <div className="mt-6">
        <JournalEditor
          initial={{
            id: null,
            title: '',
            slug: '',
            excerpt: '',
            cover_image_url: '',
            tags: [],
            content: '',
            is_published: false,
            featured: false,
            og_title: '',
            og_description: '',
            canonical_url: '',
            published_at: null,
            updated_at: null,
          }}
        />
      </div>
    </div>
  )
}
