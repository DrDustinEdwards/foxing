import Link from 'next/link'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'

export const metadata: Metadata = {
  title: 'New list · Foxing',
}

export default function NewListPage() {
  return (
    <PageWrapper className="max-w-prose py-10">
      <PageHeader
        title="Create a list"
        subtitle="Lists are coming. Build one in the Foxing app for now and it'll show up here."
        subtitleVariant="description"
      />
      <Link
        href="/my-lists"
        className="mt-6 inline-block font-dm-sans text-sm text-brand-text hover:underline"
      >
        Back to lists
      </Link>
    </PageWrapper>
  )
}
