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
  // Optional extended controls — host can omit; bridge applies defaults.
  fontFamily?: string
  bold?: boolean
  paragraphSpacing?: number
  marginPx?: number
  justify?: boolean
}

export interface ReaderRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ReaderRef {
  prev: () => void
  next: () => void
  goTo: (cfi: string) => void
  applySettings: (settings: ReaderSettings) => void
  addHighlight: (cfi: string, color: HighlightColor) => void
  removeHighlight: (cfi: string) => void
  setWordWiseEnabled: (enabled: boolean) => void
  applyWordWiseHints: (hints: WordWiseHint[]) => void
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
    },
    ref,
  ) {
    const webRef = useRef<WebView>(null)
    const [readerHtmlUri, setReaderHtmlUri] = useState<string | null>(null)
    const [base64, setBase64] = useState<string | null>(null)
    const [bootError, setBootError] = useState<string | null>(null)

    const bridgeReadyRef = useRef(false)
    const openedRef = useRef(false)

    useEffect(() => {
      let cancelled = false
      ;(async () => {
        try {
          const [uri, epub] = await Promise.all([
            ensureFoliateRuntime(),
            ensureEpubLocallyCached(epubUrl),
          ])
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
