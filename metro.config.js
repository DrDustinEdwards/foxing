const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Treat reader HTML harness (assets/foliate/reader.html) as an asset
// so expo-asset's Asset.fromModule(require('...')) resolves it to a
// bundled-file URI we can copy onto FileSystem at runtime.
config.resolver.assetExts.push("html");

module.exports = withNativeWind(config, { input: "./global.css" });
