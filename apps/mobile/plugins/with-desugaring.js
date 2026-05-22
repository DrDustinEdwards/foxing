const { withAppBuildGradle } = require('expo/config-plugins')

// expo-build-properties@56 dropped support for the enableCoreLibraryDesugaring
// key, but Readium's kotlin-toolkit AARs (readium-shared / readium-streamer /
// readium-navigator) still require it to compile under SDK 56. This plugin
// patches android/app/build.gradle on every prebuild to add the desugar
// compileOption + dependency so the host project picks them up.
//
// The desugar_jdk_libs version is the latest compatible with AGP 8.7+ at the
// time of writing (May 2026). If AGP is bumped, this may need to track.
const DESUGAR_LIB_VERSION = '2.1.5'

function injectCompileOptions(contents) {
  if (contents.includes('coreLibraryDesugaringEnabled')) return contents

  // The generated SDK 56 app/build.gradle has no compileOptions block by
  // default; insert one just after the android { line.
  return contents.replace(
    /android\s*\{\n/,
    `android {
    compileOptions {
        coreLibraryDesugaringEnabled true
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

`,
  )
}

function injectDesugarDependency(contents) {
  if (contents.includes('desugar_jdk_libs')) return contents

  return contents.replace(
    /dependencies\s*\{\n/,
    `dependencies {
    coreLibraryDesugaring "com.android.tools:desugar_jdk_libs:${DESUGAR_LIB_VERSION}"

`,
  )
}

const withDesugaring = (config) => {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents
    contents = injectCompileOptions(contents)
    contents = injectDesugarDependency(contents)
    config.modResults.contents = contents
    return config
  })
}

module.exports = withDesugaring
