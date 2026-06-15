import { PageHeader } from '@/components/ui/page-header'

interface Tool {
  name: string
  description: string
}

interface Server {
  name: string
  url: string
  description: string
  tools: Tool[]
}

const SERVERS: Server[] = [
  {
    name: 'Foxing Admin MCP',
    url: 'https://admin-mcp.foxing.app/mcp',
    description:
      'Platform management and debugging tools. Connected to Supabase, Vercel, and Sentry. Used by Claude for planning sessions and incident diagnosis.',
    tools: [
      {
        name: 'get_platform_snapshot',
        description: 'Users, books, sessions, deploys at a glance',
      },
      {
        name: 'get_catalog_health',
        description: 'Missing covers, EPUBs, slugs, duplicate entries',
      },
      {
        name: 'get_recent_errors',
        description: 'Sentry errors for web and mobile',
      },
      {
        name: 'get_runtime_logs',
        description: 'Filtered Vercel runtime logs',
      },
      {
        name: 'get_404_log',
        description: 'Recent 404s grouped by path',
      },
      {
        name: 'get_user',
        description: 'Look up any user by username or email',
      },
      {
        name: 'list_recent_signups',
        description: 'Latest signups with tier and activity',
      },
      {
        name: 'check_book',
        description: 'Diagnose a specific book by slug or ID',
      },
      {
        name: 'check_user_state',
        description: 'Full user diagnostic across all tables',
      },
      {
        name: 'award_badge',
        description: 'Manually award a badge to a user',
      },
      {
        name: 'set_user_tier',
        description: 'Set a user to Free or Plus',
      },
      {
        name: 'suspend_user',
        description: 'Suspend a user with a reason',
      },
      {
        name: 'unsuspend_user',
        description: 'Unsuspend a user',
      },
      {
        name: 'set_botm',
        description: 'Set the Book of the Month',
      },
      {
        name: 'create_journal_post',
        description: 'Publish a journal post',
      },
      {
        name: 'get_celebrity_picks_status',
        description: 'Check which clubs have picks this month',
      },
      {
        name: 'trigger_edge_function',
        description: 'Manually run a Supabase edge function',
      },
    ],
  },
  {
    name: 'Foxing Vault MCP',
    url: 'https://foxing-vault.vercel.app/mcp',
    description:
      'Read and write markdown files in the Foxing vault. Persistent memory and spec storage across all Claude sessions.',
    tools: [
      { name: 'read_file', description: 'Read any vault file by name' },
      { name: 'write_file', description: 'Write or update a vault file' },
      { name: 'list_files', description: 'List all markdown files in the vault' },
    ],
  },
]

export default function McpPage() {
  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <PageHeader
          title="MCP Servers"
          subtitle="Model Context Protocol servers connected to Claude.ai for admin and planning sessions."
          subtitleVariant="description"
        />
      </div>
      <div className="flex flex-col gap-6">
        {SERVERS.map((server) => (
          <ServerCard key={server.name} server={server} />
        ))}
      </div>
    </div>
  )
}

function ServerCard({ server }: { server: Server }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border-subtle bg-bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-border-subtle bg-bg-sunken px-6 py-4">
        <div className="min-w-0">
          <p className="truncate font-fraunces text-xl text-text-primary">
            {server.name}
          </p>
          <p className="truncate font-dm-mono text-xs text-text-tertiary">
            {server.url}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-success-bg px-2 py-0.5 font-dm-mono text-xs text-success">
          Connected
        </span>
      </header>
      <p className="border-b border-border-subtle px-6 py-4 font-source-serif-4 text-sm text-text-secondary">
        {server.description}
      </p>
      <div className="grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-2">
        {server.tools.map((tool) => (
          <div key={tool.name} className="flex items-start gap-3">
            <span className="font-dm-mono text-xs text-brand-text">
              {tool.name}
            </span>
            <span className="font-dm-sans text-sm text-text-secondary">
              {tool.description}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
