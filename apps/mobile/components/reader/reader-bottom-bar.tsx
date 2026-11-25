import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CaretUp, Sparkle } from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import type { MenuInitialView } from "@/components/reader/menu-sheet";
import { ProgressSlider } from "@/components/reader/progress-slider";
import type { SleepTimerOption } from "@/components/reader/sleep-timer-sheet";
import { formatRemaining } from "@/components/reader/reader-screen-helpers";

export function ReaderBottomBar({
  chromeBg,
  isTablet,
  progress,
  chapterTitle,
  clubName,
  presenceCount,
  sleepTimer,
  sleepRemainingMs,
  isPdf,
  onJump,
  onOpenClub,
  onOpenMenu,
}: {
  chromeBg: string;
  isTablet: boolean;
  progress: number;
  chapterTitle: string;
  clubName: string | null;
  presenceCount: number;
  sleepTimer: SleepTimerOption | null;
  sleepRemainingMs: number | null;
  isPdf: boolean;
  onJump: (fraction: number) => void;
  onOpenClub: () => void;
  onOpenMenu: (view: MenuInitialView) => void;
}) {
  const colors = useColors();
  return (
    <SafeAreaView
      edges={["bottom"]}
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0"
    >
      <View
        style={{
          backgroundColor: chromeBg,
          borderTopWidth: 1,
          borderTopColor: colors.borderSubtle,
          paddingHorizontal: isTablet ? 24 : 16,
          paddingTop: isTablet ? 14 : 10,
          paddingBottom: isTablet ? 16 : 12,
        }}
      >
        <ProgressSlider
          value={progress}
          onSlidingComplete={(fraction) => {
            onJump(fraction);
          }}
        />
        <View className="flex-row items-center" style={{ marginTop: 8 }}>
          {clubName !== null ? (
            <Pressable
              onPress={() => onOpenClub()}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${clubName} club panel`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: colors.bgSelected,
                marginRight: 8,
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: colors.brandSubtle,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: Fonts.display,
                    fontSize: 9,
                    color: colors.brandSubtleText,
                  }}
                >
                  {(clubName[0] ?? "?").toUpperCase()}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 11,
                  color: colors.brandText,
                }}
              >
                {presenceCount > 0 ? `${presenceCount} reading` : "Club"}
              </Text>
            </Pressable>
          ) : null}
          {/* Chapter label on the left, a prominent percent read-out on
                  the right so progress is legible at a glance. */}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: Fonts.ui,
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            {chapterTitle || "Progress"}
          </Text>
          <Text
            accessibilityLabel={`${Math.round(progress * 100)} percent read`}
            style={{
              fontFamily: Fonts.monoMedium,
              fontSize: 12,
              color: colors.brandText,
              marginRight: 8,
            }}
          >
            {Math.round(progress * 100)}%
          </Text>
          {sleepTimer ? (
            <View
              style={{
                marginRight: 8,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: colors.bgSelected,
              }}
              accessibilityLabel="Sleep timer active"
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 11,
                  color: colors.brandText,
                }}
              >
                {sleepTimer.kind === "end_of_chapter"
                  ? "EOC"
                  : sleepRemainingMs != null
                    ? formatRemaining(sleepRemainingMs)
                    : sleepTimer.kind === "minutes"
                      ? `${sleepTimer.minutes}:00`
                      : ""}
              </Text>
            </View>
          ) : null}
          {isPdf ? (
            <View
              style={{
                marginRight: 8,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: colors.bgSelected,
              }}
              accessibilityLabel="PDF mode"
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 9,
                  color: colors.brandText,
                  letterSpacing: 0.6,
                }}
              >
                PDF
              </Text>
            </View>
          ) : null}
          {/* Companion button: opens the This book and chapter tools. */}
          <Pressable
            onPress={() => {
              onOpenMenu("companion");
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Companion"
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 10,
              paddingVertical: 4,
              marginRight: 6,
              borderRadius: 999,
              backgroundColor: colors.bgSelected,
            }}
          >
            <Sparkle color={colors.brandText} size={16} />
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: colors.brandText,
                marginLeft: 4,
              }}
            >
              Companion
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              onOpenMenu("secondary");
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More actions"
            style={{ paddingHorizontal: 6, paddingVertical: 4 }}
          >
            <CaretUp color={colors.brandUi} size={20} weight="regular" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
