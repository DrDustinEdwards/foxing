import { View, Text, ScrollView, Pressable } from "react-native";
import { CaretRight, CaretDown, Star } from "phosphor-react-native";
import { useState } from "react";
import type * as W from "@foxing/types";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { SectionHeading } from "@/components/book/book-detail-parts";

function pacingLabel(p: string | null | undefined): string {
  if (p === "slow") return "Slow-paced";
  if (p === "fast") return "Fast-paced";
  if (p === "medium") return "Medium-paced";
  return "";
}

export function BookCommunity({ book, page }: { book: W.BookPage["book"]; page: W.BookPage }) {
  const colors = useColors();
  const [showContentWarnings, setShowContentWarnings] = useState(false);
  return (
    <>
      <SectionHeading>Community</SectionHeading>
      <View style={{ paddingHorizontal: 20 }}>
        <View className="flex-row items-center" style={{ marginBottom: 12 }}>
          <Star color={colors.brandSecondary} size={18} weight="fill" />
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 15,
              color: colors.textPrimary,
              marginLeft: 6,
            }}
          >
            {book.rating ? book.rating.toFixed(1) : ""}
          </Text>
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 12,
              color: colors.textTertiary,
              marginLeft: 10,
            }}
          >
            {book.ratingCount > 0
              ? `${book.ratingCount} rating${book.ratingCount === 1 ? "" : "s"}, `
              : ""}
            {page.readerCount} reader{page.readerCount === 1 ? "" : "s"}
          </Text>
        </View>
        {book.moodTags && book.moodTags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
            style={{ marginBottom: 8 }}
          >
            {book.moodTags.map((m) => (
              <View
                key={m}
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: colors.brandSubtle }}
              >
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 11,
                    color: colors.brandSubtleText,
                  }}
                  numberOfLines={1}
                >
                  {m}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {book.pacing ? (
          <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textSecondary }}>
            Most readers say:{" "}
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary }}>
              {pacingLabel(book.pacing)}
            </Text>
          </Text>
        ) : null}
      </View>

      {book.contentWarnings && book.contentWarnings.length > 0 ? (
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Pressable
            onPress={() => setShowContentWarnings((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={
              showContentWarnings ? "Hide content warnings" : "Show content warnings"
            }
            accessibilityState={{ expanded: showContentWarnings }}
            className="flex-row items-center justify-between px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
              Content warnings
            </Text>
            {showContentWarnings ? (
              <CaretDown color={colors.textTertiary} size={14} />
            ) : (
              <CaretRight color={colors.textTertiary} size={14} />
            )}
          </Pressable>
          {showContentWarnings ? (
            <View className="mt-2 p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
              {book.contentWarnings.map((w) => (
                <Text
                  key={w}
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  • {w}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
