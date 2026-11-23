import {
  type CanvasTheme,
  type FontSizeStep,
  PRESET_THEMES,
  type ReaderPrefs,
  type SavedTheme,
} from "@/lib/reader-settings";
import { useColors } from "@/constants/colors";
import { Pressable, Text, TextInput, View } from "react-native";
import { PreviewBox, Section, StepRow } from "./typography-controls";
import { ToggleRow } from "@/components/settings/settings-rows";
import { CANVAS_PALETTE } from "./reader-screen-helpers";
import { Fonts } from "@/constants/fonts";
import { CaretRight, CheckCircle } from "phosphor-react-native";

const FONT_SIZE_STEPS: FontSizeStep[] = ["xs", "s", "m", "l", "xl", "2xl", "3xl"];

const FONT_SIZE_LABELS: Record<FontSizeStep, string> = {
  xs: "XS",
  s: "S",
  m: "M",
  l: "L",
  xl: "XL",
  "2xl": "2XL",
  "3xl": "3XL",
};

const CANVAS_LABELS: Record<CanvasTheme, string> = {
  default: "Warm",
  sepia: "Sepia",
  dark: "Dark",
  oled: "OLED",
};

export function FontTab({
  prefs,
  set,
}: {
  prefs: ReaderPrefs;
  set: <K extends keyof ReaderPrefs>(k: K, v: ReaderPrefs[K]) => void;
}) {
  return (
    <Section label="Font size">
      <StepRow
        steps={FONT_SIZE_STEPS}
        value={prefs.fontSize}
        labelFor={(s) => FONT_SIZE_LABELS[s]}
        onSelect={(v) => set("fontSize", v)}
      />
      <PreviewBox fontSize={prefs.fontSize} />
    </Section>
  );
}

export function CanvasTab({
  prefs,
  set,
}: {
  prefs: ReaderPrefs;
  set: <K extends keyof ReaderPrefs>(k: K, v: ReaderPrefs[K]) => void;
}) {
  const colors = useColors();
  return (
    <View>
      <Section label="Reading theme">
        <View className="flex-row gap-2">
          {(["default", "sepia", "dark", "oled"] as CanvasTheme[]).map((t) => {
            const swatch = CANVAS_PALETTE[t];
            const active = t === prefs.canvasTheme;
            return (
              <Pressable
                key={t}
                onPress={() => set("canvasTheme", t)}
                className="flex-1 rounded-2xl py-5 items-center justify-center"
                style={{
                  backgroundColor: swatch.background,
                  borderWidth: 2,
                  borderColor: active ? colors.brandUi : "transparent",
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 16,
                    color: swatch.text,
                  }}
                >
                  Aa
                </Text>
                <View className="flex-row items-center mt-1">
                  {active ? <CheckCircle color={swatch.text} size={12} /> : null}
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: swatch.text,
                      opacity: 0.7,
                      marginLeft: active ? 4 : 0,
                    }}
                  >
                    {CANVAS_LABELS[t]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section label="Popular highlights">
        <ToggleRow
          label="Show popular highlights"
          value={prefs.popularHighlightsEnabled}
          onChange={(v) => set("popularHighlightsEnabled", v)}
        />
      </Section>
    </View>
  );
}

export function ThemesTab({
  savedThemes,
  savingTheme,
  themeName,
  onStartSave,
  onCancelSave,
  onChangeName,
  onCommitSave,
  onApply,
}: {
  savedThemes: SavedTheme[];
  savingTheme: boolean;
  themeName: string;
  onStartSave: () => void;
  onCancelSave: () => void;
  onChangeName: (n: string) => void;
  onCommitSave: () => void;
  onApply: (theme: SavedTheme) => void;
}) {
  const colors = useColors();
  return (
    <View>
      <Section label="Save current">
        {savingTheme ? (
          <View className="flex-row items-center gap-2">
            <TextInput
              value={themeName}
              onChangeText={onChangeName}
              placeholder="Theme name"
              placeholderTextColor={colors.textTertiary}
              className="flex-1 rounded-xl px-3 py-2 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark text-text-primary-light dark:text-text-primary-dark"
              style={{ fontFamily: Fonts.ui, fontSize: 14 }}
              onSubmitEditing={onCommitSave}
              autoFocus
            />
            <Pressable
              onPress={onCommitSave}
              className="rounded-xl px-4 py-2 bg-brand-ui-light dark:bg-brand-ui-dark"
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand }}>Save</Text>
            </Pressable>
            <Pressable onPress={onCancelSave} className="px-2 py-2">
              <Text style={{ fontFamily: Fonts.ui, color: colors.textTertiary }}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onStartSave}
            className="rounded-2xl py-3 items-center border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>
              + Save current settings as theme
            </Text>
          </Pressable>
        )}
      </Section>

      {savedThemes.length > 0 && (
        <Section label="Your themes">
          <View className="gap-2">
            {savedThemes.map((t) => (
              <ThemeCard key={t.id} theme={t} onPress={() => onApply(t)} />
            ))}
          </View>
        </Section>
      )}

      <Section label="Presets">
        <View className="gap-2">
          {PRESET_THEMES.map((t) => (
            <ThemeCard key={t.id} theme={t} onPress={() => onApply(t)} />
          ))}
        </View>
      </Section>
    </View>
  );
}

function ThemeCard({ theme, onPress }: { theme: SavedTheme; onPress: () => void }) {
  const colors = useColors();
  const swatch = CANVAS_PALETTE[theme.prefs.canvasTheme];
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl px-4 py-3 flex-row items-center border"
      style={{
        backgroundColor: colors.bgSurface,
        borderColor: colors.borderSubtle,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: swatch.background,
          marginRight: 12,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        }}
      >
        <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: swatch.text }}>Aa</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
          {theme.name}
        </Text>
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}
        >
          {theme.isPreset ? "Preset" : "Custom"}
        </Text>
      </View>
      <CaretRight color={colors.brandText} size={18} />
    </Pressable>
  );
}
