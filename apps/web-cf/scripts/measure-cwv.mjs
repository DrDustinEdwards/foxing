// Lab Core Web Vitals capture against the deployed preview. Warms the edge cache,
// then measures a cache-hit navigation (the state real visitors get). Single run,
// lab conditions: indicative, not a substitute for field data.
import { chromium } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://foxing.dustin-edwards.workers.dev";
const PATHS = ["/", "/books", "/books/sailing-alone-around-the-world-slocum", "/journal"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function measure(url) {
  await page.goto(url, { waitUntil: "load" });
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) lcp = e.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
          resolve({
            ttfb: Math.round(nav.responseStart),
            fcp: Math.round(fcp),
            lcp: Math.round(lcp),
            cls: Number(cls.toFixed(3)),
            load: Math.round(nav.loadEventEnd),
          });
        }, 2500);
      }),
  );
}

console.log("path".padEnd(48), "TTFB", "FCP", "LCP", "CLS", "Load");
for (const p of PATHS) {
  await measure(BASE + p); // warm cache
  const m = await measure(BASE + p); // measured (cache hit)
  console.log(
    p.padEnd(48),
    `${m.ttfb}ms`.padEnd(6),
    `${m.fcp}`.padEnd(5),
    `${m.lcp}`.padEnd(5),
    `${m.cls}`.padEnd(5),
    `${m.load}ms`,
  );
}

await browser.close();
