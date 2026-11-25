import { Pressable, Text, View } from "react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

export function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: readonly { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
  className: string;
}) {
  const colors = useColors();
  return (
    <View className={className}>
      {tabs.map((t) => {
        const selected = active === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className="flex-1 py-2 items-center"
            style={{
              borderBottomWidth: 2,
              borderBottomColor: selected ? colors.borderInteractive : colors.borderSubtle,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 13,
                color: selected ? colors.brandText : colors.textTertiary,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconTabButton<T extends string>({
  tab,
  current,
  setTab,
  icon: Icon,
  label,
}: {
  tab: T;
  current: T;
  setTab: (t: T) => void;
  icon: React.ComponentType<{ color: string; size: number; weight?: "regular" | "bold" }>;
  label: string;
}) {
  const colors = useColors();
  const active = tab === current;
  return (
    <Pressable
      onPress={() => setTab(tab)}
      className="flex-1 items-center py-2"
      style={{
        borderBottomWidth: 2,
        borderBottomColor: active ? colors.borderInteractive : colors.borderSubtle,
      }}
    >
      <View className="flex-row items-center gap-1">
        <Icon color={active ? colors.brandText : colors.textTertiary} size={14} weight="regular" />
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: active ? colors.brandText : colors.textTertiary,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
