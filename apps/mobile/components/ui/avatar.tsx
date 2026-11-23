import { Image, type StyleProp, Text, View, type ViewStyle } from "react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

export function Avatar({
  profile,
  size,
  style,
}: {
  profile: { avatarUrl: string | null; displayName: string | null; username: string } | null;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const initial = (profile?.displayName || profile?.username || "?")[0]?.toUpperCase() ?? "?";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...(style as object),
      }}
    >
      {profile?.avatarUrl ? (
        <Image source={{ uri: profile.avatarUrl }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Text
          style={{
            fontFamily: Fonts.display,
            fontSize: size * 0.42,
            color: colors.brandSubtleText,
          }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}
