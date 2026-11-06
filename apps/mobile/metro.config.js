const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

// Expo monorepo metro config per
// https://docs.expo.dev/guides/monorepos/. Without these tweaks Metro
// can't resolve workspace packages (@foxing/types, @foxing/client) because
// workspace packages are hoisted to the root node_modules, outside the mobile app's own tree.

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch every file in the workspace so changes to packages/* trigger
// HMR in the mobile app.
config.watchFolders = [workspaceRoot]

// Tell Metro where to look for packages and in what order. App-local
// modules first, then hoisted modules at the workspace root. With
// npm's hoisted install, this is sufficient and hierarchical lookup can
// stay on so nested imports can still find their peers in the hoisted tree.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

module.exports = withNativeWind(config, { input: './global.css' })
