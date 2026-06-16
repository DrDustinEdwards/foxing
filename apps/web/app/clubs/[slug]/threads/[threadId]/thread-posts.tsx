import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import type { ClubThreadPost } from '@/lib/club-threads'
import { PostContent } from './post-content'
import { ThreadPostActions } from './thread-post-actions'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Renders a thread's posts as a nested reply tree via parent_post_id. Replies
 * indent under their parent; spoiler/removed handling lives in <PostContent>.
 */
export function ThreadPosts({
  posts,
  threadId,
  viewerId,
  savedSet,
  likedSet,
}: {
  posts: ClubThreadPost[]
  threadId: string
  viewerId: string
  savedSet: Set<string>
  likedSet: Set<string>
}) {
  const byParent = new Map<string | null, ClubThreadPost[]>()
  for (const p of posts) {
    const key = p.parent_post_id ?? null
    const arr = byParent.get(key) ?? []
    arr.push(p)
    byParent.set(key, arr)
  }

  function render(parentId: string | null, depth: number): ReactNode {
    const children = byParent.get(parentId) ?? []
    if (children.length === 0) return null
    return (
      <ul
        className={
          depth > 0
            ? 'flex flex-col gap-4 border-l border-border-subtle pl-4'
            : 'flex flex-col gap-4'
        }
      >
        {children.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-border-subtle bg-bg-surface p-4"
          >
            <header className="flex items-start gap-3">
              <Avatar
                src={p.author?.avatar_url ?? null}
                name={p.author?.display_name ?? 'Reader'}
                size="sm"
              />
              <div className="flex flex-col leading-tight">
                <span className="font-dm-sans text-sm text-text-primary">
                  {p.author?.display_name ?? 'Reader'}
                </span>
                <time className="font-dm-mono text-xs text-text-tertiary">
                  {formatTime(p.created_at)}
                  {p.updated_at &&
                    p.updated_at !== p.created_at &&
                    ' · edited'}
                </time>
              </div>
            </header>

            <PostContent
              content={p.content}
              hasSpoiler={Boolean(p.has_spoiler)}
              isRemoved={Boolean(p.is_removed)}
              removedReason={p.removed_reason}
            />

            {!p.is_removed && (
              <ThreadPostActions
                postId={p.id}
                threadId={threadId}
                isOwn={p.author_id === viewerId}
                initialSaved={savedSet.has(p.id)}
                initialLiked={likedSet.has(p.id)}
                initialLikeCount={p.like_count ?? 0}
                initialContent={p.content}
              />
            )}

            {render(p.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }

  return render(null, 0)
}
