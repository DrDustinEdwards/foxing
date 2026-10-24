// The reader route. Server loader resolves the readable book, the same-origin
// RWPM manifest URL, and (for signed-in readers) existing annotations + saved
// position. The reader itself mounts client-only (ts-toolkit touches the DOM),
// so the route renders a shell and the ReaderView lazy-loads the engine. Anonymous
// readers can read fully; annotating/bookmarking/progress prompt sign-in.
import { loadReaderAnnotations, views } from "@foxing/core";
import { getAuth } from "~/lib/auth.server";
import { loaderBase } from "~/lib/loader.server";
import type { Locator } from "~/lib/reader/locator";
import { ReaderView } from "~/components/reader/reader-view";
import type { Route } from "./+types/read";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db, env, origin } = loaderBase(context, request);
  const session = await (await getAuth(env)).api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;
  // The same view GET /books/:slug/reader returns to mobile: the readable book, the
  // saved position and the clubs a passage comment can go to.
  const page = await views.readerPage(db, userId, params.slug);
  if (!page || page.book.slug !== params.slug) throw new Response("Not found", { status: 404 });

  // One in-process resolution: the viewer's own annotations (MINE), the entitled
  // club/friend/public annotations of OTHERS, the club passage discussion, and the
  // popular-highlights layer. Same core function the mobile API calls, so web and mobile
  // resolve identically. Anonymous readers get public + popular only.
  const resolved = await loadReaderAnnotations(db, userId, page.book.id);
  const { epubUrl: _epubUrl, ...book } = page.book;

  return {
    book,
    // Absolute (not root-relative) so the navigator's baseURL -> the <base href> it
    // injects into each blob-URL content frame is absolute. Relative resource URLs
    // (images, the epub's own CSS) do not resolve against an opaque blob: base, so a
    // root-relative manifest URL leaves internal images broken.
    manifestUrl: `${origin}/reader-assets/${book.slug}/manifest.json`,
    signedIn: !!userId,
    loginHref: `/login?redirect=${encodeURIComponent(`/read/${book.slug}`)}`,
    layers: resolved,
    shareableClubs: page.shareableClubs,
    initialLocator: page.initialLocator as Locator | null,
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
