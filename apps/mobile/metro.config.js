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
// modules first, then hoisted modules at the workspace root. With
// node-linker=hoisted (set in the root .npmrc), this is sufficient and
// hierarchical lookup can stay on so deeply nested pnpm-virtual-store
// imports can still find their peers in the hoisted tree.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

module.exports = withNativeWind(config, { input: './global.css' })
