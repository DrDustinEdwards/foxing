import { type AlignmentMode, type CanvasTheme, type ColumnMode, type FlowMode, type FontFamilyKey, type FontSizeStep, type LetterSpacingStep, type LineSpacingStep, type MarginWidthStep, type PageAnim, type ParagraphSpacingStep, PRESET_THEMES, type ReaderPrefs, type SavedTheme } from '@/lib/reader-settings'
import { Colors, useColors } from '@/constants/colors'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { PreviewBox, Section, SegmentedRow, StepRow, ToggleRow } from './typography-controls'
import { Fonts } from '@/constants/fonts'
import { CaretRight, CheckCircle } from 'phosphor-react-native'
import { RulerOptions } from './ruler-options'
import { AutoScrollSpeed } from './auto-scroll-speed'

const FONT_SIZE_STEPS: FontSizeStep[] = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl']

const FONT_SIZE_LABELS: Record<FontSizeStep, string> = {
  xs: 'XS', s: 'S', m: 'M', l: 'L', xl: 'XL', '2xl': '2XL', '3xl': '3XL',
}

const FONT_FAMILY_STEPS: { key: FontFamilyKey; label: string; subtitle: string }[] = [
  { key: 'foxing', label: 'Source Serif 4', subtitle: 'Foxing default' },
  { key: 'classic', label: 'Georgia', subtitle: 'Classic' },
  { key: 'dyslexic', label: 'OpenDyslexic', subtitle: 'Dyslexic-friendly' },
  { key: 'modern', label: 'System Sans', subtitle: 'Modern' },
]

const LINE_SPACING_STEPS: LineSpacingStep[] = ['tight', 'normal', 'relaxed', 'spacious']

const LINE_SPACING_LABELS: Record<LineSpacingStep, string> = {
  tight: 'Tight', normal: 'Normal', relaxed: 'Relaxed', spacious: 'Spacious',
}

const LETTER_SPACING_STEPS: LetterSpacingStep[] = ['tight', 'normal', 'wide']

const LETTER_SPACING_LABELS: Record<LetterSpacingStep, string> = {
  tight: 'Tight', normal: 'Normal', wide: 'Wide',
}

const MARGIN_STEPS: MarginWidthStep[] = ['narrow', 'normal', 'wide', 'extra-wide']

const MARGIN_LABELS: Record<MarginWidthStep, string> = {
  narrow: 'Narrow', normal: 'Normal', wide: 'Wide', 'extra-wide': 'Extra Wide',
}

const PARAGRAPH_STEPS: ParagraphSpacingStep[] = ['compact', 'normal', 'spacious']

const PARAGRAPH_LABELS: Record<ParagraphSpacingStep, string> = {
  compact: 'Compact', normal: 'Normal', spacious: 'Spacious',
}

const PAGE_ANIM_STEPS: PageAnim[] = ['none', 'slide', 'fade']

const PAGE_ANIM_LABELS: Record<PageAnim, string> = {
  none: 'None', slide: 'Slide', fade: 'Fade',
}

// Reading canvas swatches, kept in sync with READING_THEMES in reader.tsx
// and the bg-reading tokens in design-system.md.
const CANVAS_SWATCHES: Record<CanvasTheme, { bg: string; text: string; label: string }> = {
  default: { bg: Colors.light.bgReading, text: Colors.light.textPrimary, label: 'Warm' },
  sepia: { bg: Colors.light.bgReadingSepia, text: Colors.light.textOnSepia, label: 'Sepia' },
  dark: { bg: Colors.dark.bgReading, text: Colors.dark.textPrimary, label: 'Dark' },
  oled: { bg: Colors.dark.bgReadingOled, text: Colors.dark.textOnDark, label: 'OLED' },
}

