import { forwardRef, useImperativeHandle, useMemo } from 'react'
import { Reader, useReader, type Theme } from '@epubjs-react-native/core'
import { useFileSystem } from '@/lib/reader-file-system'

// On iOS the native text-selection menu intercepts the touch gesture before
// epub.js's `selected` event reaches React Native, so the bare onSelected
// callback fires unreliably. The library's `menuItems` API adds entries to
// that native menu, those entries are user-driven taps, so they always
// deliver the cfi + selected text back through the message bridge.

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
      'font-size': `${settings.fontSize}px !important`,
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

// epub.js CFI strings always start with the "epubcfi(" prefix. Passing a
// malformed value to initialLocation can leave the rendition stuck on the
// cover, so fall back to undefined unless the string parses as a CFI.
function sanitizeCfi(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.startsWith('epubcfi(') ? value : undefined
}

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
      prev: () => {
        console.log('[reader] ref.prev() → goPrevious')
        goPrevious()
      },
      next: () => {
        console.log('[reader] ref.next() → goNext')
        goNext()
      },
      goTo: (cfi: string) => goToLocation(cfi),
      applySettings: (settings: ReaderSettings) => {
        changeTheme(buildTheme(settings))
        changeFontSize(`${settings.fontSize}px`)
      },
    }),
    [goNext, goPrevious, goToLocation, changeTheme, changeFontSize]
  )

  // Build defaultTheme once per mount from initial settings. The Reader
  // applies defaultTheme on first display only; runtime updates go through
  // changeTheme / changeFontSize via applySettings(). Re-emitting a new
  // defaultTheme on every parent render would re-flow the rendition and
  // can leave page-turn gestures stuck mid-transition.
  const defaultTheme = useMemo(
    () => buildTheme(initialSettings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const safeInitialLocation = sanitizeCfi(initialCfi)
  if (initialCfi && !safeInitialLocation) {
    console.log('[reader] dropping malformed initialCfi:', initialCfi)
  }

  return (
    <Reader
      src={epubUrl}
      fileSystem={useFileSystem}
      initialLocation={safeInitialLocation}
      defaultTheme={defaultTheme}
      flow="paginated"
      enableSwipe={true}
      enableSelection
      allowScriptedContent
      menuItems={[
        {
          label: 'Look up',
          action: (_cfiRange, text) => {
            const trimmed = text.trim()
            console.log('[reader-webview] menu Look up', {
              chars: trimmed.length,
              preview: trimmed.slice(0, 40),
            })
            if (!trimmed) return true
            if (WORD_RE.test(trimmed)) {
              onWordTap?.(trimmed, trimmed)
            } else {
              onPassageSelect?.(trimmed)
            }
            return true
          },
        },
        {
          label: 'Analyze',
          action: (_cfiRange, text) => {
            const trimmed = text.trim()
            console.log('[reader-webview] menu Analyze', {
              chars: trimmed.length,
            })
            if (trimmed) onPassageSelect?.(trimmed)
            return true
          },
        },
      ]}
      onReady={(totalLocations, currentLocation, progress) => {
        console.log('[reader] onReady', { totalLocations, progress, cfi: currentLocation?.start?.cfi })
        onReady?.()
      }}
      onDisplayError={(reason) => {
        console.log('[reader] onDisplayError', reason)
        onError?.(reason || 'Failed to display book')
      }}
      onLocationChange={(total, currentLocation, progress, currentSection) => {
        console.log('[reader] onLocationChange', {
          cfi: currentLocation?.start?.cfi,
          progress,
          total,
          section: currentSection?.label,
        })
        onLocationChange?.(currentLocation.start.cfi, progress)
        if (currentSection && onChapterChange) {
          onChapterChange({ title: currentSection.label || '', index: 0 })
        }
      }}
      onSelected={(selectedText, _cfiRange) => {
        const text = selectedText.trim()
        console.log('[reader-webview] onSelected fired', {
          chars: text.length,
          preview: text.slice(0, 40),
        })
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
