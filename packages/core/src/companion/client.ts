// The one file that touches the Anthropic SDK. The API route never imports Anthropic
// directly; it depends on the CompanionCaller function type (dependency-injected,
// same pattern as ApiDeps.resolveSession), so tests can substitute a stub streamer
// with no network call and no key.
import Anthropic from "@anthropic-ai/sdk";

export type CompanionMessage = { role: "user" | "assistant"; content: string };

export type CompanionStreamEvent =
  | { type: "text"; delta: string }
  | { type: "done"; inputTokens: number; outputTokens: number };

export type CompanionCallArgs = {
  model: string;
  system: string;
  messages: CompanionMessage[];
  maxTokens: number;
};

export type CompanionCaller = (args: CompanionCallArgs) => AsyncIterable<CompanionStreamEvent>;

/** Real Anthropic-backed caller. Constructed once in the Worker from env.ANTHROPIC_API_KEY. */
export function createAnthropicCaller(apiKey: string): CompanionCaller {
  const client = new Anthropic({ apiKey });

  return async function* call({ model, system, messages, maxTokens }) {
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", delta: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    yield {
      type: "done",
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    };
  };
}
