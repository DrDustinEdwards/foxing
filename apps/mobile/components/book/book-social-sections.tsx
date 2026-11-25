import { View, Text } from "react-native";
import type * as W from "@foxing/types";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { SectionHeading } from "@/components/book/book-detail-parts";

export function BookSocialSections({ page }: { page: W.BookPage }) {
  const colors = useColors();
  return (
    <>
      <SectionHeading>Recent reviews</SectionHeading>
      <View style={{ paddingHorizontal: 20 }}>
        {page.reviews.length === 0 ? (
          <Text
            style={{
              fontFamily: Fonts.ui,
              fontSize: 12,
              color: colors.textTertiary,
              marginBottom: 12,
            }}
          >
            No public reviews yet.
          </Text>
        ) : (
          page.reviews.map((r) => (
            <View
              key={r.id}
              className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <View className="flex-row items-center" style={{ marginBottom: 4 }}>
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 12,
                    color: colors.textPrimary,
                  }}
                >
                  {r.author?.displayName ?? r.author?.username ?? "Reader"}
                </Text>
                {r.ratingHalf ? (
                  <Text
                    style={{
                      fontFamily: Fonts.mono,
                      fontSize: 11,
                      color: colors.brandSecondary,
                      marginLeft: 8,
                    }}
                  >
                    {"★".repeat(Math.floor(r.ratingHalf / 2))}
                    {r.ratingHalf % 2 ? "½" : ""}
                  </Text>
                ) : null}
              </View>
              <Text
                style={{
                  fontFamily: Fonts.body,
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}
                numberOfLines={4}
              >
                {r.containsSpoilers ? "Contains spoilers." : r.review}
              </Text>
            </View>
          ))
        )}
      </View>

      {page.popular.length > 0 ? (
        <>
          <SectionHeading>Popular highlights</SectionHeading>
          <View style={{ paddingHorizontal: 20, gap: 8 }}>
            {page.popular.map((h) => {
              return (
                <View
                  key={h.normalizedText}
                  className="p-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
                >
                  <Text
                    style={{
                      fontFamily: Fonts.bodyItalic,
                      fontSize: 14,
                      color: colors.textPrimary,
                      lineHeight: 21,
                    }}
                    numberOfLines={4}
                  >
                    "{h.normalizedText}"
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: colors.textTertiary,
                      marginTop: 6,
                    }}
                  >
                    Highlighted by {h.count} readers
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </>
  );
}
