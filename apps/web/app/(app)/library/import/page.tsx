import Link from 'next/link'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { GoodreadsImporter } from './goodreads-importer'

export const metadata: Metadata = {
  title: 'Import library · Foxing',
  robots: { index: false, follow: false },
}

export default function LibraryImportPage() {
  return (
    <PageWrapper className="max-w-2xl py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Import your library
      </h1>
      <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
        Upload your Goodreads export. Foxing matches each book by title and
        author, copies your rating and review, and places it on the right
        shelf. You see a preview before anything is saved.
      </p>

      <div className="mt-6">
        <GoodreadsImporter />
      </div>

      <p className="mt-6 font-dm-sans text-xs text-text-tertiary">
        StoryGraph exports are JSON and not yet supported on the web. Open
        the Foxing app and use Library → Import → StoryGraph.
      </p>

      <Link
        href="/library"
        className="mt-6 inline-block font-dm-sans text-sm text-brand-text hover:underline"
      >
        Back to library
      </Link>
    </PageWrapper>
  )
}
