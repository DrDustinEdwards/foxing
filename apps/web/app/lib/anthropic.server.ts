// The one place the Worker builds the companion's model callers, on site-runtime's
// Anthropic caller: its route (straight to Anthropic), timeout, one
// retry layer, stop-reason check and log line. A reply that did not finish (cut off,
// refused, failed) throws here, so companion chat, Find next book and the catalog cache
// queue never store or cache it as complete. Null with no key.
import {
  type MessageFailure,
  messages,
  stream,
  structured,
} from "@dustinedwards/site-runtime/anthropic";
import { recordAiOutcome } from "@dustinedwards/site-runtime/health";
import type { companion } from "@foxing/core";

const APP = "foxing";

function failed(result: MessageFailure): Error {
  // The kind only: the provider's message is never passed on (site-runtime logs the call).
  return new Error(`The model call did not finish (${result.kind}).`);
}

// /health's ai-companion check: each real call's outcome, kept in APP_KV until a call works.
function outcome(env: Env) {
  return (result: Record<string, unknown>) =>
    recordAiOutcome(env.APP_KV, "companion", {
      ok: result.ok === true,
      kind: typeof result.kind === "string" ? result.kind : null,
    });
}

function request(args: companion.CompanionCallArgs) {
  return {
    model: args.model,
    max_tokens: args.maxTokens,
    system: args.system,
    messages: args.messages,
  };
}

export function anthropicCaller(env: Env): companion.CompanionCaller | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  return async function* call(args) {
    for await (const event of stream(env, APP, request(args), {
      feature: args.feature,
      cache: args.cache,
      onResult: outcome(env),
    })) {
      if (event.type === "text") yield event;
      else if (!event.result.ok) throw failed(event.result);
      else {
        yield { type: "done", usage: event.result.usage };
      }
    }
  };
}

export function anthropicStructured(env: Env): companion.StructuredCaller | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  return async (args, schema) => {
    const result = await structured(env, APP, request(args), schema, {
      feature: args.feature,
      onResult: outcome(env),
    });
    if (!result.ok) throw failed(result);
    return { value: result.value, usage: result.usage };
  };
}

// Where the fact-check may look: reference sources about books and their authors.
const FACT_CHECK_DOMAINS = [
  "en.wikipedia.org",
  "gutenberg.org",
  "standardebooks.org",
  "isfdb.org",
  "britannica.com",
  "loc.gov",
  "archive.org",
  "openlibrary.org",
];

/** The fact-check's call: one Messages request with the web search tool, at most three searches. */
export function anthropicFactChecker(env: Env): companion.FactChecker | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  return async ({ model, system, user }) => {
    const result = await messages(
      env,
      APP,
      {
        model,
        // The reply is the corrected texts as JSON plus the search narration. 6000 cut it off (stop_reason max_tokens)
        // on 8 of 10 trial books: each cut-off call was billed, thrown away and retried.
        max_tokens: 16000,
        system,
        messages: [{ role: "user", content: user }],
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3,
            allowed_domains: FACT_CHECK_DOMAINS,
          },
        ],
      },
      { feature: "catalog-fact-check", timeoutMs: 180_000, onResult: outcome(env) },
    );
    if (!result.ok) throw failed(result as MessageFailure);
    const searches = (result.content as { type: string; name?: string }[]).filter(
      (b) => b.type === "server_tool_use" && b.name === "web_search",
    ).length;
    return { text: result.text, usage: result.usage, searches };
  };
}
