import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  ActivityIndicator,
  Share,
  useWindowDimensions,
} from 'react-native'
import { CheckCircle, CaretRight } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { getLanguageDifficulty } from '@/lib/claude'
import { useColors, Colors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  type ReaderPrefs,
  type FontSizeStep,
  type FontFamilyKey,
  type LineSpacingStep,
  type LetterSpacingStep,
  type MarginWidthStep,
  type ParagraphSpacingStep,
  type AlignmentMode,
  type FlowMode,
  type ColumnMode,
  type CanvasTheme,
  type PageAnim,
  type SavedTheme,
  PRESET_THEMES,
  loadSavedThemes,
  saveCustomTheme,
} from '@/lib/reader-settings'
import { ReadingLevelContent } from './reading-level-content'
import { RulerOptions } from './ruler-options'
import { AutoScrollSpeed } from './auto-scroll-speed'

type TabKey = 'font' | 'layout' | 'canvas' | 'themes' | 'language'

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Japanese',
  'Mandarin',
] as const

interface TypographySheetProps {
  visible: boolean
  prefs: ReaderPrefs
  userId: string | null
  // Book context, used by the Language tab for difficulty + Anki export.
  // Optional so non-reader callers can omit (the Language tab gates on it).
  bookId?: string
  bookTitle?: string
  bookAuthor?: string
  // Tablet layout, when true the sheet docks to the right edge as a 360-wide
  // side panel instead of sliding up from the bottom. Same content, different
  // wrapper. Caller decides based on useWindowDimensions().
  sidePanel?: boolean
  onChangePrefs: (next: ReaderPrefs) => void
  onClose: () => void
}

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

