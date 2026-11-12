import { webManifestResponse } from "@drdustinedwards/site-helpers/icons";
import { SITE_NAME } from "~/lib/seo";

export function loader() {
  return webManifestResponse({
    name: SITE_NAME,
    themeColor: "#B04A1C",
    backgroundColor: "#FAF6EE",
  });
}
