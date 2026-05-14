import Anthropic from "npm:@anthropic-ai/sdk@^0.95.2";

const MODEL = "claude-sonnet-4-20250514";

const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
if (!apiKey) {
  // Logged once at cold start so it's obvious in `supabase functions logs`
  // when the secret was never set, separate from per-request errors.
  console.error("[ai-companion] ANTHROPIC_API_KEY is not set");
}

const client = new Anthropic({ apiKey });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type WordLookupPayload = {
  word: string;
  sentence: string;
  bookTitle: string;
  author: string;
  era: string;
};

type PassageAnalysisPayload = {
  passage: string;
  analysisType: "rewrite" | "historical" | "literary" | "thematic" | "motivation";
  bookTitle: string;
  author: string;
  era: string;
};

type ChapterSummaryPayload = {
  chapterTitle: string;
  chapterNumber: number;
  timing: "before" | "after";
  bookTitle: string;
  author: string;
  previousChapterContent?: string;
};

type ChatPayload = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  bookTitle: string;
  author: string;
  currentChapter: string;
  spoilerFree: boolean;
};

async function wordLookup(p: WordLookupPayload): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `You are a literary companion helping someone read "${p.bookTitle}" by ${p.author} (${p.era}).

The reader has tapped on the word: "${p.word}"

It appears in this sentence: "${p.sentence}"

Explain this word in 2-3 short paragraphs:
1. What it means in plain English
2. Its etymology or historical context if relevant
3. What it means specifically in this sentence and this book's context

Be warm, concise, and genuinely helpful. Write as if you're a knowledgeable friend, not a dictionary.`,
      },
    ],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}

async function passageAnalysis(p: PassageAnalysisPayload): Promise<string> {
  const prompts: Record<PassageAnalysisPayload["analysisType"], string> = {
    rewrite: `Rewrite this passage in clear, plain modern English while preserving its meaning and emotional tone.`,
    historical: `Explain the historical context of this passage. What was happening in the world when this was written? What would a contemporary reader of ${p.author}'s time have understood that modern readers might miss?`,
    literary: `Identify and explain the literary devices used in this passage (metaphor, irony, foreshadowing, alliteration, imagery, etc.). Be specific about where each device appears and what effect it creates.`,
    thematic: `Explain the thematic significance of this passage. Why does this moment matter in the larger context of the book? What ideas or themes does it develop or reveal?`,
    motivation: `Analyze the character motivations revealed in this passage. What does this moment tell us about what the characters want, fear, or believe?`,
  };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are a literary companion helping someone read "${p.bookTitle}" by ${p.author} (${p.era}).

Passage: "${p.passage}"

${prompts[p.analysisType]}

Be warm, insightful, and genuinely helpful. Write as if you're a knowledgeable friend who loves this book.`,
      },
    ],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}

async function chapterSummary(p: ChapterSummaryPayload): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content:
          p.timing === "before"
            ? `You are a literary companion helping someone read "${p.bookTitle}" by ${p.author}.

The reader is about to start Chapter ${p.chapterNumber}: "${p.chapterTitle}".

Give a brief, engaging catch-up summary of what has happened in the book so far — just enough to refresh their memory and get them ready to read. Keep it to 3-4 sentences. No spoilers for what comes next.`
            : `You are a literary companion helping someone read "${p.bookTitle}" by ${p.author}.

The reader just finished Chapter ${p.chapterNumber}: "${p.chapterTitle}".

Give a consolidating summary of what happened in this chapter — the key events, character developments, and any important details worth remembering. Keep it to 4-5 sentences.`,
      },
    ],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}

async function chat(p: ChatPayload): Promise<string> {
  const systemPrompt = p.spoilerFree
    ? `You are a warm, knowledgeable literary companion helping someone read "${p.bookTitle}" by ${p.author}. They are currently reading "${p.currentChapter}".

IMPORTANT: The reader has spoiler-free mode ON. Do not reveal anything that happens after their current position in the book. If asked about future events, gently decline and encourage them to keep reading.

Engage thoughtfully with their questions about the book. Help them understand difficult passages, historical context, character motivations, and literary themes. Be conversational and genuinely enthusiastic about the book.`
    : `You are a warm, knowledgeable literary companion helping someone read "${p.bookTitle}" by ${p.author}. They are currently reading "${p.currentChapter}".

You can discuss any part of the book including the ending. Engage thoughtfully with their questions about the book. Help them understand difficult passages, historical context, character motivations, and literary themes. Be conversational and genuinely enthusiastic about the book.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: p.messages,
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "ANTHROPIC_API_KEY secret is not set on this Supabase project",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const startedAt = Date.now();
  let action = "unknown";

  try {
    const body = await req.json();
    action = body.action;
    const payload = body.payload;
    console.log(`[ai-companion] → ${action}`);

    let result: string;
    switch (action) {
      case "word_lookup":
        result = await wordLookup(payload as WordLookupPayload);
        break;
      case "passage_analysis":
        result = await passageAnalysis(payload as PassageAnalysisPayload);
        break;
      case "chapter_summary":
        result = await chapterSummary(payload as ChapterSummaryPayload);
        break;
      case "chat":
        result = await chat(payload as ChatPayload);
        break;
      default:
        console.warn(`[ai-companion] ✕ unknown action: ${action}`);
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[ai-companion] ✓ ${action} ${elapsedMs}ms ${result.length} chars`,
    );

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ai-companion] ✕ ${action} ${elapsedMs}ms — ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
