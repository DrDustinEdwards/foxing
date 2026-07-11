import { INDEXNOW_KEY } from "~/lib/indexnow";

// IndexNow ownership verification: the key file's entire body must be the key itself.
export function loader() {
  return new Response(INDEXNOW_KEY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
