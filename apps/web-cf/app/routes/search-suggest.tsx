import { catalogRepo } from "@foxing/core";
import { loaderBase } from "~/lib/loader.server";
import type { Route } from "./+types/search-suggest";

// JSON resource route powering search-as-you-type (the SearchBox fetches this).
export async function loader({ context, request }: Route.LoaderArgs) {
  const { db } = loaderBase(context, request);
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const books = q.trim().length >= 2 ? await catalogRepo.suggest(db, q, 8) : [];
  return Response.json(
    {
      suggestions: books.map((b) => ({
        slug: b.slug,
        title: b.title,
        author: b.author,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=300" } },
  );
}
