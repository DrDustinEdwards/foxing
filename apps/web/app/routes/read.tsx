// The reader route. Server loader resolves the readable book, the same-origin
// RWPM manifest URL, and (for signed-in readers) existing annotations + saved
// position. The reader itself mounts client-only (ts-toolkit touches the DOM),
// so the route renders a shell and the ReaderView lazy-loads the engine. Anonymous
// readers can read fully; annotating/bookmarking/progress prompt sign-in.
import { catalogRepo, libraryRepo, loadReaderAnnotations, readerSocialRepo } from "@foxing/core";
import { getAuth } from "~/lib/auth.server";
import { loaderBase } from "~/lib/loader.server";
import type { Locator } from "~/lib/reader/locator";
import type {
  ReaderAnnotation,
  ReaderComment,
  ReaderOther,
  ReaderPopular,
} from "~/components/reader/reader-types";
import { ReaderView } from "~/components/reader/reader-view";
import type { Route } from "./+types/read";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db, env, origin } = loaderBase(context, request);
  const book = await catalogRepo.getBookBySlug(db, params.slug);
  if (!book || !catalogRepo.isReadable(book)) throw new Response("Not found", { status: 404 });

  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;

  // One in-process resolution: the viewer's own annotations (MINE), the entitled
  // club/friend/public annotations of OTHERS, the club passage discussion, and the
  // popular-highlights layer. Same core function the mobile API calls, so web and mobile
  // resolve identically. Anonymous readers get public + popular only.
  const [resolved, shareableClubs] = await Promise.all([
    loadReaderAnnotations(db, userId, book.id),
    userId
      ? readerSocialRepo.shareableClubsForBook(db, userId, book.id)
      : Promise.resolve<{ id: string; name: string }[]>([]),
  ]);

  const annotations: ReaderAnnotation[] = resolved.mine.map((a) => ({
    id: a.id,
    type: a.type as ReaderAnnotation["type"],
    locator: (a.locator as Locator | null) ?? null,
    selectedText: a.selectedText,
    body: a.body,
    color: a.color,
    chapter: a.chapter,
  }));
  const others = resolved.others as unknown as ReaderOther[];
  const comments = resolved.comments as unknown as ReaderComment[];
  const popular = resolved.popular as unknown as ReaderPopular[];

  // Saved reading position comes from the same resolution's viewer progress; the reader
  // component seeds its scrubber and progress gate from it.
  let initialLocator: Locator | null = null;
  if (userId) {
    const userBook = await libraryRepo.getUserBook(db, userId, book.id);
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
    others,
    comments,
    popular,
    shareableClubs,
    viewerProgressPct: resolved.viewerProgressPct,
    initialLocator,
  };
}

// The reader is its own document: its Content-Security-Policy differs from the rest of the site's
// (workers/security-headers.ts, readerContentSecurityPolicy) and a policy is fixed when a document
// loads. So a client-side navigation here from another page becomes a full page load, whatever
// link led here. Not run on the first load (no hydrate flag), which already has the reader's
// policy; a revalidation on the reader itself goes to the server loader as usual.
export async function clientLoader({ request, serverLoader }: Route.ClientLoaderArgs) {
  if (window.location.pathname !== new URL(request.url).pathname) {
    window.location.assign(request.url);
    return new Promise<never>(() => {});
  }
  return serverLoader();
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData ? `Reading ${loaderData.book.title}` : "Reader";
  // Reader is a private surface; keep it out of search indexes.
  return [{ title: `${title} | Foxing` }, { name: "robots", content: "noindex" }];
}

export default function Read({ loaderData }: Route.ComponentProps) {
  return <ReaderView {...loaderData} />;
}