export function FontTab({ prefs, set }: { prefs: ReaderPrefs; set: <K extends keyof ReaderPrefs>(k: K, v: ReaderPrefs[K]) => void }) {
  const colors = useColors()
  return (
    <View>
      <Section label="Font size">
        <StepRow
          steps={FONT_SIZE_STEPS}
          value={prefs.fontSize}
          labelFor={(s) => FONT_SIZE_LABELS[s]}
          onSelect={(v) => set('fontSize', v)}
        />
        <PreviewBox
          fontFamily={prefs.fontFamily}
          fontSize={prefs.fontSize}
          bold={prefs.bold}
          lineSpacing={prefs.lineSpacing}
        />
      </Section>

      <Section label="Typeface">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {FONT_FAMILY_STEPS.map((f) => {
              const active = f.key === prefs.fontFamily
              return (
                <Pressable
                  key={f.key}
                  onPress={() => set('fontFamily', f.key)}
                  className="rounded-2xl px-4 py-3 border"
                  style={{
                    backgroundColor: active ? colors.brandSubtle : colors.bgSurface,
                    borderColor: active ? colors.brandText : colors.borderSubtle,
                    minWidth: 110,
                  }}
                >
                  <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 15, color: colors.textPrimary }}>
                    {f.label}
                  </Text>
                  <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
                    {f.subtitle}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </Section>

      <Section label="Bold">
        <ToggleRow
          value={prefs.bold}
          onValueChange={(v) => set('bold', v)}
          label="Bold all text"
        />
      </Section>

      <Section label="Line spacing">
        <StepRow
          steps={LINE_SPACING_STEPS}
          value={prefs.lineSpacing}
          labelFor={(s) => LINE_SPACING_LABELS[s]}
          onSelect={(v) => set('lineSpacing', v)}
        />
      </Section>

      <Section label="Letter spacing">
        <StepRow
          steps={LETTER_SPACING_STEPS}
          value={prefs.letterSpacing}
          labelFor={(s) => LETTER_SPACING_LABELS[s]}
          onSelect={(v) => set('letterSpacing', v)}
        />
      </Section>

      <Section label="First-line indent">
        <ToggleRow
          value={prefs.firstLineIndent}
          onValueChange={(v) => set('firstLineIndent', v)}
          label="Indent the first line of every paragraph"
        />
      </Section>

      <Section label="Drop cap">
        <ToggleRow
          value={prefs.dropCap}
          onValueChange={(v) => set('dropCap', v)}
          label="Large stylized letter at chapter starts"
        />
      </Section>
    </View>
  )
}

export function LayoutTab({
  prefs,
  set,
  isTablet,
}: {
  prefs: ReaderPrefs
  set: <K extends keyof ReaderPrefs>(k: K, v: ReaderPrefs[K]) => void
  isTablet: boolean
}) {
  return (
    <View>
      <Section label="Margin width">
        <StepRow
          steps={MARGIN_STEPS}
          value={prefs.marginWidth}
          labelFor={(s) => MARGIN_LABELS[s]}
          onSelect={(v) => set('marginWidth', v)}
        />
      </Section>

      <Section label="Text alignment">
        <SegmentedRow
          steps={['justified', 'left'] as AlignmentMode[]}
          value={prefs.alignment}
          labelFor={(s) => (s === 'justified' ? 'Justified' : 'Left aligned')}
          onSelect={(v) => set('alignment', v)}
        />
      </Section>

      <Section label="Paragraph spacing">
        <StepRow
          steps={PARAGRAPH_STEPS}
          value={prefs.paragraphSpacing}
          labelFor={(s) => PARAGRAPH_LABELS[s]}
          onSelect={(v) => set('paragraphSpacing', v)}
        />
      </Section>

      <Section label="Flow">
        <SegmentedRow
          steps={['paginated', 'scrolled'] as FlowMode[]}
          value={prefs.flowMode}
          labelFor={(s) => (s === 'paginated' ? 'Paginated' : 'Continuous scroll')}
          onSelect={(v) => set('flowMode', v)}
        />
      </Section>

      {isTablet && (
        <Section label="Columns">
          <SegmentedRow
            steps={['single', 'two'] as ColumnMode[]}
            value={prefs.columnMode}
            labelFor={(s) => (s === 'single' ? 'Single' : 'Two columns')}
            onSelect={(v) => set('columnMode', v)}
          />
        </Section>
      )}
    </View>
  )
}

export function CanvasTab({
  prefs,
  set,
}: {
  prefs: ReaderPrefs
  set: <K extends keyof ReaderPrefs>(k: K, v: ReaderPrefs[K]) => void
}) {
  const colors = useColors()
  return (
    <View>
      <Section label="Reading theme">
        <View className="flex-row gap-2">
          {(['default', 'sepia', 'dark', 'oled'] as CanvasTheme[]).map((t) => {
            const swatch = CANVAS_SWATCHES[t]
            const active = t === prefs.canvasTheme
            return (
              <Pressable
                key={t}
                onPress={() => set('canvasTheme', t)}
                className="flex-1 rounded-2xl py-5 items-center justify-center"
                style={{
                  backgroundColor: swatch.bg,
                  borderWidth: 2,
                  borderColor: active ? colors.brandUi : 'transparent',
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
                  {active ? (
                    <CheckCircle color={swatch.text} size={12} />
                  ) : null}
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 11,
                      color: swatch.text,
                      opacity: 0.7,
                      marginLeft: active ? 4 : 0,
                    }}
                  >
                    {swatch.label}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </Section>

      <Section label="Reading Ruler">
        <ToggleRow
          value={prefs.rulerEnabled}
          onValueChange={(v) => set('rulerEnabled', v)}
          label="Highlight current line"
        />
        {prefs.rulerEnabled && (
          <RulerOptions
            rulerColor={prefs.rulerColor}
            rulerStyle={prefs.rulerStyle}
            onSelectColor={(c) => set('rulerColor', c)}
            onSelectStyle={(v) => set('rulerStyle', v)}
          />
        )}
      </Section>

      <Section label="Popular highlights">
        <ToggleRow
          value={prefs.popularHighlightsEnabled}
          onValueChange={(v) => set('popularHighlightsEnabled', v)}
          label="Show passages others highlighted"
        />
      </Section>

      <Section label="Page turn animation">
        <SegmentedRow
          steps={PAGE_ANIM_STEPS}
          value={prefs.pageAnim}
          labelFor={(s) => PAGE_ANIM_LABELS[s]}
          onSelect={(v) => set('pageAnim', v)}
        />
      </Section>

      <Section label="Blue light filter">
        <ToggleRow
          value={prefs.warmScreen}
          onValueChange={(v) => set('warmScreen', v)}
          label="Warmer screen tone for evening reading"
        />
      </Section>

      <Section label="Focus mode">
        <ToggleRow
          value={prefs.focusMode}
          onValueChange={(v) => set('focusMode', v)}
          label="Dim everything except the paragraph you're on"
        />
      </Section>

      <Section label="Auto-scroll">
        <ToggleRow
          value={prefs.autoScroll}
          onValueChange={(v) => set('autoScroll', v)}
          label="Advance pages automatically"
        />
        {prefs.autoScroll ? (
          <AutoScrollSpeed
            autoScrollWpm={prefs.autoScrollWpm}
            onSelect={(wpm) => set('autoScrollWpm', wpm)}
          />
        ) : null}
      </Section>

    </View>
  )
}

export function ThemesTab({
  prefs,
  savedThemes,
  savingTheme,
  themeName,
  onStartSave,
  onCancelSave,
  onChangeName,
  onCommitSave,
  onApply,
}: {
  prefs: ReaderPrefs
  savedThemes: SavedTheme[]
  savingTheme: boolean
  themeName: string
  onStartSave: () => void
  onCancelSave: () => void
  onChangeName: (n: string) => void
  onCommitSave: () => void
  onApply: (theme: SavedTheme) => void
}) {
  const colors = useColors()
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
              <ThemeCard key={t.id} theme={t} active={false} onPress={() => onApply(t)} />
            ))}
          </View>
        </Section>
      )}

      <Section label="Presets">
        <View className="gap-2">
          {PRESET_THEMES.map((t) => (
            <ThemeCard key={t.id} theme={t} active={false} onPress={() => onApply(t)} />
          ))}
        </View>
      </Section>
    </View>
  )
}

function ThemeCard({ theme, active, onPress }: { theme: SavedTheme; active: boolean; onPress: () => void }) {
  const colors = useColors()
  const swatch = CANVAS_SWATCHES[theme.prefs.canvasTheme]
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl px-4 py-3 flex-row items-center border"
      style={{
        backgroundColor: colors.bgSurface,
        borderColor: active ? colors.brandUi : colors.borderSubtle,
      }}
    >
      <View
        style={{
          width: 36, height: 36, borderRadius: 8, backgroundColor: swatch.bg,
          marginRight: 12, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: colors.borderSubtle,
        }}
      >
        <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: swatch.text }}>Aa</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
          {theme.name}
        </Text>
        <Text style={{ fontFamily: Fonts.ui, fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
          {theme.isPreset ? 'Preset' : 'Custom'}
        </Text>
      </View>
      <CaretRight color={colors.brandText} size={18} />
    </Pressable>
  )
}
