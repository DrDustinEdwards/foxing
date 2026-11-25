import { View } from "react-native";
import { useColors } from "@/constants/colors";

export function ProgressBar({ ratio }: { ratio: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.bgSunken,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 6,
          width: `${Math.round(ratio * 100)}%`,
          backgroundColor: colors.brandUi,
        }}
      />
    </View>
  );
}
