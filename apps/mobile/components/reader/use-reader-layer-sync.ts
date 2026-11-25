import { useEffect, useMemo, type RefObject } from "react";
import { highlightPalette, useColors } from "@/constants/colors";
import type { HighlightColor } from "@/components/reader/floating-pill";
import { encodeLocator } from "@/components/reader/readium-helpers";
import type { PassageCommentMarker, ReaderRef } from "@/components/reader/reader-types";
import type { useBookAnnotations } from "@foxing/client";

// Pushes the reader's own highlights, popular highlights and passage comments into the web view.
export function useReaderLayerSync({
  readerRef,
  ready,
  layers,
  popularEnabled,
}: {
  readerRef: RefObject<ReaderRef | null>;
  ready: boolean;
  layers: ReturnType<typeof useBookAnnotations>;
  popularEnabled: boolean;
}) {
  const colors = useColors();
  const palette = useMemo<Record<HighlightColor, string>>(() => highlightPalette(colors), [colors]);

  useEffect(() => {
    if (!ready) return;
    readerRef.current?.setHighlightColors(palette);
  }, [palette, ready, readerRef]);

  useEffect(() => {
    if (!ready) return;
    for (const m of layers.data?.mine ?? []) {
      if (m.type === "highlight" && m.locator) {
        readerRef.current?.addHighlight(
          encodeLocator(m.locator),
          (m.color ?? "amber") as HighlightColor,
        );
      }
    }
  }, [ready, layers.data?.mine, readerRef]);

  useEffect(() => {
    if (!ready) return;
    if (!popularEnabled) {
      readerRef.current?.setPopularHighlights([]);
      return;
    }
    const list = (layers.data?.popular ?? [])
      .filter((p) => p.count >= 3 && p.locator)
      .map((p) => ({ text: p.normalizedText, cfi: encodeLocator(p.locator!), count: p.count }));
    readerRef.current?.setPopularHighlights(list, colors.textTertiary);
  }, [ready, layers.data?.popular, popularEnabled, colors.textTertiary, readerRef]);

  useEffect(() => {
    if (!ready) return;
    const markers: PassageCommentMarker[] = (layers.data?.comments ?? [])
      .filter((c) => !c.parentId && c.locator)
      .map((c) => ({
        cfi: encodeLocator(c.locator!),
        passageText: (c.locator?.text as { highlight?: string } | undefined)?.highlight ?? "",
      }));
    readerRef.current?.setPassageComments(markers, colors.brandUi);
  }, [ready, layers.data?.comments, colors.brandUi, readerRef]);
}
