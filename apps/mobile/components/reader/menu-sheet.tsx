import { useEffect, useState } from "react";
import { View, Text, Modal, Pressable, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BookOpen,
  Lightbulb,
  Question,
  Student,
  Users,
  Books,
  Highlighter,
  ImageSquare,
  Share as ShareIcon,
  Moon,
  SpeakerHigh,
  MagnifyingGlass,
  ChatCircle,
  Lock,
  type Icon,
} from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { SectionLabel } from "@/components/ui/section-label";
import { LockBadge } from "./floating-pill-parts";

export type CompanionTool =
  | "character_map"
  | "book_insight"
  | "semantic_search"
  | "chapter_feature"
  | "deep_dive"
  | "discussion_starter";

export type MenuAction =
  | "ask-chat"
  | CompanionTool
  | "highlights"
  | "vocabulary"
  | "quote-card"
  | "my-clubs"
  | "listen"
  | "sleep-timer";

export const COMPANION_TOOL_TITLES: Record<CompanionTool, string> = {
  character_map: "Characters so far",
  book_insight: "An insight",
  semantic_search: "Find in the book",
  chapter_feature: "This chapter",
  deep_dive: "Go deeper",
  discussion_starter: "Discussion questions",
};

export type MenuInitialView = "secondary" | "companion";

interface MenuSheetProps {
  visible: boolean;
  bookTitle: string;
  bookAuthor: string;
  currentChapterTitle?: string;
  initialView?: MenuInitialView;
  clubsReadingThis?: Array<{ id: string; name: string }>;
  onAction: (action: MenuAction) => void;
  locked?: boolean;
  onUpgrade?: (feature: string) => void;
  onClose: () => void;
}

const GATED_AI = new Set<MenuAction>([
  "ask-chat",
  ...(Object.keys(COMPANION_TOOL_TITLES) as CompanionTool[]),
]);

interface MenuItem {
  key: MenuAction | "share";
  Icon: Icon;
  label: string;
}

const SECONDARY: MenuItem[] = [
  { key: "listen", Icon: SpeakerHigh, label: "Listen" },
  { key: "sleep-timer", Icon: Moon, label: "Sleep Timer" },
  { key: "highlights", Icon: Highlighter, label: "Highlights" },
  { key: "vocabulary", Icon: Books, label: "Vocabulary" },
  { key: "quote-card", Icon: ImageSquare, label: "Quote Card" },
  { key: "share", Icon: ShareIcon, label: "Share" },
];

const BOOK_TOOLS: MenuItem[] = [
  { key: "character_map", Icon: Users, label: "Characters" },
  { key: "book_insight", Icon: Lightbulb, label: "Insight" },
  { key: "semantic_search", Icon: MagnifyingGlass, label: "Find" },
];
const CHAPTER_TOOLS: MenuItem[] = [
  { key: "chapter_feature", Icon: BookOpen, label: "This chapter" },
  { key: "deep_dive", Icon: Student, label: "Go deeper" },
  { key: "discussion_starter", Icon: Question, label: "Discuss" },
];

export function MenuSheet({
  visible,
  bookTitle,
  bookAuthor,
  currentChapterTitle,
  initialView = "secondary",
  clubsReadingThis,
  onAction,
  locked,
  onUpgrade,
  onClose,
}: MenuSheetProps) {
  const colors = useColors();
  const [showCompanion, setShowCompanion] = useState(initialView === "companion");
  // Resync on open so a different entry point does not show the previous view.
  useEffect(() => {
    if (visible) {
      // oxlint-disable-next-line react/set-state-in-effect -- resets the sheet each time it opens
      setShowCompanion(initialView === "companion");
    }
  }, [visible, initialView]);

  async function handleShare() {
    try {
      const message = currentChapterTitle
        ? `I'm reading ${bookTitle} by ${bookAuthor}, currently in "${currentChapterTitle}".`
        : `I'm reading ${bookTitle} by ${bookAuthor}.`;
      await Share.share({ message });
    } catch (e) {
      console.warn("[menu] share failed", e);
    }
  }

  function handleSelect(key: MenuItem["key"], label?: string) {
    if (key === "share") {
      void handleShare();
      onClose();
      return;
    }
    if (locked && GATED_AI.has(key)) {
      onUpgrade?.(label ?? "This feature");
      return;
    }
    onAction(key);
  }

  function handleClose() {
    setShowCompanion(false);
    onClose();
  }

  const secondaryWithClubs: MenuItem[] = clubsReadingThis?.length
    ? [...SECONDARY, { key: "my-clubs", Icon: Users, label: "My Clubs" }]
    : SECONDARY;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable
        className="flex-1 justify-end"
        onPress={handleClose}
        accessibilityLabel="Close menu"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
          accessibilityLabel="Reader menu"
          className="rounded-t-3xl pt-2 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark"
        >
          <SafeAreaView edges={["bottom"]}>
            <View
              style={{
                alignSelf: "center",
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.borderSubtle,
                marginTop: 6,
                marginBottom: 10,
              }}
            />
            {showCompanion ? (
              <View style={{ paddingBottom: 4 }}>
                <View style={{ paddingHorizontal: 12 }}>
                  <SectionLabel style={{ marginTop: 4, marginBottom: 8, paddingHorizontal: 4 }}>
                    This book
                  </SectionLabel>
                  {/* Prominent standalone Ask/Chat entry: opens the companion
                      in general mode (book + chapter context, no seed). */}
                  <Pressable
                    onPress={() => handleSelect("ask-chat", "Ask")}
                    accessibilityRole="button"
                    accessibilityLabel={locked ? "Ask a question, Plus feature" : "Ask a question"}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.brandUi,
                      borderRadius: 14,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      marginBottom: 12,
                    }}
                  >
                    <ChatCircle color={colors.textOnBrand} size={20} weight="fill" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: Fonts.uiMedium,
                          fontSize: 14,
                          color: colors.textOnBrand,
                        }}
                      >
                        Ask a question
                      </Text>
                    </View>
                    {locked ? <Lock color={colors.textOnBrand} size={16} weight="fill" /> : null}
                  </Pressable>
                  <Row items={BOOK_TOOLS} onSelect={handleSelect} locked={locked} />
                  <SectionLabel style={{ marginTop: 4, marginBottom: 8, paddingHorizontal: 4 }}>
                    This chapter
                  </SectionLabel>
                  <Row items={CHAPTER_TOOLS} onSelect={handleSelect} locked={locked} />
                </View>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                <Row items={secondaryWithClubs} onSelect={handleSelect} />
              </View>
            )}
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface RowProps {
  items: MenuItem[];
  onSelect: (key: MenuItem["key"], label: string) => void;
  locked?: boolean;
}

function Row({ items, onSelect, locked }: RowProps) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
      }}
    >
      {items.map((item) => {
        const isLocked = !!locked && GATED_AI.has(item.key as MenuAction);
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key, item.label)}
            accessibilityRole="button"
            accessibilityLabel={isLocked ? `${item.label}, Plus feature` : item.label}
            style={{
              width: "30.5%",
              alignItems: "center",
              paddingVertical: 10,
              marginBottom: 4,
              borderRadius: 14,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: colors.brandSubtle,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 6,
              }}
            >
              <item.Icon color={colors.brandUi} size={20} weight="regular" />
              {isLocked ? <LockBadge colors={colors} size={16} /> : null}
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 11,
                color: colors.textSecondary,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
