import {
  useCreateAnnotation,
  useDeleteAnnotation,
  useLikeAnnotation,
  usePassageComment,
  useSaveProgress,
  useUpdateAnnotation,
} from "@foxing/client";
import { newId } from "capsomer/behavior/state-hooks";
import type { HighlightColor } from "@foxing/core";
import { useCallback, useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { ReaderEngine } from "~/lib/reader/engine.client";
import type { Locator } from "~/lib/reader/locator";
import type { ReaderOther } from "./reader-types";

export function useReaderWrites({
  bookId,
  currentLocatorRef,
  requireSignIn,
  setAttribution,
}: {
  bookId: string;
  currentLocatorRef: RefObject<Locator | null>;
  requireSignIn: () => boolean;
  setAttribution: Dispatch<SetStateAction<ReaderOther | null>>;
}) {
  // Writes never swallow a failure: saving drives a role="status" indicator, writeError a role="alert" banner.
  const writes = [
    useCreateAnnotation(),
    useUpdateAnnotation(),
    useDeleteAnnotation(),
    useLikeAnnotation(),
    usePassageComment(),
    useSaveProgress(),
  ] as const;
  const [createAnn, updateAnn, deleteAnn, likeAnn, comment, saveProgress] = writes;
  const createRun = createAnn.run;
  const updateFire = updateAnn.fire;
  const deleteFire = deleteAnn.fire;
  const likeFire = likeAnn.fire;
  const commentRun = comment.run;
  const saving = writes.some((w) => w.pending);
  const writeError = writes.find((w) => w.error)?.error ?? null;
  const dismissWriteError = () => {
    for (const w of writes) w.reset();
  };

  const persistAnnotation = useCallback(
    async (payload: {
      type: "highlight" | "note" | "bookmark";
      locator: Locator;
      color?: HighlightColor;
      body?: string;
      selectedText?: string;
      // 'club' is the explicit share-to-club exposure; omitted lets the server resolve the default visibility.
      visibility?: "club";
    }) => {
      const chapterTitle = currentLocatorRef.current?.title;
      await createRun({
        ...payload,
        id: newId(),
        bookId,
        chapter: typeof chapterTitle === "string" ? chapterTitle : undefined,
      });
    },
    [bookId, createRun, currentLocatorRef],
  );

  const patchAnnotation = useCallback(
    (id: string, patch: { color?: HighlightColor; body?: string | null }) => {
      updateFire({ bookId, id, ...patch });
    },
    [bookId, updateFire],
  );

  const removeAnnotation = useCallback(
    (id: string) => deleteFire({ bookId, id }),
    [bookId, deleteFire],
  );

  const toggleLike = useCallback(
    (other: ReaderOther) => {
      if (!requireSignIn()) return;
      const on = !other.likedByMe;
      setAttribution((cur) =>
        cur && cur.id === other.id
          ? { ...cur, likedByMe: on, likeCount: Math.max(0, cur.likeCount + (on ? 1 : -1)) }
          : cur,
      );
      likeFire({ bookId, id: other.id, on });
    },
    [requireSignIn, likeFire, bookId, setAttribution],
  );

  // clubId is implicit when the viewer shares one club with the author; otherwise the popover offers a picker.
  const postReply = useCallback(
    async (other: ReaderOther, clubId: string, body: string) => {
      if (!requireSignIn()) return false;
      setAttribution((cur) =>
        cur && cur.id === other.id ? { ...cur, replyCount: cur.replyCount + 1 } : cur,
      );
      const ok = await commentRun({
        id: newId(),
        clubId,
        bookId,
        body,
        parentId: other.id,
        locator: other.locator ?? undefined,
        chapter: other.chapter,
        you: { id: "me", username: null, displayName: "You", avatarUrl: null },
      });
      if (!ok) {
        setAttribution((cur) =>
          cur && cur.id === other.id ? { ...cur, replyCount: cur.replyCount - 1 } : cur,
        );
      }
      return !!ok;
    },
    [requireSignIn, commentRun, bookId, setAttribution],
  );

  return {
    saving,
    writeError,
    dismissWriteError,
    saveFire: saveProgress.fire,
    persistAnnotation,
    patchAnnotation,
    removeAnnotation,
    toggleLike,
    postReply,
  };
}

export function usePageKeys(engineRef: RefObject<ReaderEngine | null>, blocked: boolean) {
  useEffect(() => {
    if (blocked) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        engineRef.current?.next();
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        engineRef.current?.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, engineRef]);
}
