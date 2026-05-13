import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { Reader, useReader, type Theme } from '@epubjs-react-native/core'
import { useFileSystem } from '@epubjs-react-native/expo-file-system'

export interface ReaderTheme {
  background: string
  text: string
}

export interface ReaderSettings {
  fontSize: number
  lineHeight: number
  theme: ReaderTheme
}

export interface ReaderRef {
  prev: () => void
  next: () => void
  goTo: (cfi: string) => void
  applySettings: (settings: ReaderSettings) => void
}

interface ReaderWebViewProps {
  epubUrl: string
  initialCfi?: string
  initialSettings: ReaderSettings
  onReady?: () => void
  onError?: (message: string) => void
  onLocationChange?: (cfi: string, percentage: number) => void
  onChapterChange?: (chapter: { title: string; index: number }) => void
  onWordTap?: (word: string, sentence: string) => void
  onPassageSelect?: (passage: string) => void
}

function buildTheme(settings: ReaderSettings): Theme {
  return {
    body: {
      background: `${settings.theme.background} !important`,
      color: `${settings.theme.text} !important`,
      'line-height': `${settings.lineHeight} !important`,
      padding: '16px !important',
    },
    'p, div, span': {
      color: `${settings.theme.text} !important`,
    },
  }
}

// Single-word selection (no whitespace, at least two letters) → word lookup.
// Anything longer → passage analysis.
const WORD_RE = /^[\p{L}\p{N}'-]{2,}$/u

export const ReaderWebView = forwardRef<ReaderRef, ReaderWebViewProps>(function ReaderWebView(
  {
    epubUrl,
    initialCfi,
    initialSettings,
    onReady,
    onError,
    onLocationChange,
    onChapterChange,
    onWordTap,
    onPassageSelect,
  },
  ref
) {
  const { goNext, goPrevious, goToLocation, changeTheme, changeFontSize } = useReader()

  useImperativeHandle(
    ref,
    () => ({
      prev: () => goPrevious(),
      next: () => goNext(),
      goTo: (cfi: string) => goToLocation(cfi),
      applySettings: (settings: ReaderSettings) => {
        changeTheme(buildTheme(settings))
        changeFontSize(`${settings.fontSize}px`)
      },
    }),
    [goNext, goPrevious, goToLocation, changeTheme, changeFontSize]
  )

  const defaultTheme = useMemo(() => buildTheme(initialSettings), [initialSettings])

  // Apply font size once the rendition mounts. defaultTheme handles colors
  // and line-height; changeFontSize is the only way to set initial font size.
  useEffect(() => {
    changeFontSize(`${initialSettings.fontSize}px`)
  }, [changeFontSize, initialSettings.fontSize])

  return (
    <Reader
      src={epubUrl}
      fileSystem={useFileSystem}
      initialLocation={initialCfi}
      defaultTheme={defaultTheme}
      flow="paginated"
      enableSwipe
      enableSelection
      allowScriptedContent
      onReady={() => onReady?.()}
      onDisplayError={(reason) => onError?.(reason || 'Failed to display book')}
      onLocationChange={(_total, currentLocation, progress, currentSection) => {
        onLocationChange?.(currentLocation.start.cfi, progress)
        if (currentSection && onChapterChange) {
          onChapterChange({ title: currentSection.label || '', index: 0 })
        }
      }}
      onSelected={(selectedText, _cfiRange) => {
        const text = selectedText.trim()
        if (!text) return
        if (WORD_RE.test(text)) {
          // We don't have the surrounding sentence from the library's
          // selection event, so pass the word itself as best-effort context.
          onWordTap?.(text, text)
        } else {
          onPassageSelect?.(text)
        }
      }}
    />
  )
})
