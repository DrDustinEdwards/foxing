import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

import { ensureFoliateRuntime } from '@/lib/foliate-assets'
import { ensureEpubLocallyCached } from '@/lib/epub-cache'
import type { HighlightColor } from '@/components/reader/floating-pill'
import type { WordWiseHint } from '@/lib/claude'

// Callback shape mirrors the old ReaderWebView so the reader screen wiring
// stays simple. Position info on word/passage callbacks lets the host
// render a FloatingPill anchored to the actual on-screen word.

export interface ReaderTheme {
  background: string
  text: string
}

export interface ReaderSettings {
  fontSize: number
  lineHeight: number
  theme: ReaderTheme
  // Optional extended controls, host can omit; bridge applies defaults.
  fontFamily?: string
  bold?: boolean
  paragraphSpacing?: number
  marginPx?: number
  justify?: boolean
  // Phase D additions
  letterSpacingEm?: number
  firstLineIndent?: boolean
  dropCap?: boolean
  warmScreen?: boolean
  focusMode?: boolean
}

export interface ReaderRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PassageCommentMarker {
  cfi: string
  passageText: string
}

export interface ReaderRef {
  prev: () => void
  next: () => void
  // Optional hint lets callers carry an excerpt + chapter name forward
  // when the CFI is in a renderer-foreign format (e.g. legacy foliate
  // epubcfi strings being navigated by the Readium renderer). The Foliate
  // renderer ignores the hint and uses the CFI directly.
  goTo: (
    cfi: string,
    hint?: { text?: string; chapter?: string },
  ) => void
  applySettings: (settings: ReaderSettings) => void
  addHighlight: (cfi: string, color: HighlightColor) => void
  removeHighlight: (cfi: string) => void
  setWordWiseEnabled: (enabled: boolean) => void
  applyWordWiseHints: (hints: WordWiseHint[]) => void
  // Push the active design-token palette into the WebView so the highlight
  // rects rendered by foliate-view match the swatches shown in the pill.
  setHighlightColors: (map: Record<HighlightColor, string>) => void
  // Push the set of club passage comments into the reader so it can paint
  // margin dots next to commented paragraphs. Empty list clears all dots.
  setPassageComments: (comments: PassageCommentMarker[], colorHex?: string) => void
  // Push popular highlight markers. The legacy Foliate path used cfi to
  // anchor an inline label; the Readium path uses the saved excerpt
  // (text) to build a text-based Locator decoration. The shape is
  // widened to accept both fields so a single call site works with
  // either renderer.
  setPopularHighlights: (
    list: Array<{ text?: string; cfi: string; count: number }>,
    colorHex?: string,
  ) => void
  // Phase D additions
  startAutoScroll: (wpm: number) => void
  stopAutoScroll: () => void
  // Layout: 1 (default) or 2 (dual-page spread). The renderer reapplies
  // pagination using the same CFI so the user's position is preserved.
  setColumns: (count: number) => void
  // Async bridge, returns chapter plain text for TTS.
  getChapterText: () => Promise<string>
  // Async bridge, returns one entry per paragraph in the visible chapter.
  // Used to drive bilingual-mode translation fetching.
  getChapterParagraphs: () => Promise<string[]>
  // Async bridge, returns chapter TOC items.
  getToc: () => Promise<Array<{ label: string; href: string; cfi: string | null }>>
  // Visually mark a sentence (1-based index within the current chapter)
  // for the TTS readback. Pass null to clear.
  highlightSentence: (index: number | null) => void
  // Append italic translations under each paragraph in the visible chapter.
  // Empty array clears any existing translations.
  setBilingualContent: (translations: string[]) => void
}

interface FoliateReaderWebViewProps {
  epubUrl: string
  initialCfi?: string
  initialSettings: ReaderSettings
  onReady?: () => void
  onError?: (message: string) => void
  onLocationChange?: (cfi: string, fraction: number, pageWordCount?: number, pageText?: string) => void
  onChapterChange?: (chapter: { title: string; index: number }) => void
  onWordTapped?: (word: string, surroundingText: string, cfi: string | null, rect: ReaderRect) => void
  onPassageSelected?: (text: string, cfi: string | null, rect: ReaderRect) => void
  onTap?: () => void
  onPassageCommentTapped?: (cfi: string | null, passageText: string) => void
}

