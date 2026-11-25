import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { BookOpen } from "phosphor-react-native";
import type * as W from "@foxing/types";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { SectionHeading } from "@/components/book/book-detail-parts";

export function BookRow({
  title,
  books,
  onOpen,
}: {
  title: string;
  books: W.BookCard[];
  onOpen: (slug: string) => void;
}) {
  const colors = useColors();
  if (books.length === 0) return null;
  return (
    <>
      <SectionHeading>{title}</SectionHeading>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {books.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => onOpen(b.slug)}
            accessibilityRole="link"
            accessibilityLabel={`${b.title} by ${b.author}`}
            style={{ width: 100 }}
          >
            <View
              style={{
                width: 100,
                height: 150,
                borderRadius: 6,
                overflow: "hidden",
                backgroundColor: colors.bgSunken,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 6,
              }}
            >
              {b.coverUrl ? (
                <Image source={{ uri: b.coverUrl }} style={{ width: "100%", height: "100%" }} />
              ) : (
                <BookOpen color={colors.textTertiary} size={20} />
              )}
            </View>
            <Text
              style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textPrimary }}
              numberOfLines={2}
            >
              {b.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}
