import { TextInput } from "react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { decodeLocator } from "@/components/reader/readium-helpers";
import { CompanionChat } from "@/components/reader/companion-chat";
import { COMPANION_TOOL_TITLES, type CompanionTool } from "@/components/reader/menu-sheet";
import { CompanionSheet } from "@/components/reader/companion-sheet";
import { PassageAnalysisSheet } from "@/components/reader/passage-analysis-sheet";
import type { PassagePillState, WordPillState } from "@/components/reader/reader-types";
import { WordLookupSheet } from "@/components/reader/word-lookup-sheet";
import type { useReaderWrites } from "@/lib/reader-data";

export function ReaderAiSheets({
  bookId,
  bookTitle,
  chapterTitle,
  targetLanguage,
  writes,
  wordSheet,
  onCloseWord,
  passageSheet,
  onClosePassage,
  chatOpen,
  chatSeed,
  onCloseChat,
  companionTool,
  onCloseTool,
  findQuery,
  setFindQuery,
  findSubmitted,
  setFindSubmitted,
  translateText,
  onCloseTranslate,
}: {
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  targetLanguage: string;
  writes: ReturnType<typeof useReaderWrites>;
  wordSheet: WordPillState | null;
  onCloseWord: () => void;
  passageSheet: PassagePillState | null;
  onClosePassage: () => void;
  chatOpen: boolean;
  chatSeed: string | null;
  onCloseChat: () => void;
  companionTool: CompanionTool | null;
  onCloseTool: () => void;
  findQuery: string;
  setFindQuery: (value: string) => void;
  findSubmitted: string | null;
  setFindSubmitted: (value: string | null) => void;
  translateText: string | null;
  onCloseTranslate: () => void;
}) {
  const colors = useColors();
  return (
    <>
      {wordSheet ? (
        <WordLookupSheet
          visible
          word={wordSheet.word}
          sentence={wordSheet.surroundingText}
          bookId={bookId}
          currentChapter={chapterTitle}
          onSaveWord={writes.saveWord}
          onClose={() => onCloseWord()}
        />
      ) : null}

      {passageSheet ? (
        <PassageAnalysisSheet
          visible
          passage={passageSheet.text}
          bookId={bookId}
          currentChapter={chapterTitle}
          onSavePassage={() =>
            writes.addAnnotation({
              type: "commonplace",
              locator: passageSheet.cfi
                ? (decodeLocator(passageSheet.cfi) as unknown as Record<string, unknown>)
                : null,
              selectedText: passageSheet.text.slice(0, 4000),
              chapter: chapterTitle || null,
            })
          }
          onClose={() => onClosePassage()}
        />
      ) : null}

      <CompanionChat
        visible={chatOpen}
        bookTitle={bookTitle}
        bookId={bookId}
        seedQuestion={chatSeed}
        onClose={onCloseChat}
      />

      <CompanionSheet
        visible={companionTool !== null}
        title={companionTool ? COMPANION_TOOL_TITLES[companionTool] : ""}
        request={
          !companionTool
            ? null
            : companionTool === "semantic_search"
              ? findSubmitted
                ? { action: "semantic_search", bookId: bookId, message: findSubmitted }
                : null
              : {
                  action: companionTool,
                  bookId: bookId,
                  chapter: chapterTitle || undefined,
                }
        }
        onClose={() => onCloseTool()}
      >
        {companionTool === "semantic_search" ? (
          <TextInput
            value={findQuery}
            onChangeText={setFindQuery}
            onSubmitEditing={() => setFindSubmitted(findQuery.trim() || null)}
            placeholder="Describe a moment, an idea or a line"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            accessibilityLabel="What are you looking for in the book?"
            style={{
              fontFamily: Fonts.body,
              fontSize: 15,
              color: colors.textPrimary,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 14,
            }}
          />
        ) : null}
      </CompanionSheet>

      <CompanionSheet
        visible={translateText !== null}
        title={`Translate to ${targetLanguage}`}
        request={
          translateText
            ? {
                action: "bilingual_paragraph",
                bookId: bookId,
                selection: {
                  text: translateText.slice(0, 4000),
                  chapter: chapterTitle || null,
                },
                targetLanguage: targetLanguage,
              }
            : null
        }
        onClose={() => onCloseTranslate()}
      />
    </>
  );
}
