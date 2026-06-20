import type { ClubThreadSummary } from '@/lib/club-threads'
import type { DiscussionQuestion } from '@/lib/discussion-guide-types'
import type { PublicClub } from '@/lib/queries'
import { DiscussionsSection } from '@/app/clubs/[slug]/discussions-section'
import { ThreadDiscussionPanel } from '@/app/clubs/[slug]/thread-discussion-panel'

export function DiscussionsNode({
  club,
  threads,
  isMember,
  viewerId,
  canModerate,
  lockedChapterDates,
  initialQuestions,
}: {
  club: PublicClub
  threads: ClubThreadSummary[]
  isMember: boolean
  viewerId: string | null
  canModerate: boolean
  lockedChapterDates: Record<string, string>
  initialQuestions: DiscussionQuestion[] | null
}) {
  return (
    <div className="flex flex-col gap-6">
      <DiscussionsSection
        clubId={club.id}
        clubSlug={club.slug ?? club.id}
        threads={threads}
        isMember={isMember}
        viewerId={viewerId}
        canModerate={canModerate}
        lockedChapterDates={lockedChapterDates}
      />
      {club.current_book && club.current_book_id && (
        <ThreadDiscussionPanel
          bookId={club.current_book_id}
          bookSlug={club.current_book.slug}
          bookTitle={club.current_book.title}
          initialQuestions={initialQuestions}
          canGenerate={canModerate}
        />
      )}
    </div>
  )
}
