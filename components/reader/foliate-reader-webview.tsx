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

// Callback shape mirrors the old @epubjs-react-native/core ReaderWebView so
// the reader screen wiring stays unchanged. Signature additions: onTap (used
// to drive the chrome toggle without an absolute-fill Pressable overlay).

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

interface FoliateReaderWebViewProps {
  epubUrl: string
  initialCfi?: string
  initialSettings: ReaderSettings
  onReady?: () => void
  onError?: (message: string) => void
  onLocationChange?: (cfi: string, fraction: number) => void
  onChapterChange?: (chapter: { title: string; index: number }) => void
  onWordTap?: (word: string, sentence: string) => void
  onPassageSelect?: (passage: string) => void
  onTap?: () => void
}

const WORD_RE = /^[\p{L}\p{N}'-]{2,}$/u

type BridgeMessage =
  | { type: 'ready' }
  | { type: 'opened'; metadata: { title: string | null; author: string | null } }
  | { type: 'error'; message: string }
  | { type: 'locationChange'; cfi: string | null; fraction: number; tocLabel: string | null }
  | { type: 'tap' }
  | { type: 'wordSelected'; word: string; cfi: string | null }
  | { type: 'passageSelected'; text: string; cfi: string | null }

function buildThemeJson(s: ReaderSettings): string {
  return JSON.stringify({
    background: s.theme.background,
    text: s.theme.text,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
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
      onWordTap,
      onPassageSelect,
      onTap,
    },
    ref,
  ) {
    const webRef = useRef<WebView>(null)
    const [readerHtmlUri, setReaderHtmlUri] = useState<string | null>(null)
    const [base64, setBase64] = useState<string | null>(null)
    const [bootError, setBootError] = useState<string | null>(null)

    // Track whether the bridge has signaled 'ready' — until it does,
    // calls to injectJavaScript are no-ops on the JS side. We queue
    // openBook for after ready.
    const bridgeReadyRef = useRef(false)
    const openedRef = useRef(false)

    // Stage 1: extract the foliate runtime and download the EPUB. Both
    // happen in parallel.
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

    // Inject runs once when the bridge signals 'ready'. Re-running on
    // subsequent re-renders would re-open the book and lose position.
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

    // Try to open whenever either side becomes ready.
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
          if (msg.cfi) onLocationChange?.(msg.cfi, msg.fraction)
          if (msg.tocLabel != null) {
            onChapterChange?.({ title: msg.tocLabel, index: 0 })
          }
          break
        case 'tap':
          onTap?.()
          break
        case 'wordSelected':
          if (WORD_RE.test(msg.word)) {
            onWordTap?.(msg.word, msg.word)
          } else {
            onPassageSelect?.(msg.word)
          }
          break
        case 'passageSelected':
          onPassageSelect?.(msg.text)
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
        // Android: foliate's modules import each other relative to reader.html;
        // need both file-access flags so the WebView lets ./view.js etc. resolve.
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        // Foliate uses ES modules + dynamic import + Blob URLs.
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        // Prevent vertical scroll bouncing on iOS over the reader area.
        bounces={false}
        // Don't let the WebView intercept presentation of nav-style links.
        setSupportMultipleWindows={false}
        style={{ flex: 1, backgroundColor: initialSettings.theme.background }}
        // Surface webview load errors as bootError.
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
