import Link from 'next/link'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'

export const metadata: Metadata = {
  title: 'Import library · Foxing',
}

export default function LibraryImportPage() {
  return (
    <PageWrapper className="max-w-prose py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Import your library
      </h1>
      <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
        The mobile app handles imports, since that&apos;s where reading
        happens. Open Foxing on your phone and pick a source.
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        <li className="rounded-lg border border-border-subtle bg-bg-surface p-4">
          <h2 className="font-fraunces text-base text-text-primary">
            Goodreads
          </h2>
          <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
            Goodreads → My Books → Import and Export → Export Library. Save
            the CSV, then in the Foxing app go to Library → Import → Goodreads.
          </p>
        </li>
        <li className="rounded-lg border border-border-subtle bg-bg-surface p-4">
          <h2 className="font-fraunces text-base text-text-primary">
            StoryGraph
          </h2>
          <p className="mt-1 font-dm-sans text-sm text-text-tertiary">
            StoryGraph → Manage Account → Export Data. In the Foxing app go
            to Library → Import → StoryGraph and pick the file.
          </p>
        </li>
      </ul>
      <Link
        href="/library"
        className="mt-6 inline-block font-dm-sans text-sm text-brand-text hover:underline"
      >
        Back to library
      </Link>
    </PageWrapper>
  )
}
