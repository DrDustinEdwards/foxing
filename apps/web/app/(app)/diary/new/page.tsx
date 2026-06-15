import Link from 'next/link'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = {
  title: 'New diary entry · Foxing',
}

export default function NewDiaryEntryPage() {
  return (
    <PageWrapper className="max-w-prose py-10">
      <PageHeader
        title="Log a book"
        subtitle="Log entries from the Foxing app for now. Pick the book, pick the date, rate it, write what you want. The form will land on the web soon."
        subtitleVariant="description"
      />
      <Link
        href="/diary"
        className="mt-6 inline-block font-dm-sans text-sm text-brand-text hover:underline"
      >
        Back to diary
      </Link>
    </PageWrapper>
  )
}
