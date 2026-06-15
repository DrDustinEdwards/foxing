import Link from 'next/link'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { GoodreadsImporter } from './goodreads-importer'

export const metadata: Metadata = {
  title: 'Import library · Foxing',
  robots: { index: false, follow: false },
}

export default function LibraryImportPage() {
  return (
    <PageWrapper className="max-w-2xl py-10">
      <PageHeader
        title="Import your library"
        subtitle="Upload your Goodreads export. Foxing matches each book by title and author, copies your rating and review, and places it on the right shelf. You see a preview before anything is saved."
        subtitleVariant="description"
      />

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
