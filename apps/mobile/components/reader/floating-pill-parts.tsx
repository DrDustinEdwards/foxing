import type { PillMode } from "./floating-pill";
import { useColors } from "@/constants/colors";
import {
  BookmarkSimple,
  ChatCircle,
  Highlighter,
  type Icon,
  Lock,
  MagnifyingGlass,
  Translate,
  UsersThree,
  X as XIcon,
} from "phosphor-react-native";
import { SheetScaffold } from "@/components/ui/sheet-scaffold";
import { Pressable, Text, View } from "react-native";
import { Fonts } from "@/constants/fonts";
import { SectionLabel } from "@/components/ui/section-label";

export function AllOptionsSheet({
  visible,
  mode,
  showClub,
  locked,
  onUpgrade,
  onClose,
  onLookup,
  onAnalyze,
  onAsk,
  onTranslate,
  onClub,
  onHighlight,
  onSavePassage,
  onDismissAll,
}: {
  visible: boolean;
  mode: PillMode;
  showClub: boolean;
  locked?: boolean;
  onUpgrade?: (feature: string) => void;
  onClose: () => void;
  onLookup?: () => void;
  onAnalyze?: () => void;
  onAsk?: () => void;
  onTranslate?: () => void;
  onClub?: () => void;
  onHighlight: () => void;
  onSavePassage: () => void;
  onDismissAll: () => void;
}) {
  const colors = useColors();
  const items: Array<{
    key: string;
    label: string;
    Icon: Icon;
    onPress: () => void;
    destructive?: boolean;
    gated?: boolean;
  }> = [];
  items.push({ key: "highlight", label: "Highlight", Icon: Highlighter, onPress: onHighlight });
  if (mode === "word") {
    items.push({
      key: "lookup",
      label: "Look up",
      Icon: MagnifyingGlass,
      onPress: () => onLookup?.(),
      gated: true,
    });
    items.push({
      key: "translate",
      label: "Translate",
      Icon: Translate,
      onPress: () => onTranslate?.(),
      gated: true,
    });
    items.push({
      key: "ask",
      label: "Ask",
      Icon: ChatCircle,
      onPress: () => onAsk?.(),
      gated: true,
    });
  } else {
    items.push({
      key: "analyze",
      label: "Analyze",
      Icon: MagnifyingGlass,
      onPress: () => onAnalyze?.(),
      gated: true,
    });
    items.push({
      key: "ask",
      label: "Ask",
      Icon: ChatCircle,
      onPress: () => onAsk?.(),
      gated: true,
    });
    if (showClub) {
      items.push({ key: "comment", label: "Comment", Icon: UsersThree, onPress: () => onClub?.() });
    }
    items.push({
      key: "translate",
      label: "Translate",
      Icon: Translate,
      onPress: () => onTranslate?.(),
      gated: true,
    });
    items.push({
      key: "save",
      label: "Save Passage",
      Icon: BookmarkSimple,
      onPress: onSavePassage,
    });
  }
  items.push({
    key: "dismiss",
    label: "Dismiss",
    Icon: XIcon,
    onPress: onDismissAll,
    destructive: true,
  });

  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      scroll={false}
      header={
        <SectionLabel style={{ paddingHorizontal: 20, marginBottom: 8 }}>Actions</SectionLabel>
      }
    >
      {items.map((item, i) => {
        const isLocked = !!locked && !!item.gated;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              onClose();
              if (isLocked) {
                onUpgrade?.(item.label);
                return;
              }
              item.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={isLocked ? `${item.label}, Plus feature` : item.label}
            className="flex-row items-center px-5"
            style={{
              minHeight: 56,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.borderSubtle,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: colors.brandSubtle,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <item.Icon color={item.destructive ? colors.error : colors.brandUi} size={16} />
              {isLocked ? <LockBadge colors={colors} /> : null}
            </View>
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 15,
                color: item.destructive ? colors.error : colors.textPrimary,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </SheetScaffold>
  );
}

// autoFocus is iOS-only; passing it elsewhere is a no-op via the type cast.
export function PillAction({
  Icon,
  label,
  a11yLabel,
  onPress,
  primary,
  iconOnly,
  autoFocus,
  showLock,
}: {
  Icon: React.ComponentType<{ color: string; size: number; weight?: "regular" | "bold" | "fill" }>;
  label: string;
  a11yLabel: string;
  onPress: () => void;
  primary?: boolean;
  iconOnly?: boolean;
  autoFocus?: boolean;
  showLock?: boolean;
}) {
  const colors = useColors();
  const ICON_SIZE = 18;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      // oxlint-disable-next-line typescript/no-explicit-any -- accessibilityAutoFocus is missing from React Native's Pressable props type
      {...(autoFocus ? ({ accessibilityAutoFocus: true } as any) : {})}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: primary ? 12 : 8,
        paddingVertical: 8,
        marginVertical: 2,
        marginHorizontal: primary ? 2 : 0,
        borderRadius: 999,
        backgroundColor: primary ? colors.brandSubtle : "transparent",
      }}
    >
      <View>
        <Icon color={primary ? colors.brandSubtleText : colors.brandText} size={ICON_SIZE} />
        {showLock ? <LockBadge colors={colors} /> : null}
      </View>
      {iconOnly ? null : (
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 13,
            color: primary ? colors.brandSubtleText : colors.textSecondary,
            marginLeft: 6,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function LockBadge({
  colors,
  size = 13,
}: {
  colors: ReturnType<typeof useColors>;
  size?: number;
}) {
  return (
    <View
      style={{
        position: "absolute",
        top: -size * 0.4,
        right: -size * 0.5,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.bgSurface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Lock color={colors.brandText} size={Math.round(size * 0.7)} weight="fill" />
    </View>
  );
}
