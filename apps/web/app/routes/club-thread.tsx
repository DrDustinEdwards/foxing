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
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
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
      <Container>
        <Link to={`/clubs/${club.slug}`} className="fx-club-thread-link">
          &larr; {club.name}
        </Link>
        <h1 className="mt-3 fx-club-thread-title">{thread.title}</h1>

        <ul className="mt-8 fx-club-thread-list" data-testid="post-list">
          {posts.length === 0 ? (
            <li className="meta">No posts yet. Start the conversation.</li>
          ) : (
            posts.map((p) => (
              <li key={p.id} className="card">
                <p className="fx-club-thread-text">{p.content}</p>
                <p className="mt-2 fx-club-thread-caps">
                  {p.authorId === viewerId ? "You" : "Member"} ·{" "}
                  {new Date(p.createdAt).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>

        {isMember ? (
          <form onSubmit={post} className="mt-8">
            <label htmlFor="content" className="block fx-club-thread-field">
              Add a reply
            </label>
            <textarea
              id="content"
              name="content"
              rows={3}
              required
              className="cap-input py-2 fx-club-thread-input"
            />
            {error ? (
              <p className="mt-2 fx-club-thread-text-2" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="cap-btn mt-2"
              data-variant="primary"
            >
              {pending ? "Posting..." : "Post reply"}
            </button>
          </form>
        ) : null}
      </Container>
    </PageShell>
  );
}
