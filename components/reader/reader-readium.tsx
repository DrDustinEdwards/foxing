import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  ReadiumView,
  type ReadiumViewRef,
  type Locator,
  type Preferences,
} from 'react-native-readium'

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
  goTo: (locator: Locator) => void
  applySettings: (settings: ReaderSettings) => void
}

interface ReaderReadiumProps {
  epubUrl: string
  initialLocator?: Locator
  initialSettings: ReaderSettings
  onReady?: () => void
  onError?: (message: string) => void
  onLocationChange?: (locator: Locator, progression: number) => void
  onChapterChange?: (chapter: { title: string; href: string }) => void
  onWordTap?: (word: string, sentence: string) => void
  onPassageSelect?: (passage: string) => void
}

// Single-word selection (no whitespace, at least two letters) → word lookup;
// anything longer → passage analysis. Same heuristic the previous reader used.
const WORD_RE = /^[\p{L}\p{N}'-]{2,}$/u

// Selection menu actions surfaced through native iOS/Android selection menu.
// Readium's onSelectionAction callback fires when user taps one of these.
const SELECTION_ACTIONS = [
  { id: 'lookup', label: 'Look up' },
  { id: 'analyze', label: 'Analyze' },
]

function buildPreferences(settings: ReaderSettings): Preferences {
  return {
    backgroundColor: settings.theme.background,
    textColor: settings.theme.text,
    // Readium's fontSize is a multiplier (1.0 = 100%). The previous reader
    // expressed font size as px (16, 18, 20, etc.). Convert by dividing by
    // the default 16px so the existing FONT_SIZES picker stays meaningful.
    fontSize: settings.fontSize / 16,
    lineHeight: settings.lineHeight,
    // We're feeding our own colors via backgroundColor/textColor; turning
    // off publisher styles makes sure the EPUB's own CSS doesn't override.
    publisherStyles: false,
    scroll: false,
  }
}

export const ReaderReadium = forwardRef<ReaderRef, ReaderReadiumProps>(function ReaderReadium(
  {
    epubUrl,
    initialLocator,
    initialSettings,
    onReady,
    onError,
    onLocationChange,
    onChapterChange,
    onWordTap,
    onPassageSelect,
  },
  ref,
) {
  const innerRef = useRef<ReadiumViewRef>(null)
  const [preferences, setPreferences] = useState<Preferences>(() =>
    buildPreferences(initialSettings),
  )

  useImperativeHandle(
    ref,
    () => ({
      prev: () => innerRef.current?.goBackward(),
      next: () => innerRef.current?.goForward(),
      goTo: (loc: Locator) => innerRef.current?.goTo(loc),
      applySettings: (settings: ReaderSettings) =>
        setPreferences(buildPreferences(settings)),
    }),
    [],
  )

  // Memoize the file object so changing preferences (which forces a Readium
  // re-prop) doesn't reset the position to initialLocation on every render.
  const file = useMemo(
    () => ({ url: epubUrl, initialLocation: initialLocator }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [epubUrl],
  )

  return (
    <ReadiumView
      ref={innerRef}
      file={file}
      preferences={preferences}
      selectionActions={SELECTION_ACTIONS}
      style={{ flex: 1 }}
      onPublicationReady={(event) => {
        console.log('[reader-readium] publication ready', {
          tocItems: event.tableOfContents?.length ?? 0,
          positions: event.positions?.length ?? 0,
        })
        onReady?.()
      }}
      onLocationChange={(locator) => {
        const progression =
          locator.locations?.totalProgression ??
          locator.locations?.progression ??
          0
        console.log('[reader-readium] location', {
          href: locator.href,
          progression,
          title: locator.title,
        })
        onLocationChange?.(locator, progression)
        if (locator.title) {
          onChapterChange?.({ title: locator.title, href: locator.href })
        }
      }}
      onSelectionAction={(event) => {
        const text = event.selectedText.trim()
        // Readium gives us before/highlight/after — recover the surrounding
        // sentence so Claude has real context (the previous reader couldn't).
        const before = event.locator.text?.before ?? ''
        const highlight = event.locator.text?.highlight ?? text
        const after = event.locator.text?.after ?? ''
        const surrounding = `${before}${highlight}${after}`.trim() || text

        console.log('[reader-readium] selection action', {
          actionId: event.actionId,
          chars: text.length,
          contextChars: surrounding.length,
        })

        if (!text) return
        if (event.actionId === 'lookup') {
          if (WORD_RE.test(text)) {
            onWordTap?.(text, surrounding)
          } else {
            onPassageSelect?.(text)
          }
        } else if (event.actionId === 'analyze') {
          onPassageSelect?.(text)
        }
      }}
      onSelectionChange={(event) => {
        // Diagnostic only — fires while the user is dragging the selection
        // handles. Useful for confirming native selection is reaching the
        // JS side before they tap a menu item.
        if (event.selectedText) {
          console.log('[reader-readium] selection change', {
            chars: event.selectedText.length,
          })
        }
      }}
    />
  )
})
