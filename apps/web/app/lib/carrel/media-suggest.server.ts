// Tags and alt text a model suggests for a Journal picture. Nothing here writes: a suggestion reaches the file only when a person accepts it in Carrel; only the Journal's own uploads are sent.

import { mediaSuggester } from "@dustinedwards/site-api";

export const suggestFor = mediaSuggester<Env>({
  app: "foxing",
  describe: "in the Journal of Foxing, a website about reading classic books",
  outcomeKv: (env) => env.APP_KV,
});
