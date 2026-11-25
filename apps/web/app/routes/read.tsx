// The reader route: the loader resolves the readable book, the manifest URL and, for signed-in readers, annotations and saved position; the reader mounts client-only.
import { loadReaderAnnotations, views } from "@foxing/core";
import { sessionUserFromRequest } from "~/lib/auth.server";
import { loaderBase } from "~/lib/loader.server";
import type { Locator } from "~/lib/reader/locator";
import { ReaderView } from "~/components/reader/reader-view";
import "~/styles/reader.css";
import type { Route } from "./+types/read";
import { signInHref } from "~/lib/sign-in-path";
import { noindexMeta } from "~/lib/seo";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { db, env, origin } = loaderBase(context, request);
  const user = await sessionUserFromRequest(request, env);
  const userId = user?.id ?? null;
  const page = await views.readerPage(db, userId, params.slug);
  if (!page || page.book.slug !== params.slug) throw new Response("Not found", { status: 404 });

  // One in-process resolution, the same core function the mobile API calls; anonymous readers get public + popular only.
  const resolved = await loadReaderAnnotations(db, userId, page.book.id);
  const { epubUrl: _epubUrl, ...book } = page.book;

  return {
    book,
    // Absolute, so the <base href> Readium injects into each blob: frame is absolute: relative URLs do not resolve against an opaque blob: base.
    manifestUrl: `${origin}/reader-assets/${book.slug}/manifest.json`,
    signedIn: !!userId,
    loginHref: signInHref(`/read/${book.slug}`),
    layers: resolved,
    shareableClubs: page.shareableClubs,
    initialLocator: page.initialLocator as Locator | null,
  };
}

// The reader is its own document with its own CSP, fixed at load, so a client-side navigation here becomes a full page load.
export async function clientLoader({ request, serverLoader }: Route.ClientLoaderArgs) {
  if (window.location.pathname !== new URL(request.url).pathname) {
    window.location.assign(request.url);
    return new Promise<never>(() => {});
  }
  return serverLoader();
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData ? `Reading ${loaderData.book.title}` : "Reader";
  return noindexMeta(`${title} | Foxing`);
}

export default function Read({ loaderData }: Route.ComponentProps) {
  return <ReaderView {...loaderData} />;
}

export const handle = { hydrate: true };
