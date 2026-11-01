// The one place the Worker builds the companion's model callers, on site-runtime's
// Anthropic caller: its route (AI Gateway once AI_GATEWAY_BASE_URL is set), timeout, one
// retry layer, stop-reason check and log line. A reply that did not finish (cut off,
// refused, failed) throws here, so companion chat, Find next book and the catalog cache
// queue never store or cache it as complete. Null with no key.
import { type MessageFailure, stream, structured } from "@dustinedwards/site-runtime/anthropic";
import type { companion } from "@foxing/core";

const APP = "foxing";

function failed(result: MessageFailure): Error {
  // The kind only: the provider's message is never passed on (site-runtime logs the call).
  return new Error(`The model call did not finish (${result.kind}).`);
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
    })) {
      if (event.type === "text") yield event;
      else if (!event.result.ok) throw failed(event.result);
      else {
        const { usage } = event.result;
        yield { type: "done", inputTokens: usage.input, outputTokens: usage.output };
      }
    }
  };
}

export function anthropicStructured(env: Env): companion.StructuredCaller | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  return async (args, schema) => {
    const result = await structured(env, APP, request(args), schema, { feature: args.feature });
    if (!result.ok) throw failed(result);
    return {
      value: result.value,
      inputTokens: result.usage.input,
      outputTokens: result.usage.output,
    };
  };
}
