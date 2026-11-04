import { webManifest } from "@drdustinedwards/site-helpers/icons";
import { SITE_NAME } from "~/lib/seo";

export function loader() {
  const manifest = webManifest({
    name: SITE_NAME,
    themeColor: "#B04A1C",
    backgroundColor: "#FAF6EE",
  });
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
