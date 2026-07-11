// Lab Core Web Vitals capture against the deployed preview. Warms the edge cache,
// then measures a cache-hit navigation (the state real visitors get). Single run,
// lab conditions: indicative, not a substitute for field data (CrUX). INP has no
// real user interaction to sample here, so it is approximated from one simulated
// click on a real on-page control (event duration via the Event Timing API) --
// report it as an approximation, not a true INP.
import { chromium } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://foxing.dustin-edwards.workers.dev";
const PATHS = [
  { label: "home", path: "/" },
  { label: "browse", path: "/books" },
  { label: "book page", path: "/books/sailing-alone-around-the-world-slocum" },
  { label: "search", path: "/search?q=dostoyevsky" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function measure(url) {
  await page.goto(url, { waitUntil: "load" });
  const vitals = await page.evaluate(
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

  // INP approximation: click the first real, visible link and measure its event
  // duration via PerformanceObserver({type:"event"}). One sample, one interaction --
  // not a percentile over a real session, just a directional signal.
  const inp = await page
    .evaluate(
      () =>
        new Promise((resolve) => {
          const link = document.querySelector("a[href]");
          if (!link) return resolve(null);
          let duration = 0;
          const obs = new PerformanceObserver((l) => {
            for (const e of l.getEntries()) duration = Math.max(duration, e.duration);
          });
          obs.observe({ type: "event", buffered: true, durationThreshold: 0 });
          link.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
          link.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
          setTimeout(() => resolve(Math.round(duration)), 300);
        }),
    )
    .catch(() => null);

  return { ...vitals, inp };
}

console.log("page".padEnd(12), "path".padEnd(42), "TTFB", "FCP", "LCP", "CLS", "INP*", "Load");
for (const { label, path } of PATHS) {
  await measure(BASE + path); // warm cache
  const m = await measure(BASE + path); // measured (cache hit)
  console.log(
    label.padEnd(12),
    path.padEnd(42),
    `${m.ttfb}ms`.padEnd(6),
    `${m.fcp}`.padEnd(5),
    `${m.lcp}`.padEnd(5),
    `${m.cls}`.padEnd(5),
    `${m.inp ?? "n/a"}`.padEnd(5),
    `${m.load}ms`,
  );
}
console.log("\n* INP is an approximation from one simulated click, not a real-session percentile.");

await browser.close();
