import { Pressable, Text } from "react-native";
import { Eye, EyeSlash } from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

export function VisibilityToggle({
  isPublic,
  onToggle,
  publicLabel,
}: {
  isPublic: boolean;
  onToggle: () => void;
  publicLabel: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center gap-3 p-3 rounded-xl border border-border-subtle-light dark:border-border-subtle-dark"
    >
      {isPublic ? (
        <Eye color={colors.info} size={18} />
      ) : (
        <EyeSlash color={colors.textTertiary} size={18} />
      )}
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 14,
          color: colors.textPrimary,
        }}
      >
        {isPublic ? publicLabel : "Private to you"}
      </Text>
    </Pressable>
  );
}
