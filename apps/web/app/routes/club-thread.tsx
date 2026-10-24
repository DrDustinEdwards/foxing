// A single club thread (auth-gated). Posts arrive live: when another member posts, the
// club WebSocket pushes {t:'post'} and the thread refetches, so the new post appears
// without a reload. This is the two-context DO gate surface -- a post made in
// one browser context shows up in another that has this thread open.
import { useClubLive, useCreatePost, useThreadPage } from "@foxing/client";
import { createDb, views } from "@foxing/core";
import { Link, redirect } from "react-router";
import { PageShell } from "~/components/page-shell";
import { Container } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import { requireProfileForUser } from "~/lib/profile.server";
import type { Route } from "./+types/club-thread";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  if (!session?.user) throw redirect(`/login?redirect=/clubs/${params.slug}`);
  await requireProfileForUser(env, { id: session.user.id, email: session.user.email });
  const page = await views.threadPage(
    createDb(env.DB),
    params.threadId,
    session.user.id,
    params.slug,
  );
  if (!page) throw new Response("Not found", { status: 404 });
  return { page, viewerId: session.user.id };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData?.page.thread.title ?? "Thread"} | Foxing` },
    { name: "robots", content: "noindex" },
  ];
}

export default function ClubThread({ loaderData, params }: Route.ComponentProps) {
  const { viewerId } = loaderData;
  const { club, thread, posts, isMember } = useThreadPage(params.threadId, loaderData.page).data;
  const { run, error, pending } = useCreatePost();

  useClubLive(isMember ? club.id : null);

  async function post(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const content = String(new FormData(form).get("content") ?? "").trim();
    if (!content) return;
    if (await run({ threadId: thread.id, content })) form.reset();
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
                  {p.author?.id === viewerId ? "You" : "Member"} ·{" "}
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
