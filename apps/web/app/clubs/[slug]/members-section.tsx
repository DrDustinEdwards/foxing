import { Avatar } from '@/components/ui/avatar'

export interface MemberRosterEntry {
  user_id: string
  role: 'admin' | 'moderator' | 'member'
  username: string
  display_name: string
  avatar_url: string | null
}

const ROLE_LABEL: Record<MemberRosterEntry['role'], string | null> = {
  admin: 'Admin',
  moderator: 'Moderator',
  member: null,
}

export function MembersSection({ members }: { members: MemberRosterEntry[] }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="font-fraunces text-xl text-text-primary">
        Members
        <span className="ml-2 font-dm-sans text-sm font-normal text-text-tertiary">
          {members.length}
        </span>
      </h2>
      {members.length === 0 ? (
        <p className="font-source-serif-4 text-base text-text-secondary">
          No members yet.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {members.map((m) => {
            const roleLabel = ROLE_LABEL[m.role]
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
                    @{m.username}
                  </p>
                </div>
                {roleLabel && (
                  <span className="shrink-0 rounded-full bg-brand-subtle px-2 py-0.5 font-dm-mono text-[0.625rem] uppercase tracking-wider text-brand-subtle-text">
                    {roleLabel}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