type BridgeMessage =
  | { type: 'ready' }
  | { type: 'opened'; metadata: { title: string | null; author: string | null } }
  | { type: 'error'; message: string }
  | {
      type: 'locationChange'
      cfi: string | null
      fraction: number
      tocLabel: string | null
      pageWordCount?: number
      pageText?: string
    }
  | { type: 'tap' }
  | {
      type: 'wordTapped'
      word: string
      cfi: string | null
      surroundingText: string
      rect: ReaderRect
    }
  | { type: 'passageSelected'; text: string; cfi: string | null; rect: ReaderRect }
  | { type: 'passageCommentTapped'; cfi: string | null; passageText: string }
  | { type: 'requestResponse'; id: string; ok: boolean; data?: unknown; error?: string }

// Async request/response harness. Wraps a JS expression that returns a value
// (or a Promise) in an IIFE that posts back to RN with a unique id; the host
// resolves the matching pending Promise in handleMessage.
function sendRequest<T>(
  web: WebView | null,
  pending: Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>,
  expression: string,
): Promise<T> {
  if (!web) return Promise.reject(new Error('webview not mounted'))
  const id = Math.random().toString(36).slice(2)
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    const js = `
      (async () => {
        try {
          const r = await (${expression});
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'requestResponse', id: ${JSON.stringify(id)}, ok: true, data: r }));
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'requestResponse', id: ${JSON.stringify(id)}, ok: false, error: e && e.message ? e.message : 'request failed' }));
        }
      })();
      true;
    `
    web.injectJavaScript(js)
    // 10-second safety timeout so a missing bridge fn doesn't hang the host forever.
    setTimeout(() => {
      const slot = pending.get(id)
      if (slot) {
        pending.delete(id)
        slot.reject(new Error('bridge request timed out'))
      }
    }, 10_000)
  })
}

function buildThemeJson(s: ReaderSettings): string {
  return JSON.stringify({
    background: s.theme.background,
    text: s.theme.text,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    fontFamily: s.fontFamily,
    bold: s.bold,
    paragraphSpacing: s.paragraphSpacing,
    marginPx: s.marginPx,
    justify: s.justify,
    letterSpacingEm: s.letterSpacingEm,
    firstLineIndent: s.firstLineIndent,
    dropCap: s.dropCap,
    warmScreen: s.warmScreen,
    focusMode: s.focusMode,
  })
}

