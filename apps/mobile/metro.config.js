const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

// Expo monorepo metro config per
// https://docs.expo.dev/guides/monorepos/. Without these tweaks Metro
// can't resolve workspace packages (@foxing/types, @foxing/utils) because
// pnpm symlinks land outside the mobile app's own node_modules tree.

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch every file in the workspace so changes to packages/* trigger
// HMR in the mobile app.
config.watchFolders = [workspaceRoot]

// Tell Metro where to look for packages and in what order. App-local
// modules first, then hoisted modules at the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Force Metro to honor the explicit nodeModulesPaths list instead of
// walking up the directory tree on its own.
config.resolver.disableHierarchicalLookup = true

// Treat the foliate WebView HTML harness as an asset so
// expo-asset's Asset.fromModule(require('./reader.html')) resolves to
// a bundled-file URI we can copy onto FileSystem at runtime.
config.resolver.assetExts.push('html')

module.exports = withNativeWind(config, { input: './global.css' })
