// Expo config plugin: enable Android core library desugaring.
//
// react-native-readium depends on Java 8+ APIs (java.time, java.util.stream,
// etc.) that aren't natively available below the library's minSdk. Without
// desugaring, Gradle fails the dex step with "Cannot fit requested classes
// in a single dex file" or "Default interface methods are only supported
// starting with Android N (--min-api 24)".
//
// expo-build-properties doesn't expose this setting, so we inject it
// directly into android/app/build.gradle via withAppBuildGradle.
//
// Lost-on-prebuild fix: this plugin is referenced from app.json so the
// next prebuild re-applies it.

const { withAppBuildGradle } = require('expo/config-plugins')

const DESUGAR_VERSION = '2.1.2'
const COMPILE_OPTIONS_BLOCK = `
    compileOptions {
        coreLibraryDesugaringEnabled true
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
`
const DEPENDENCY_LINE = `    coreLibraryDesugaring "com.android.tools:desugar_jdk_libs:${DESUGAR_VERSION}"`

function patchBuildGradle(contents) {
  let out = contents

  // Add compileOptions inside the android { } block if not already present.
  if (!out.includes('coreLibraryDesugaringEnabled')) {
    // Insert right after the `namespace` line (which is always present in
    // Expo's generated build.gradle) so we land inside android { }.
    out = out.replace(
      /(namespace\s+'[^']+'\s*\n)/,
      `$1${COMPILE_OPTIONS_BLOCK}`,
    )
  }

  // Add the desugar dependency inside the dependencies { } block.
  if (!out.includes('desugar_jdk_libs')) {
    out = out.replace(
      /dependencies\s*\{\s*\n/,
      (match) => `${match}${DEPENDENCY_LINE}\n`,
    )
  }

  return out
}

function withAndroidDesugaring(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents)
    return cfg
  })
}

module.exports = withAndroidDesugaring
