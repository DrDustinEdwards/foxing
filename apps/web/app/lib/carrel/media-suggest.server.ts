// Tags and alt text a model suggests for a Journal picture: site-api's mediaSuggester (Workers AI,
// through the site's AI Gateway when AI_GATEWAY_BASE_URL names one). Nothing here writes: a
// suggestion reaches the file only when a person accepts it in Carrel, as an alt or a tags write.
// Only the Journal's own uploads, made with the Carrel key, are ever sent; no reader's data reaches
// the model.

import { mediaSuggester } from "@dustinedwards/site-api";

/** What the model suggests for one stored picture. Throws when the site has no AI binding. */
export const suggestFor = mediaSuggester({
  app: "foxing",
  describe: "in the Journal of Foxing, a website about reading classic books",
});
