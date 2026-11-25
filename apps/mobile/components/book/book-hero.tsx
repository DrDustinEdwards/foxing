import { View, Text, Pressable, Image } from "react-native";
import { CaretLeft, ShareNetwork } from "phosphor-react-native";
import type * as W from "@foxing/types";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

export function BookHero({
  book,
  onBack,
  onShare,
}: {
  book: W.BookPage["book"];
  onBack: () => void;
  onShare: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ height: 320, backgroundColor: colors.bgSunken }}>
      {book.coverUrl ? (
        <Image
          source={{ uri: book.coverUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          blurRadius={4}
        />
      ) : null}
      {/* Faux-gradient: solid translucent stripes at the bottom faking a fade.
              Avoids adding expo-linear-gradient as a native dep just for this. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          backgroundColor: colors.bgBase,
          opacity: 0.55,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          backgroundColor: colors.bgBase,
          opacity: 0.85,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingTop: 48,
        }}
      >
        <Pressable
          onPress={() => onBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.scrimLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CaretLeft color={colors.textOnDark} size={18} />
        </Pressable>
        <Pressable
          onPress={() => onShare()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Share book"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.scrimLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShareNetwork color={colors.textOnDark} size={18} />
        </Pressable>
      </View>
      {/* Cover thumbnail centered over the bottom of the hero */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -30,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 120,
            height: 180,
            borderRadius: 8,
            overflow: "hidden",
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          {book.coverUrl ? (
            <Image
              source={{ uri: book.coverUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              accessibilityRole="image"
              accessibilityLabel={`${book.title} book cover`}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 8 }}>
              <Text
                style={{
                  fontFamily: Fonts.display,
                  fontSize: 14,
                  color: colors.textTertiary,
                  textAlign: "center",
                }}
                numberOfLines={4}
              >
                {book.title}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
