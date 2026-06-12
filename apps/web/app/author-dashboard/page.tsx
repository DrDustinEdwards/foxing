import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchUnansweredQuestionsForAuthor } from '@/lib/author-qa'
import { fetchGiveawaysByAuthor } from '@/lib/giveaways'
import { AnswerForm } from './answer-form'
import { CreateGiveawayForm } from './create-giveaway-form'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Author dashboard · Foxing',
  robots: { index: false, follow: false },
}

export default async function AuthorDashboardPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in?next=/author-dashboard')
  const sb = await createClient()
  const { data } = await sb
    .from('profiles')
    .select('is_verified_author')
    .eq('id', userId)
    .maybeSingle()
  if (!(data as { is_verified_author: boolean | null } | null)
    ?.is_verified_author) {
    redirect('/settings')
  }
  const [questions, giveaways] = await Promise.all([
    fetchUnansweredQuestionsForAuthor(userId),
    fetchGiveawaysByAuthor(userId),
  ])

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
        <h2 className="mb-3 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
          Giveaways ({giveaways.length})
        </h2>
        <CreateGiveawayForm />
        {giveaways.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {giveaways.slice(0, 5).map((g) => (
              <li
                key={g.id}
                className="rounded-md border border-border-subtle bg-bg-surface p-3"
              >
                <a
                  href={`/giveaways/${g.id}`}
                  className="font-fraunces text-sm text-text-primary hover:text-brand-text"
                >
                  {g.title}
                </a>
                <p className="font-dm-mono text-xs text-text-tertiary">
                  Ends {new Date(g.deadline).toLocaleString('en-US')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
          Unanswered questions ({questions.length})
        </h2>
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
