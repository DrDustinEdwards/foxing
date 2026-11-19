import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
const log = [];
p.on("console", (m) => log.push("C:" + m.type() + " " + m.text().slice(0, 300)));
p.on("pageerror", (e) => log.push("E:" + e.message.slice(0, 300)));
p.on("requestfailed", (r) => log.push("RF:" + r.url().slice(0, 150) + " " + r.failure()?.errorText));
p.on("response", (r) => { if (r.status() >= 400 || /reader|manifest|\.x?html/.test(r.url())) log.push("R:" + r.status() + " " + r.url().slice(0, 150)); });
await p.goto("https://foxing.app/read/sailing-alone-around-the-world-slocum");
const t0 = Date.now();
for (let i = 0; i < 60; i++) { let m = 0; for (const f of p.frames()) if (f.url().startsWith("blob:")) m = Math.max(m, await f.evaluate(() => document.body?.innerText?.trim().length ?? 0).catch(() => 0)); if (m > 120) { console.log("text after ms", Date.now() - t0); break; } await p.waitForTimeout(500); }
for (const f of p.frames()) console.log(f.url().slice(0, 100), await f.evaluate(() => document.body?.innerText?.trim().length).catch((e) => "err"));
console.log(log.join("\n"));
await b.close();
