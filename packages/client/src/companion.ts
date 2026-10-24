// The AI companion: POST /companion streams the answer as server-sent events. The
// server builds every prompt; a screen sends only the action, the book and what the
// reader picked or typed. Plus only: a free reader gets ApiError code "plus_required".
import { useCallback, useRef, useState } from "react";
import { ApiError, errorMessage } from "./http";
import { useApi } from "./provider";

export type CompanionAction =
  | "word_lookup"
  | "passage_analysis"
  | "chat"
  | "word_aspect"
  | "language_difficulty"
  | "deep_dive"
  | "semantic_search"
  | "discussion_starter"
  | "word_wise"
  | "character_map"
  | "chapter_feature"
  | "bilingual_paragraph"
  | "recommendations"
  | "reading_personality"
  | "book_insight";

export interface CompanionRequest {
  action: CompanionAction;
  bookId: string;
  /** Continues an earlier conversation; the server keeps its history. */
  threadId?: string;
  message?: string;
  selection?: { text: string; chapter?: string | null; locator?: unknown };
  /** Where the reader is, for chapter actions sent without a selection. */
  chapter?: string;
  targetLanguage?: string;
}

/** Runs one companion request at a time; `text` grows as the answer streams in. */
export function useCompanion() {
  const api = useApi();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  /** Resolves to the whole answer, or null when it failed (shown in `error`). */
  const run = useCallback(
    async (req: CompanionRequest): Promise<string | null> => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setText("");
      setError(null);
      setPending(true);
      let answer = "";
      let failed: unknown = null;
      try {
        await api.stream(
          "/companion",
          { ...req },
          (event, data) => {
            if (event === "delta") {
              answer += data;
              setText(answer);
            } else if (event === "error") {
              failed = new ApiError(502, "companion", data);
            } else if (event === "done") {
              const done = JSON.parse(data) as { threadId?: string };
              if (done.threadId) setThreadId(done.threadId);
            }
          },
          controller.signal,
        );
      } catch (err) {
        if (controller.signal.aborted) return null;
        failed = err;
      } finally {
        if (abort.current === controller) setPending(false);
      }
      if (failed) {
        setError(failed);
        return null;
      }
      return answer;
    },
    [api],
  );

  const reset = useCallback(() => {
    abort.current?.abort();
    setText("");
    setError(null);
    setPending(false);
    setThreadId(null);
  }, []);

  const planRequired = error instanceof ApiError && error.code === "plus_required";
  return { run, reset, text, pending, error: errorMessage(error), planRequired, threadId };
}
