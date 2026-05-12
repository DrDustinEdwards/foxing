import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function lookupWord(
  word: string,
  sentence: string,
  bookTitle: string,
  author: string,
  era: string
): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are a literary companion helping someone read "${bookTitle}" by ${author} (${era}).

The reader has tapped on the word: "${word}"

It appears in this sentence: "${sentence}"

Explain this word in 2-3 short paragraphs:
1. What it means in plain English
2. Its etymology or historical context if relevant
3. What it means specifically in this sentence and this book's context

Be warm, concise, and genuinely helpful. Write as if you're a knowledgeable friend, not a dictionary.`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function analyzePassage(
  passage: string,
  analysisType: 'rewrite' | 'historical' | 'literary' | 'thematic' | 'motivation',
  bookTitle: string,
  author: string,
  era: string
): Promise<string> {
  const prompts = {
    rewrite: `Rewrite this passage in clear, plain modern English while preserving its meaning and emotional tone.`,
    historical: `Explain the historical context of this passage. What was happening in the world when this was written? What would a contemporary reader of ${author}'s time have understood that modern readers might miss?`,
    literary: `Identify and explain the literary devices used in this passage (metaphor, irony, foreshadowing, alliteration, imagery, etc.). Be specific about where each device appears and what effect it creates.`,
    thematic: `Explain the thematic significance of this passage. Why does this moment matter in the larger context of the book? What ideas or themes does it develop or reveal?`,
    motivation: `Analyze the character motivations revealed in this passage. What does this moment tell us about what the characters want, fear, or believe?`,
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are a literary companion helping someone read "${bookTitle}" by ${author} (${era}).

Passage: "${passage}"

${prompts[analysisType]}

Be warm, insightful, and genuinely helpful. Write as if you're a knowledgeable friend who loves this book.`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function getChapterSummary(
  chapterTitle: string,
  chapterNumber: number,
  timing: 'before' | 'after',
  bookTitle: string,
  author: string,
  previousChapterContent?: string
): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: timing === 'before'
          ? `You are a literary companion helping someone read "${bookTitle}" by ${author}.

The reader is about to start Chapter ${chapterNumber}: "${chapterTitle}".

Give a brief, engaging catch-up summary of what has happened in the book so far — just enough to refresh their memory and get them ready to read. Keep it to 3-4 sentences. No spoilers for what comes next.`
          : `You are a literary companion helping someone read "${bookTitle}" by ${author}.

The reader just finished Chapter ${chapterNumber}: "${chapterTitle}".

Give a consolidating summary of what happened in this chapter — the key events, character developments, and any important details worth remembering. Keep it to 4-5 sentences.`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function chatWithCompanion(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  bookTitle: string,
  author: string,
  currentChapter: string,
  spoilerFree: boolean
): Promise<string> {
  const systemPrompt = spoilerFree
    ? `You are a warm, knowledgeable literary companion helping someone read "${bookTitle}" by ${author}. They are currently reading "${currentChapter}".

IMPORTANT: The reader has spoiler-free mode ON. Do not reveal anything that happens after their current position in the book. If asked about future events, gently decline and encourage them to keep reading.

Engage thoughtfully with their questions about the book. Help them understand difficult passages, historical context, character motivations, and literary themes. Be conversational and genuinely enthusiastic about the book.`
    : `You are a warm, knowledgeable literary companion helping someone read "${bookTitle}" by ${author}. They are currently reading "${currentChapter}".

You can discuss any part of the book including the ending. Engage thoughtfully with their questions about the book. Help them understand difficult passages, historical context, character motivations, and literary themes. Be conversational and genuinely enthusiastic about the book.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: systemPrompt,
    messages: messages,
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
