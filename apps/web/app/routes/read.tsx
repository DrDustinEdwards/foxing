// The reader route. Server loader resolves the readable book, the same-origin
// RWPM manifest URL, and (for signed-in readers) existing annotations + saved
// position. The reader itself mounts client-only (ts-toolkit touches the DOM),
// so the route renders a shell and the ReaderView lazy-loads the engine. Anonymous
// readers can read fully; annotating/bookmarking/progress prompt sign-in.
import { annotationsRepo, catalogRepo, libraryRepo } from "@foxing/core";
import { getAuth } from "~/lib/auth.server";
import { loaderBase } from "~/lib/loader.server";
import type { Locator } from "~/lib/reader/locator";
import { ReaderView, type ReaderAnnotation } from "~/components/reader/reader-view";
import type { Route } from "./+types/read";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db, env, origin } = loaderBase(context, request);
  const book = await catalogRepo.getBookBySlug(db, params.slug);
  if (!book || !catalogRepo.isReadable(book)) throw new Response("Not found", { status: 404 });

  const session = await getAuth(env).api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;

  let annotations: ReaderAnnotation[] = [];
  let initialLocator: Locator | null = null;
  if (userId) {
    const [rows, userBook] = await Promise.all([
      annotationsRepo.listForReader(db, userId, book.id),
      libraryRepo.getUserBook(db, userId, book.id),
    ]);
    annotations = rows.map((a) => ({
      id: a.id,
      type: a.type as ReaderAnnotation["type"],
      locator: (a.locator as Locator | null) ?? null,
      selectedText: a.selectedText,
      body: a.body,
      color: a.color,
      chapter: a.chapter,
    }));
    initialLocator = (userBook?.progress as Locator | null) ?? null;
  }

  return {
    book: { id: book.id, slug: book.slug, title: book.title, author: book.author },
    // Absolute (not root-relative) so the navigator's baseURL -> the <base href> it
    // injects into each blob-URL content frame is absolute. Relative resource URLs
    // (images, the epub's own CSS) do not resolve against an opaque blob: base, so a
    // root-relative manifest URL leaves internal images broken.
    manifestUrl: `${origin}/reader-assets/${book.slug}/manifest.json`,
    signedIn: !!userId,
    loginHref: `/login?redirect=${encodeURIComponent(`/read/${book.slug}`)}`,
    annotations,
    initialLocator,
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData ? `Reading ${loaderData.book.title}` : "Reader";
  // Reader is a private surface; keep it out of search indexes.
  return [{ title: `${title} | Foxing` }, { name: "robots", content: "noindex" }];
}

export default function Read({ loaderData }: Route.ComponentProps) {
  return <ReaderView {...loaderData} />;
}
