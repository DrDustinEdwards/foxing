import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import type * as W from "@foxing/types";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { SectionHeading } from "@/components/book/book-detail-parts";

export function BookClubs({ clubs }: { clubs: W.BookPage["clubs"] }) {
  const colors = useColors();
  const router = useRouter();
  return (
    <>
      {clubs.length > 0 ? (
        <>
          <SectionHeading>Clubs reading this</SectionHeading>
          <View style={{ paddingHorizontal: 20, gap: 8 }}>
            {clubs.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/clubs/${c.id}` as never)}
                className="flex-row items-center p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 14,
                      color: colors.textPrimary,
                    }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.mono,
                      fontSize: 11,
                      color: colors.textTertiary,
                      marginTop: 2,
                    }}
                  >
                    {c.memberCount} members
                  </Text>
                </View>
                <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
                  Open
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}
