// Materializes the foliate-js bundle (assets/foliate/bundle.json) into a
// readable directory inside the app's documentDirectory on first launch.
// Returns the file:// URI of reader.html — that's what the WebView loads.
//
// Why FileSystem, not direct asset URI: foliate-js's view.js does
// `import './epubcfi.js'` etc., so its modules must resolve against each
// other on disk. We extract once per bundle.version into a flat tree at
// documentDirectory/foliate/v<N>/ and reuse it on subsequent launches.

import * as FileSystem from 'expo-file-system/legacy'
import { Asset } from 'expo-asset'

import bundleData from '../assets/foliate/bundle.json'

interface FoliateBundle {
  version: number
  files: Record<string, string>
}

const bundle = bundleData as FoliateBundle

// reader.html is the static HTML harness that loads view.js + sets up the
// postMessage bridge. Kept as a separate static asset (not in the JSON bundle)
// so we can edit it directly without re-running the build script.
const READER_HTML_ASSET = require('../assets/foliate/reader.html')

let cachedReaderUri: string | null = null

export async function ensureFoliateRuntime(): Promise<string> {
  if (cachedReaderUri) return cachedReaderUri

  const root = `${FileSystem.documentDirectory}foliate/v${bundle.version}/`
  const readerPath = `${root}reader.html`

  // Skip extraction if the version directory already exists with reader.html.
  // The bundle.version bump in build-foliate-bundle.ts forces a fresh extract.
  const existing = await FileSystem.getInfoAsync(readerPath)
  if (existing.exists) {
    cachedReaderUri = readerPath
    return readerPath
  }

  console.log(`[foliate-assets] extracting bundle v${bundle.version} to ${root}`)
  await FileSystem.makeDirectoryAsync(root, { intermediates: true })
  // vendor/ subdir for foliate's own `import './vendor/zip.js'` paths.
  await FileSystem.makeDirectoryAsync(`${root}vendor/`, { intermediates: true })

  for (const [rel, content] of Object.entries(bundle.files)) {
    await FileSystem.writeAsStringAsync(`${root}${rel}`, content)
  }

  // reader.html ships as a real asset (not embedded in JSON) so editing it
  // doesn't require rebuilding the bundle. Resolve via expo-asset to get the
  // bundled-file URI, then copy into the runtime dir alongside the JS files
  // so its `<script src="./view.js">` resolves.
  const asset = Asset.fromModule(READER_HTML_ASSET)
  await asset.downloadAsync()
  if (!asset.localUri) throw new Error('reader.html asset has no localUri after download')
  await FileSystem.copyAsync({ from: asset.localUri, to: readerPath })

  console.log(`[foliate-assets] extracted ${Object.keys(bundle.files).length + 1} files`)
  cachedReaderUri = readerPath
  return readerPath
}
