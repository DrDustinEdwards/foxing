// Tags and alt text a model suggests for a Journal picture: site-api's mediaSuggester (Claude Haiku 5.5,
// straight at Anthropic with ANTHROPIC_API_KEY). Nothing here writes: a
// suggestion reaches the file only when a person accepts it in Carrel, as an alt or a tags write.
// Only the Journal's own uploads, made with the Carrel key, are ever sent; no reader's data reaches
// the model.

import { mediaSuggester } from "@dustinedwards/site-api";

/** What the model suggests for one stored picture. Throws when the site has no AI binding. */
export const suggestFor = mediaSuggester({
  app: "foxing",
  describe: "in the Journal of Foxing, a website about reading classic books",
});
