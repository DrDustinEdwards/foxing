import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchUnansweredQuestionsForAuthor } from '@/lib/author-qa'
import { AnswerForm } from './answer-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Author dashboard · Foxing',
  robots: { index: false, follow: false },
}

export default async function AuthorDashboardPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in?next=/author-dashboard')
  const sb = createClient()
  const { data } = await sb
    .from('profiles')
    .select('is_verified_author')
    .eq('id', userId)
    .maybeSingle()
  if (!(data as { is_verified_author: boolean | null } | null)
    ?.is_verified_author) {
    redirect('/settings')
  }
  const questions = await fetchUnansweredQuestionsForAuthor(userId)

  return (
    <PageWrapper className="py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-fraunces text-[2rem] text-text-primary">
          Author dashboard
        </h1>
        <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
          Unanswered questions from readers, sorted by upvotes.
        </p>
      </header>

      <section className="mt-8">
        {questions.length === 0 ? (
          <p className="font-source-serif-4 text-base text-text-tertiary">
            No questions waiting right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {questions.map((q) => (
              <li
                key={q.id}
                className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-source-serif-4 text-base text-text-primary">
                    {q.question}
                  </p>
                  <span className="rounded-full bg-bg-sunken px-2 py-0.5 font-dm-mono text-xs text-text-tertiary">
                    ▲ {q.upvote_count}
                  </span>
                </div>
                {q.asker && (
                  <p className="font-dm-sans text-xs text-text-tertiary">
                    Asked by @{q.asker.username}
                  </p>
                )}
                <AnswerForm questionId={q.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageWrapper>
  )
}
