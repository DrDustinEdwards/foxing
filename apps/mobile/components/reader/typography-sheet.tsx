import { useEffect, useState } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import {
  type ReaderPrefs,
  type SavedTheme,
  loadSavedThemes,
  saveCustomTheme,
} from '@/lib/reader-settings'
import { LanguageTab } from './typography-language-tab'
import { CanvasTab, FontTab, LayoutTab, ThemesTab } from './typography-tabs'

type TabKey = 'font' | 'layout' | 'canvas' | 'themes' | 'language'

interface TypographySheetProps {
  visible: boolean
  prefs: ReaderPrefs
  userId: string | null
  // Book context, used by the Language tab for difficulty + Anki export.
  // Optional so non-reader callers can omit (the Language tab gates on it).
  bookId?: string
  // Tablet layout, when true the sheet docks to the right edge as a 360-wide
  // side panel instead of sliding up from the bottom. Same content, different
  // wrapper. Caller decides based on useWindowDimensions().
  sidePanel?: boolean
  onChangePrefs: (next: ReaderPrefs) => void
  onClose: () => void
}

export function TypographySheet({
  visible,
  prefs,
  userId,
  bookId,
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
                bookId={bookId}
              />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Font tab ────────────────────────────────────────────────────────────

// ── Layout tab ──────────────────────────────────────────────────────────

// ── Canvas tab ──────────────────────────────────────────────────────────

// ── Themes tab ──────────────────────────────────────────────────────────

// ── Shared primitives ──────────────────────────────────────────────────

// ── Language Learning tab ───────────────────────────────────────────────