export function TypographySheet({
  visible,
  prefs,
  userId,
  bookId,
  bookTitle,
  bookAuthor,
  sidePanel = false,
  onChangePrefs,
  onClose,
}: TypographySheetProps) {
  const colors = useColors()
  const [tab, setTab] = useState<TabKey>('font')
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([])
  const [savingTheme, setSavingTheme] = useState(false)
  const [themeName, setThemeName] = useState('')
  const { width } = useWindowDimensions()
  // Two-column option only surfaces on tablets, sub-768 phones don't get
  // it, even though the underlying setting is persisted regardless.
  const isTablet = width >= 768

  useEffect(() => {
    if (!visible) return
    ;(async () => {
      setSavedThemes(await loadSavedThemes(userId))
    })()
  }, [visible, userId])

  function set<K extends keyof ReaderPrefs>(k: K, v: ReaderPrefs[K]) {
    onChangePrefs({ ...prefs, [k]: v })
  }

  async function commitTheme() {
    if (!themeName.trim()) {
      setSavingTheme(false)
      return
    }
    const saved: SavedTheme = {
      id: `custom-${Date.now()}`,
      name: themeName.trim(),
      prefs,
    }
    await saveCustomTheme(userId, saved)
    setSavedThemes(await loadSavedThemes(userId))
    setThemeName('')
    setSavingTheme(false)
  }

  function applyTheme(theme: SavedTheme) {
    onChangePrefs(theme.prefs)
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        className={sidePanel ? 'flex-1 flex-row justify-end' : 'flex-1 justify-end'}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
          className={
            sidePanel
              ? 'px-5 pt-12 pb-8 bg-bg-elevated-light dark:bg-bg-elevated-dark border-l border-border-subtle-light dark:border-border-subtle-dark'
              : 'rounded-t-3xl px-5 pt-4 pb-8 bg-bg-elevated-light dark:bg-bg-elevated-dark border-t border-border-subtle-light dark:border-border-subtle-dark'
          }
          style={sidePanel ? { width: 360, height: '100%' } : { maxHeight: '85%' }}
        >
          {/* Header + Done */}
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-text-primary-light dark:text-text-primary-dark"
              style={{ fontFamily: Fonts.display, fontSize: 18 }}
            >
              Reading
            </Text>
            <Pressable onPress={onClose}>
              <Text
                className="text-brand-text-light dark:text-brand-text-dark"
                style={{ fontFamily: Fonts.uiMedium, fontSize: 16 }}
              >
                Done
              </Text>
            </Pressable>
          </View>

          {/* Tab strip */}
          <View
            className="flex-row mb-4 rounded-full p-1 bg-bg-sunken-light dark:bg-bg-sunken-dark"
            accessibilityRole="tablist"
          >
            {(['font', 'layout', 'canvas', 'themes', 'language'] as const).map((t) => {
              const active = t === tab
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  className="flex-1 items-center py-2 rounded-full"
                  style={{ backgroundColor: active ? colors.bgSurface : 'transparent' }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 13,
                      color: active ? colors.textPrimary : colors.textTertiary,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {tab === 'font' && (
              <FontTab
                prefs={prefs}
                set={set}
              />
            )}
            {tab === 'layout' && (
              <LayoutTab
                prefs={prefs}
                set={set}
                isTablet={isTablet}
              />
            )}
            {tab === 'canvas' && (
              <CanvasTab
                prefs={prefs}
                set={set}
              />
            )}
            {tab === 'themes' && (
              <ThemesTab
                prefs={prefs}
                savedThemes={savedThemes}
                savingTheme={savingTheme}
                themeName={themeName}
                onStartSave={() => setSavingTheme(true)}
                onCancelSave={() => {
                  setSavingTheme(false)
                  setThemeName('')
                }}
                onChangeName={setThemeName}
                onCommitSave={commitTheme}
                onApply={applyTheme}
              />
            )}
            {tab === 'language' && (
              <LanguageTab
                prefs={prefs}
                set={set}
                userId={userId}
                bookId={bookId}
                bookTitle={bookTitle}
                bookAuthor={bookAuthor}
              />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Font tab ────────────────────────────────────────────────────────────

function FontTab({ prefs, set }: { prefs: ReaderPrefs; set: <K extends keyof ReaderPrefs>(k: K, v: ReaderPrefs[K]) => void }) {
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

function PreviewBox({
  fontFamily,
  fontSize,
  bold,
  lineSpacing,
}: {
  fontFamily: FontFamilyKey
  fontSize: FontSizeStep
  bold: boolean
  lineSpacing: LineSpacingStep
}) {
  const colors = useColors()
  const px = { xs: 14, s: 16, m: 18, l: 20, xl: 22, '2xl': 26, '3xl': 30 }[fontSize]
  const lh = { tight: 1.4, normal: 1.7, relaxed: 1.9, spacious: 2.2 }[lineSpacing]
  const ff =
    fontFamily === 'foxing' ? Fonts.body
    : fontFamily === 'modern' ? Fonts.ui
    : undefined // Georgia / OpenDyslexic, RN falls back to system
  return (
    <View
      className="mt-3 rounded-2xl p-4 border"
      style={{ backgroundColor: colors.bgReading, borderColor: colors.borderSubtle }}
    >
      <Text
        style={{
          fontFamily: ff,
          fontSize: px,
          lineHeight: px * lh,
          fontWeight: bold ? '600' : '400',
          color: colors.textPrimary,
        }}
      >
        The fox knew of foxing too: pages mottled with brown spots, the way time itself reads a beloved book.
      </Text>
    </View>
  )
}

// ── Layout tab ──────────────────────────────────────────────────────────

function LayoutTab({
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

// ── Canvas tab ──────────────────────────────────────────────────────────

function CanvasTab({
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

      <Section label="AI Word Wise">
        <ToggleRow
          value={prefs.wordWiseEnabled}
          onValueChange={(v) => set('wordWiseEnabled', v)}
          label="Show difficult-word hints inline"
        />
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

// ── Themes tab ──────────────────────────────────────────────────────────

function ThemesTab({
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

// ── Shared primitives ──────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View className="mb-5">
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 12,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  )
}

function StepRow<T extends string>({
  steps,
  value,
  labelFor,
  onSelect,
}: {
  steps: T[]
  value: T
  labelFor: (s: T) => string
  onSelect: (v: T) => void
}) {
  const colors = useColors()
  return (
    <View className="flex-row gap-1.5">
      {steps.map((s) => {
        const active = s === value
        return (
          <Pressable
            key={s}
            onPress={() => onSelect(s)}
            className="flex-1 rounded-xl py-2.5 items-center"
            style={{
              backgroundColor: active ? colors.brandUi : colors.bgSurface,
              borderWidth: 1,
              borderColor: active ? colors.brandUi : colors.borderSubtle,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: active ? colors.textOnBrand : colors.textPrimary,
              }}
            >
              {labelFor(s)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function SegmentedRow<T extends string>({
  steps,
  value,
  labelFor,
  onSelect,
}: {
  steps: T[]
  value: T
  labelFor: (s: T) => string
  onSelect: (v: T) => void
}) {
  const colors = useColors()
  return (
    <View
      className="flex-row rounded-xl p-1 bg-bg-sunken-light dark:bg-bg-sunken-dark"
    >
      {steps.map((s) => {
        const active = s === value
        return (
          <Pressable
            key={s}
            onPress={() => onSelect(s)}
            className="flex-1 items-center py-2 rounded-lg"
            style={{ backgroundColor: active ? colors.bgSurface : 'transparent' }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                fontSize: 12,
                color: active ? colors.textPrimary : colors.textTertiary,
              }}
            >
              {labelFor(s)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Language Learning tab ───────────────────────────────────────────────

function LanguageTab({
  prefs,
  set,
  userId,
  bookId,
  bookTitle,
  bookAuthor,
}: {
  prefs: ReaderPrefs
  set: <K extends keyof ReaderPrefs>(k: K, v: ReaderPrefs[K]) => void
  userId: string | null
  bookId?: string
  bookTitle?: string
  bookAuthor?: string
}) {
  const colors = useColors()
  const [difficulty, setDifficulty] = useState<string | null>(null)
  const [difficultyBusy, setDifficultyBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Lazy-load the CEFR difficulty rating for the current book. Cached in
  // book_ai_cache so subsequent opens are instant.
  const loadDifficulty = useCallback(async () => {
    if (!bookId || !bookTitle || !bookAuthor) return
    if (difficulty) return
    setDifficultyBusy(true)
    try {
      const { data: cached } = await supabase
        .from('book_ai_cache')
        .select('content')
        .eq('cache_key', bookId)
        .eq('action', 'language_difficulty')
        .maybeSingle()
      const cachedText = (cached as { content?: string } | null)?.content
      if (cachedText) {
        setDifficulty(cachedText)
        return
      }
      const text = await getLanguageDifficulty({ bookTitle, author: bookAuthor, bookId })
      setDifficulty(text)
      await supabase
        .from('book_ai_cache')
        .upsert(
          { cache_key: bookId, action: 'language_difficulty', content: text },
          { onConflict: 'cache_key,action' },
        )
    } catch (e) {
      console.warn('[language] difficulty fetch failed:', e instanceof Error ? e.message : e)
    } finally {
      setDifficultyBusy(false)
    }
  }, [bookAuthor, bookId, bookTitle, difficulty])

  useEffect(() => {
    if (bookId && prefs.bilingualMode) loadDifficulty()
  }, [bookId, prefs.bilingualMode, loadDifficulty])

  // Write target language to profiles.language_preference for cross-device
  // recall in addition to the local ReaderPrefs flip.
  const setLanguage = useCallback(
    async (lang: string) => {
      set('targetLanguage', lang)
      if (userId) {
        await supabase
          .from('profiles')
          .update({ language_preference: lang })
          .eq('id', userId)
      }
    },
    [set, userId],
  )

  // Anki CSV export, pulls vocabulary rows for the current book, builds a
  // Front/Back two-column CSV, shares via native Share as text.
  const exportAnki = useCallback(async () => {
    if (!userId || !bookId) {
      setToast('Open a book first.')
      setTimeout(() => setToast(null), 1800)
      return
    }
    setExportBusy(true)
    try {
      const { data: rows } = await supabase
        .from('vocabulary')
        .select('word, definition, context')
        .eq('user_id', userId)
        .eq('book_id', bookId)
      const items = ((rows ?? []) as Array<{
        word: string | null
        definition: string | null
        context: string | null
      }>)
      if (items.length === 0) {
        setToast('No vocabulary saved for this book yet.')
        setTimeout(() => setToast(null), 2000)
        return
      }
      const csv = [
        'Front,Back',
        ...items.map((r) => {
          const front = escapeCsv(r.word ?? '')
          const back = escapeCsv(`${r.definition ?? ''}${r.context ? `\n\n${r.context}` : ''}`)
          return `${front},${back}`
        }),
      ].join('\n')
      await Share.share({ message: csv })
    } catch (e) {
      console.warn('[language] anki export failed:', e instanceof Error ? e.message : e)
    } finally {
      setExportBusy(false)
    }
  }, [bookId, userId])

  return (
    <View>
      <Section label="Bilingual mode">
        <ToggleRow
          value={prefs.bilingualMode}
          onValueChange={(v) => set('bilingualMode', v)}
          label="Show translations under each paragraph"
        />
      </Section>

      <Section label="Target language">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {LANGUAGES.map((lng) => {
              const active = lng === prefs.targetLanguage
              return (
                <Pressable
                  key={lng}
                  onPress={() => setLanguage(lng)}
                  className="px-3 py-2 rounded-full border"
                  style={{
                    backgroundColor: active ? colors.bgSelected : colors.bgSurface,
                    borderColor: active ? colors.borderBrand : colors.borderSubtle,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: active ? colors.brandText : colors.textSecondary,
                    }}
                  >
                    {lng}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </Section>

      <Section label="Grammar mode">
        <ToggleRow
          value={prefs.grammarMode}
          onValueChange={(v) => set('grammarMode', v)}
          label="Tap any word for grammar of its sentence"
        />
      </Section>

      {bookId ? (
        <Section label="Reading level">
          <View
            className="p-3 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <ReadingLevelContent
              difficultyBusy={difficultyBusy}
              difficulty={difficulty}
              onRate={loadDifficulty}
            />
          </View>
        </Section>
      ) : null}

      <Section label="Vocabulary export">
        <Pressable
          onPress={exportAnki}
          disabled={exportBusy}
          className="flex-row items-center justify-center py-3 rounded-full border"
          style={{ borderColor: colors.borderInteractive, opacity: exportBusy ? 0.7 : 1 }}
        >
          {exportBusy ? (
            <ActivityIndicator color={colors.brandUi} size="small" />
          ) : (
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 13, color: colors.textPrimary }}>
              Export to Anki (CSV)
            </Text>
          )}
        </Pressable>
      </Section>

      {toast ? (
        <View
          style={{ marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.bgSelected }}
        >
          <Text style={{ fontFamily: Fonts.ui, fontSize: 12, color: colors.textPrimary }}>
            {toast}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function escapeCsv(s: string): string {
  const text = (s ?? '').replace(/"/g, '""')
  return /[",\n]/.test(text) ? `"${text}"` : text
}

function ToggleRow({
  value,
  onValueChange,
  label,
}: {
  value: boolean
  onValueChange: (v: boolean) => void
  label: string
}) {
  const colors = useColors()
  return (
    <View
      className="flex-row items-center justify-between rounded-xl px-4 py-3 border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
    >
      <Text style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textPrimary, flex: 1, marginRight: 12 }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.toggleOn, false: colors.borderDefault }}
        thumbColor={colors.bgSurface}
      />
    </View>
  )
}
