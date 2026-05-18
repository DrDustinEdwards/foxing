import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchPublicChallenges,
  type ChallengeRow,
} from '@/lib/missing-pages-queries'
import { buildChallengesIndexMetadata } from '@/lib/metadata'
import { getNavUser } from '@/lib/nav-user'

export const revalidate = 600

export const metadata: Metadata = buildChallengesIndexMetadata()

export default async function ChallengesPage() {
  const [navUser, challenges] = await Promise.all([
    getNavUser(),
    fetchPublicChallenges(),
  ])
  const active = challenges.filter((c) => c.is_active)
  const past = challenges.filter((c) => !c.is_active)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-2">
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              Reading challenges
            </h1>
            <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
              Join a community challenge and read alongside thousands of others.
            </p>
          </header>

          {challenges.length === 0 ? (
            <div className="mt-10 rounded-lg border border-border-subtle bg-bg-surface p-8 text-center">
              <p className="font-fraunces text-lg text-text-primary">
                Reading challenges, coming soon.
              </p>
              <p className="mt-2 font-source-serif-4 text-sm text-text-tertiary">
                Sign up to be notified when the first community challenges open.
              </p>
              <div className="mt-4 inline-flex">
                <Link href="/sign-up">
                  <Button variant="primary" size="sm">
                    Join Foxing
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <section className="mt-10">
                  <h2 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                    Active
                  </h2>
                  <ul className="mt-3 flex flex-col gap-3">
                    {active.map((c) => (
                      <ChallengeCard key={c.id} challenge={c} active />
                    ))}
                  </ul>
                </section>
              )}
              {past.length > 0 && (
                <section className="mt-10">
                  <h2 className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                    Past
                  </h2>
                  <ul className="mt-3 flex flex-col gap-3">
                    {past.map((c) => (
                      <ChallengeCard key={c.id} challenge={c} active={false} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function ChallengeCard({
  challenge,
  active,
}: {
  challenge: ChallengeRow
  active: boolean
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-fraunces text-lg text-text-primary">
          {challenge.title}
        </h3>
        {challenge.description && (
          <p className="line-clamp-2 max-w-prose font-source-serif-4 text-sm text-text-secondary">
            {challenge.description}
          </p>
        )}
        <p className="font-dm-mono text-[11px] text-text-tertiary">
          {challenge.participant_count} participants
          {challenge.end_date && (
            <span>
              {' · '}
              {active ? 'ends' : 'ended'} {challenge.end_date}
            </span>
          )}
        </p>
      </div>
      {active && (
        <div className="shrink-0">
          <Link href="/sign-up">
            <Button variant="primary" size="sm">
              Join challenge
            </Button>
          </Link>
        </div>
      )}
    </li>
  )
}
