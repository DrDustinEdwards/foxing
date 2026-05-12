import { forwardRef, useImperativeHandle, useRef } from 'react'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

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
  onLocationChange?: (cfi: string, percentage: number) => void
  onChapterChange?: (chapter: { title: string; index: number }) => void
  onWordTap?: (word: string, sentence: string) => void
  onPassageSelect?: (passage: string) => void
}

function buildHtml(epubUrl: string, initialCfi: string | undefined, settings: ReaderSettings) {
  const start = initialCfi ? JSON.stringify(initialCfi) : 'undefined'
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js"></script>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: ${settings.theme.background}; }
  #viewer { width: 100vw; height: 100vh; }
  ::selection { background: rgba(196, 151, 58, 0.3); }
</style>
</head>
<body>
<div id="viewer"></div>
<script>
  const send = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  let book, rendition;
  let currentSettings = ${JSON.stringify(settings)};

  function applyTheme() {
    if (!rendition) return;
    rendition.themes.default({
      "body": {
        "background": currentSettings.theme.background + " !important",
        "color": currentSettings.theme.text + " !important",
        "font-size": currentSettings.fontSize + "px !important",
        "line-height": currentSettings.lineHeight + " !important",
        "padding": "16px !important",
      },
      "p, div, span": {
        "color": currentSettings.theme.text + " !important",
      }
    });
    document.body.style.background = currentSettings.theme.background;
  }

  try {
    book = ePub(${JSON.stringify(epubUrl)});
    rendition = book.renderTo("viewer", {
      width: "100%",
      height: "100%",
      flow: "paginated",
      allowScriptedContent: true,
    });

    applyTheme();

    rendition.display(${start}).catch((err) => send({ type: "error", message: String(err) }));

    rendition.on("relocated", (location) => {
      const cfi = location.start.cfi;
      const pct = book.locations.length() ? book.locations.percentageFromCfi(cfi) : 0;
      send({ type: "location", cfi, percentage: pct });
    });

    book.ready.then(() => book.locations.generate(1024)).then(() => {
      send({ type: "ready" });
    }).catch((err) => send({ type: "error", message: String(err) }));

    rendition.on("rendered", (section) => {
      const nav = book.navigation && book.navigation.get(section.href);
      if (nav) send({ type: "chapter", title: nav.label || "", index: nav.id || "" });
      const iframe = section.document;
      if (!iframe) return;
      let pressTimer = null;
      let didLongPress = false;
      iframe.addEventListener("touchstart", () => {
        didLongPress = false;
        pressTimer = setTimeout(() => {
          didLongPress = true;
          const sel = iframe.getSelection && iframe.getSelection();
          const text = sel ? sel.toString().trim() : "";
          if (text.length > 0) send({ type: "passage", text });
        }, 500);
      });
      iframe.addEventListener("touchend", (ev) => {
        if (pressTimer) clearTimeout(pressTimer);
        if (didLongPress) return;
        const target = ev.target;
        if (!target || target.nodeType !== 1) return;
        const range = iframe.caretRangeFromPoint
          ? iframe.caretRangeFromPoint(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY)
          : null;
        if (!range) return;
        const node = range.startContainer;
        if (!node || node.nodeType !== 3) return;
        const text = node.textContent || "";
        let s = range.startOffset, e = range.startOffset;
        while (s > 0 && /\\w/.test(text[s - 1])) s--;
        while (e < text.length && /\\w/.test(text[e])) e++;
        const word = text.slice(s, e);
        if (!word || word.length < 2) return;
        let sStart = s, sEnd = e;
        while (sStart > 0 && !/[.!?]/.test(text[sStart - 1])) sStart--;
        while (sEnd < text.length && !/[.!?]/.test(text[sEnd])) sEnd++;
        const sentence = text.slice(sStart, sEnd + 1).trim();
        send({ type: "word", word, sentence });
      });
    });
  } catch (e) {
    send({ type: "error", message: String(e) });
  }

  window.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.cmd === "next" && rendition) rendition.next();
      if (msg.cmd === "prev" && rendition) rendition.prev();
      if (msg.cmd === "goto" && rendition) rendition.display(msg.cfi);
      if (msg.cmd === "settings") {
        currentSettings = msg.settings;
        applyTheme();
      }
    } catch {}
  });
  document.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.cmd === "next" && rendition) rendition.next();
      if (msg.cmd === "prev" && rendition) rendition.prev();
      if (msg.cmd === "goto" && rendition) rendition.display(msg.cfi);
      if (msg.cmd === "settings") {
        currentSettings = msg.settings;
        applyTheme();
      }
    } catch {}
  });
</script>
</body>
</html>`
}

export const ReaderWebView = forwardRef<ReaderRef, ReaderWebViewProps>(function ReaderWebView(
  { epubUrl, initialCfi, initialSettings, onLocationChange, onChapterChange, onWordTap, onPassageSelect },
  ref
) {
  const webRef = useRef<WebView>(null)

  useImperativeHandle(ref, () => ({
    prev: () => webRef.current?.postMessage(JSON.stringify({ cmd: 'prev' })),
    next: () => webRef.current?.postMessage(JSON.stringify({ cmd: 'next' })),
    goTo: (cfi: string) => webRef.current?.postMessage(JSON.stringify({ cmd: 'goto', cfi })),
    applySettings: (settings) =>
      webRef.current?.postMessage(JSON.stringify({ cmd: 'settings', settings })),
  }))

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'location' && onLocationChange) {
        onLocationChange(msg.cfi, msg.percentage ?? 0)
      } else if (msg.type === 'chapter' && onChapterChange) {
        onChapterChange({ title: msg.title, index: msg.index })
      } else if (msg.type === 'word' && onWordTap) {
        onWordTap(msg.word, msg.sentence)
      } else if (msg.type === 'passage' && onPassageSelect) {
        onPassageSelect(msg.text)
      }
    } catch {}
  }

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html: buildHtml(epubUrl, initialCfi, initialSettings) }}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      allowFileAccess
      mixedContentMode="always"
      style={{ flex: 1, backgroundColor: initialSettings.theme.background }}
    />
  )
})
