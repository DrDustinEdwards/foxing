import { Avatar } from '@/components/ui/avatar'
import { ClubSectionHeader } from './club-section-header'
import { InviteGenerator } from './invite-generator'
import { LeaveClubButton } from './leave-club-button'
import { MemberManageControls } from './member-manage-controls'

export interface MemberRosterEntry {
  user_id: string
  role: 'admin' | 'moderator' | 'member'
  joined_at: string
  username: string
  display_name: string
  avatar_url: string | null
}

const ROLE_LABEL: Record<MemberRosterEntry['role'], string | null> = {
  admin: 'Admin',
  moderator: 'Moderator',
  member: null,
}

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function MembersSection({
  members,
  clubId,
  clubSlug,
  viewerId,
  viewerRole,
  creatorId,
}: {
  members: MemberRosterEntry[]
  clubId: string
  clubSlug: string
  viewerId: string | null
  viewerRole: 'admin' | 'moderator' | 'member' | null
  creatorId: string | null
}) {
  const viewerIsAdmin = viewerRole === 'admin'
  const viewerIsMod = viewerRole === 'admin' || viewerRole === 'moderator'
  const isMember = viewerRole !== null
  const canLeave = isMember && viewerId !== null && viewerId !== creatorId

  return (
    <section className="flex flex-col gap-4">
      <ClubSectionHeader
        title={
          <>
            Members
            <span className="ml-2 font-dm-sans text-sm font-normal text-text-tertiary">
              {members.length}
            </span>
          </>
        }
      />

      {viewerIsAdmin && <InviteGenerator clubId={clubId} clubSlug={clubSlug} />}

      {members.length === 0 ? (
        <p className="font-source-serif-4 text-base text-text-secondary">
          No members yet.
        </p>
      ) : (
        <ul className="grid gap-2">
          {members.map((m) => {
            const roleLabel = ROLE_LABEL[m.role]
            const isSelf = m.user_id === viewerId
            const isCreator = m.user_id === creatorId
            const canManageRole = viewerIsAdmin && !isSelf && !isCreator
            const canRemove =
              viewerIsMod &&
              !isSelf &&
              !isCreator &&
              (viewerIsAdmin || m.role === 'member')
            return (
              <li
                key={m.user_id}
                className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface p-3"
              >
                <Avatar src={m.avatar_url} name={m.display_name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-dm-sans text-sm text-text-primary">
                    {m.display_name}
                  </p>
                  <p className="truncate font-dm-mono text-xs text-text-tertiary">
                    @{m.username} · joined {formatJoined(m.joined_at)}
                  </p>
                </div>
                {roleLabel && (
                  <span className="shrink-0 rounded-full bg-brand-subtle px-2 py-0.5 font-dm-mono text-[0.625rem] uppercase tracking-wider text-brand-subtle-text">
                    {roleLabel}
                  </span>
                )}
                {(canManageRole || canRemove) && (
                  <MemberManageControls
                    clubId={clubId}
                    userId={m.user_id}
                    role={m.role}
                    canManageRole={canManageRole}
                    canRemove={canRemove}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canLeave && (
        <div className="border-t border-border-subtle pt-4">
          <LeaveClubButton clubId={clubId} />
        </div>
      )}
    </section>
  )
}
