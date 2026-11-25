import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import type * as W from "@foxing/types";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

export function BookIdentity({ book }: { book: W.BookPage["book"] }) {
  const colors = useColors();
  const router = useRouter();
  const readMinutes = book.wordCount ? Math.round(book.wordCount / 250) : null;
  const readingTimeLabel = readMinutes
    ? readMinutes >= 60
      ? `~${Math.round(readMinutes / 60)} hr read`
      : `~${readMinutes} min read`
    : null;
  const subjects = (book.subjects ?? []).slice(0, 8);
  return (
    <>
      <Text
        style={{
          fontFamily: Fonts.displayBold,
          fontSize: 22,
          color: colors.textPrimary,
          textAlign: "center",
        }}
      >
        {book.title}
      </Text>
      <Pressable
        onPress={() => book.authorSlug && router.push(`/author/${book.authorSlug}` as never)}
      >
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 14,
            color: colors.brandText,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {book.author}
        </Text>
      </Pressable>
      {book.seriesName ? (
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 11,
            color: colors.textTertiary,
            textAlign: "center",
            marginTop: 2,
          }}
        >
          {book.seriesName}
          {book.seriesOrder ? `, book ${book.seriesOrder}` : ""}
        </Text>
      ) : null}
      {readingTimeLabel ? (
        <Text
          style={{
            fontFamily: Fonts.mono,
            fontSize: 11,
            color: colors.textTertiary,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {readingTimeLabel}
        </Text>
      ) : null}

      {subjects.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 12, gap: 6 }}
        >
          {subjects.map((s) => (
            <View
              key={s}
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: colors.brandSubtle }}
            >
              <Text
                style={{
                  fontFamily: Fonts.ui,
                  fontSize: 11,
                  color: colors.brandSubtleText,
                }}
                numberOfLines={1}
              >
                {s
                  .split(/[\u2014\u2013\-:]/)[0]
                  .trim()
                  .slice(0, 40)}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </>
  );
}
