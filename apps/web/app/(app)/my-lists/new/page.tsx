import Link from 'next/link'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'

export const metadata: Metadata = {
  title: 'New list · Foxing',
}

export default function NewListPage() {
  return (
    <PageWrapper className="max-w-prose py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Create a list
      </h1>
      <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
        Lists are coming. Build one in the Foxing app for now and it&apos;ll
        show up here.
      </p>
      <Link
        href="/my-lists"
        className="mt-6 inline-block font-dm-sans text-sm text-brand-text hover:underline"
      >
        Back to lists
      </Link>
    </PageWrapper>
  )
}
