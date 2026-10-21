// A single club thread (auth-gated). Posts arrive live: when another member posts, the
// club WebSocket pushes {t:'post'} and the page revalidates, so the new post appears
// without a manual refresh. This is the two-context DO gate surface -- a post made in
// one browser context shows up in another that has this thread open.
import { redirect, useRevalidator, Link } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { useClubLive } from "~/hooks/use-club-live";
import { useClubWrite } from "~/hooks/use-club-write";
import { getAuth } from "~/lib/auth.server";
import { loadThreadDetail } from "~/lib/clubs.server";
import { requireProfileForUser } from "~/lib/profile.server";
import type { Route } from "./+types/club-thread";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect(`/login?redirect=/clubs/${params.slug}`);
  await requireProfileForUser(env, { id: session.user.id, email: session.user.email });
  const detail = await loadThreadDetail(env, params.slug, params.threadId, session.user.id);
  if (!detail) throw new Response("Not found", { status: 404 });
  return { ...detail, viewerId: session.user.id };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData?.thread?.title ?? "Thread"} | Foxing` },
    { name: "robots", content: "noindex" },
  ];
}

export default function ClubThread({ loaderData }: Route.ComponentProps) {
  const { club, thread, posts, isMember, viewerId } = loaderData;
  const revalidator = useRevalidator();
  const refresh = () => revalidator.revalidate();
  const { write, error, pending } = useClubWrite();

  useClubLive(isMember ? club.id : null, { onPost: refresh, onNotice: refresh });

  async function post(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const content = String(new FormData(form).get("content") ?? "").trim();
    if (!content) return;
    const r = await write(`/threads/${thread.id}/posts`, { body: { content } });
    if (r.ok) {
      form.reset();
      void refresh();
    }
  }

  return (
    <PageShell>
      <Container className="max-w-2xl">
        <Link to={`/clubs/${club.slug}`} className="font-ui text-sm text-brand-text underline">
          &larr; {club.name}
        </Link>
        <h1 className="mt-3 font-display text-3xl">{thread.title}</h1>

        <ul className="mt-8 space-y-4" data-testid="post-list">
          {posts.length === 0 ? (
            <li className="font-ui text-sm text-tertiary">No posts yet. Start the conversation.</li>
          ) : (
            posts.map((p) => (
              <li key={p.id} className="rounded-card border border-border-subtle bg-surface p-4">
                <p className="whitespace-pre-wrap font-body text-primary">{p.content}</p>
                <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-wide text-tertiary">
                  {p.authorId === viewerId ? "You" : "Member"} ·{" "}
                  {new Date(p.createdAt).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>

        {isMember ? (
          <form onSubmit={post} className="mt-8">
            <label htmlFor="content" className="block font-ui text-sm font-medium text-primary">
              Add a reply
            </label>
            <textarea
              id="content"
              name="content"
              rows={3}
              required
              className="mt-1.5 w-full rounded-card border border-border-subtle bg-base px-3 py-2 font-ui text-sm"
            />
            {error ? (
              <p
                className="mt-2 rounded-md border border-danger/50 bg-danger-subtle px-3 py-1.5 font-ui text-xs text-danger-text"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-cover bg-brand-text px-4 py-2 font-ui text-sm text-on-brand disabled:opacity-60 dark:text-[color:var(--section-charcoal)]"
            >
              {pending ? "Posting..." : "Post reply"}
            </button>
          </form>
        ) : null}
      </Container>
    </PageShell>
  );
}
