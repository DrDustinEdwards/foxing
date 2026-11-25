// Downloads a remote EPUB once and reuses the local copy. A sidecar `.url` file records each file's source URL; a mismatch (hash collision, hash change, or a changed epub_url) is a cache miss: delete and redownload.

import * as FileSystem from "expo-file-system/legacy";

const CACHE_DIR = `${FileSystem.documentDirectory}epubs/`;

// FNV-1a x2 (two seeds) gives a 64-bit fingerprint without a native crypto dependency.
function cacheKey(remoteUrl: string): string {
  let a = 0x811c9dc5;
  let b = 0x84222325;
  for (let i = 0; i < remoteUrl.length; i++) {
    const c = remoteUrl.charCodeAt(i);
    a ^= c;
    a = Math.imul(a, 0x01000193);
    b ^= c;
    b = Math.imul(b, 0x05f5e101);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `${hex(a)}${hex(b)}`;
}

function epubPath(key: string): string {
  return `${CACHE_DIR}${key}.epub`;
}
function sidecarPath(key: string): string {
  return `${CACHE_DIR}${key}.url`;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

async function readSidecar(key: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(sidecarPath(key));
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(sidecarPath(key));
  } catch {
    return null;
  }
}

async function writeSidecar(key: string, remoteUrl: string): Promise<void> {
  await FileSystem.writeAsStringAsync(sidecarPath(key), remoteUrl);
}

async function evictCacheEntry(key: string): Promise<void> {
  await FileSystem.deleteAsync(epubPath(key), { idempotent: true });
  await FileSystem.deleteAsync(sidecarPath(key), { idempotent: true });
}

// Once per session, delete .epub files without a .url sidecar (older naming scheme); every caller awaits the same promise so no download starts mid-sweep.
let cleanup: Promise<void> | null = null;
function cleanupOrphans(): Promise<void> {
  cleanup ??= sweepOrphans();
  return cleanup;
}
async function sweepOrphans(): Promise<void> {
  try {
    const entries = await FileSystem.readDirectoryAsync(CACHE_DIR);
    const epubs = entries.filter((n) => n.endsWith(".epub"));
    let removed = 0;
    for (const name of epubs) {
      const key = name.replace(/\.epub$/, "");
      const sidecar = await FileSystem.getInfoAsync(sidecarPath(key));
      if (!sidecar.exists) {
        await FileSystem.deleteAsync(epubPath(key), { idempotent: true });
        removed++;
      }
    }
    if (removed > 0)
      console.log(`[epub-cache] swept ${removed} orphan file(s) from older cache scheme`);
  } catch (e) {
    console.warn("[epub-cache] orphan sweep failed", e instanceof Error ? e.message : e);
  }
}

// Returns the file:// URI of the cached EPUB, downloading if needed, without the base64 read; ReadiumView only accepts local paths.
const inFlight = new Map<string, Promise<string>>();
export function ensureEpubLocalUri(remoteUrl: string): Promise<string> {
  let pending = inFlight.get(remoteUrl);
  if (!pending) {
    pending = downloadEpub(remoteUrl).finally(() => inFlight.delete(remoteUrl));
    inFlight.set(remoteUrl, pending);
  }
  return pending;
}

async function downloadEpub(remoteUrl: string): Promise<string> {
  await ensureDir();
  await cleanupOrphans();

  const key = cacheKey(remoteUrl);
  const epub = epubPath(key);

  const info = await FileSystem.getInfoAsync(epub);
  let cached = info.exists;

  if (cached) {
    const sidecarUrl = await readSidecar(key);
    if (sidecarUrl !== remoteUrl) {
      console.log("[epub-cache] sidecar mismatch, evicting", {
        key,
        sidecar: sidecarUrl,
        requested: remoteUrl,
      });
      await evictCacheEntry(key);
      cached = false;
    }
  }

  if (!cached) {
    console.log(`[epub-cache] downloading ${remoteUrl}`);
    const result = await FileSystem.downloadAsync(remoteUrl, epub);
    if (result.status !== 200) {
      await evictCacheEntry(key);
      throw new Error(`download failed: HTTP ${result.status}`);
    }
    await writeSidecar(key, remoteUrl);
  }

  console.log(`[epub-cache] ${cached ? "hit" : "miss"} ${epub}`);
  return epub;
}