export const FoliateReaderWebView = forwardRef<ReaderRef, FoliateReaderWebViewProps>(
  function FoliateReaderWebView(
    {
      epubUrl,
      initialCfi,
      initialSettings,
      onReady,
      onError,
      onLocationChange,
      onChapterChange,
      onWordTapped,
      onPassageSelected,
      onTap,
      onPassageCommentTapped,
    },
    ref,
  ) {
    const webRef = useRef<WebView>(null)
    const [readerHtmlUri, setReaderHtmlUri] = useState<string | null>(null)
    const [base64, setBase64] = useState<string | null>(null)
    const [bootError, setBootError] = useState<string | null>(null)

    const bridgeReadyRef = useRef(false)
    const openedRef = useRef(false)
    // Async request/response harness, getChapterText / getToc use this.
    const pendingRequestsRef = useRef(new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>())

    useEffect(() => {
      let cancelled = false
      ;(async () => {
        try {
          console.log('[foliate] boot start, fetching runtime + epub', { epubUrl })
          const [uri, epub] = await Promise.all([
            ensureFoliateRuntime(),
            ensureEpubLocallyCached(epubUrl),
          ])
          // Echo both resolved paths so a "Script error." in the WebView can
          // be cross-referenced against the on-disk runtime + EPUB.
          console.log('[foliate] boot ready', {
            readerHtmlUri: uri,
            epubBytes: epub.bytes,
            epubBase64Len: epub.base64.length,
            cached: epub.cached,
          })
          if (cancelled) return
          setReaderHtmlUri(uri)
          setBase64(epub.base64)
        } catch (e) {
          const message = e instanceof Error ? e.message : 'reader boot failed'
          console.warn('[foliate] boot error', message)
          if (!cancelled) {
            setBootError(message)
            onError?.(message)
          }
        }
      })()
      return () => {
        cancelled = true
      }
    }, [epubUrl])

    const openBookIfReady = useCallback(() => {
      if (openedRef.current) return
      if (!bridgeReadyRef.current) return
      if (!base64) return
      openedRef.current = true
      const themeJson = buildThemeJson(initialSettings)
      const cfi = initialCfi && initialCfi.startsWith('epubcfi(') ? initialCfi : null
      const js = `
        (async () => {
          try {
            window.foliateBridge.applyTheme(${themeJson});
            await window.foliateBridge.openBookFromBase64(${JSON.stringify(base64)});
            ${cfi ? `await window.foliateBridge.goToCfi(${JSON.stringify(cfi)});` : ''}
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error', message: 'inject openBook failed: ' + (e?.message || 'unknown')
            }));
          }
        })();
        true;
      `
      webRef.current?.injectJavaScript(js)
    }, [base64, initialCfi, initialSettings])

    useEffect(() => {
      if (bridgeReadyRef.current && base64) openBookIfReady()
    }, [base64, openBookIfReady])

    useImperativeHandle(
      ref,
      () => ({
        prev: () => {
          webRef.current?.injectJavaScript(`window.foliateBridge.goPrev(); true;`)
        },
        next: () => {
          webRef.current?.injectJavaScript(`window.foliateBridge.goNext(); true;`)
        },
        goTo: (cfi: string) => {
          // Foliate ignores the hint param; goTo signature is widened for
          // contract compatibility with the Readium wrapper.
          webRef.current?.injectJavaScript(
            `window.foliateBridge.goToCfi(${JSON.stringify(cfi)}); true;`,
          )
        },
        applySettings: (s: ReaderSettings) => {
          const themeJson = buildThemeJson(s)
          webRef.current?.injectJavaScript(
            `window.foliateBridge.applyTheme(${themeJson}); true;`,
          )
        },
        addHighlight: (cfi: string, color: HighlightColor) => {
          webRef.current?.injectJavaScript(
            `window.foliateBridge.addHighlight(${JSON.stringify(cfi)}, ${JSON.stringify(color)}); true;`,
          )
        },
        removeHighlight: (cfi: string) => {
          webRef.current?.injectJavaScript(
            `window.foliateBridge.removeHighlight(${JSON.stringify(cfi)}); true;`,
          )
        },
        setWordWiseEnabled: (enabled: boolean) => {
          webRef.current?.injectJavaScript(
            `window.foliateBridge.setWordWiseEnabled(${enabled ? 'true' : 'false'}); true;`,
          )
        },
        applyWordWiseHints: (hints: WordWiseHint[]) => {
          webRef.current?.injectJavaScript(
            `window.foliateBridge.applyWordWiseHints(${JSON.stringify(hints)}); true;`,
          )
        },
        setHighlightColors: (map: Record<HighlightColor, string>) => {
          // Guard against stale reader.html on disk that predates this bridge
          // method: a missing `setHighlightColors` would throw inside the
          // WebView and surface as a generic "Script error.", masking the
          // real cause. The guard is a no-op until the bundle version bump
          // re-extracts the new reader.html on the device.
          webRef.current?.injectJavaScript(
            `if (typeof window.foliateBridge?.setHighlightColors === 'function') {
              window.foliateBridge.setHighlightColors(${JSON.stringify(map)});
            } else {
              console.warn('[reader] setHighlightColors not on bridge, stale reader.html');
            }
            true;`,
          )
        },
        setPassageComments: (comments: PassageCommentMarker[], colorHex?: string) => {
          // Same guard pattern as setHighlightColors, devices on the prior
          // bundle version won't have the new bridge fn yet.
          webRef.current?.injectJavaScript(
            `if (typeof window.foliateBridge?.setPassageComments === 'function') {
              window.foliateBridge.setPassageComments(${JSON.stringify(comments)}, ${JSON.stringify(colorHex ?? null)});
            } else {
              console.warn('[reader] setPassageComments not on bridge, stale reader.html');
            }
            true;`,
          )
        },
        setPopularHighlights: (
          list: Array<{ cfi: string; count: number }>,
          colorHex?: string,
        ) => {
          webRef.current?.injectJavaScript(
            `if (typeof window.foliateBridge?.setPopularHighlights === 'function') {
              window.foliateBridge.setPopularHighlights(${JSON.stringify(list)}, ${JSON.stringify(colorHex ?? null)});
            } else {
              console.warn('[reader] setPopularHighlights not on bridge, stale reader.html');
            }
            true;`,
          )
        },
        startAutoScroll: (wpm: number) => {
          webRef.current?.injectJavaScript(
            `if (typeof window.foliateBridge?.startAutoScroll === 'function') {
              window.foliateBridge.startAutoScroll(${wpm});
            }
            true;`,
          )
        },
        stopAutoScroll: () => {
          webRef.current?.injectJavaScript(
            `if (typeof window.foliateBridge?.stopAutoScroll === 'function') {
              window.foliateBridge.stopAutoScroll();
            }
            true;`,
          )
        },
        setColumns: (count: number) => {
          const n = count === 2 ? 2 : 1
          webRef.current?.injectJavaScript(
            `if (typeof window.foliateBridge?.setColumns === 'function') {
              window.foliateBridge.setColumns(${n});
            }
            true;`,
          )
        },
        getChapterText: () =>
          sendRequest<string>(webRef.current, pendingRequestsRef.current, `window.foliateBridge.getChapterText()`),
        getChapterParagraphs: () =>
          sendRequest<string[]>(
            webRef.current,
            pendingRequestsRef.current,
            `window.foliateBridge.getChapterParagraphs()`,
          ),
        getToc: () =>
          sendRequest<Array<{ label: string; href: string; cfi: string | null }>>(
            webRef.current,
            pendingRequestsRef.current,
            `window.foliateBridge.getToc()`,
          ),
        highlightSentence: (index: number | null) => {
          webRef.current?.injectJavaScript(
            `if (typeof window.foliateBridge?.highlightSentence === 'function') {
              window.foliateBridge.highlightSentence(${index === null ? 'null' : String(index)});
            }
            true;`,
          )
        },
        setBilingualContent: (translations: string[]) => {
          webRef.current?.injectJavaScript(
            `if (typeof window.foliateBridge?.setBilingualContent === 'function') {
              window.foliateBridge.setBilingualContent(${JSON.stringify(translations)});
            } else {
              console.warn('[reader] setBilingualContent not on bridge, stale reader.html');
            }
            true;`,
          )
        },
      }),
      [],
    )

    function handleMessage(event: WebViewMessageEvent) {
      let msg: BridgeMessage
      try {
        msg = JSON.parse(event.nativeEvent.data) as BridgeMessage
      } catch {
        console.warn('[foliate] bad bridge message:', event.nativeEvent.data)
        return
      }

      switch (msg.type) {
        case 'ready':
          bridgeReadyRef.current = true
          openBookIfReady()
          break
        case 'opened':
          console.log('[foliate] opened', msg.metadata)
          onReady?.()
          break
        case 'error':
          console.warn('[foliate] bridge error:', msg.message)
          onError?.(msg.message)
          break
        case 'locationChange':
          if (msg.cfi) onLocationChange?.(msg.cfi, msg.fraction, msg.pageWordCount, msg.pageText)
          if (msg.tocLabel != null) {
            onChapterChange?.({ title: msg.tocLabel, index: 0 })
          }
          break
        case 'tap':
          onTap?.()
          break
        case 'wordTapped':
          onWordTapped?.(msg.word, msg.surroundingText, msg.cfi, msg.rect)
          break
        case 'passageSelected':
          onPassageSelected?.(msg.text, msg.cfi, msg.rect)
          break
        case 'passageCommentTapped':
          onPassageCommentTapped?.(msg.cfi, msg.passageText)
          break
        case 'requestResponse': {
          const slot = pendingRequestsRef.current.get(msg.id)
          if (!slot) break
          pendingRequestsRef.current.delete(msg.id)
          if (msg.ok) slot.resolve(msg.data)
          else slot.reject(new Error(msg.error ?? 'bridge error'))
          break
        }
      }
    }

    if (bootError) {
      return (
        <View
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: initialSettings.theme.background }}
        >
          <Text
            className="font-ui text-error-light dark:text-error-dark text-center"
            style={{ color: initialSettings.theme.text }}
          >
            {bootError}
          </Text>
        </View>
      )
    }

    if (!readerHtmlUri || !base64) {
      return (
        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: initialSettings.theme.background }}
        >
          <ActivityIndicator color={initialSettings.theme.text} />
        </View>
      )
    }

    return (
      <WebView
        ref={webRef}
        source={{ uri: readerHtmlUri }}
        onMessage={handleMessage}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        bounces={false}
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: initialSettings.theme.background }}
        onError={(e) => {
          const msg = e.nativeEvent?.description || 'webview load error'
          console.warn('[foliate] webview onError', msg)
          setBootError(msg)
          onError?.(msg)
        }}
      />
    )
  },
)
