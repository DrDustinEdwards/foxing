// Expo config plugin: Android setup for react-native-readium.
//
// Two things this injects into android/app/build.gradle:
//
// 1. Core library desugaring — Readium uses Java 8+ APIs (java.time,
//    java.util.stream, etc.) that aren't natively available below the
//    library's minSdk. Without desugaring, Gradle fails the dex step.
//    expo-build-properties doesn't expose this option.
//
// 2. kotlinx-datetime — Readium 3.1.0 (transitively via react-native-readium)
//    uses kotlinx.datetime.Instant in its EPUB metadata parser, but
//    react-native-readium's own build.gradle does not declare the dep.
//    The app crashes at runtime when opening any EPUB with metadata dates:
//      java.lang.NoClassDefFoundError: Failed resolution of:
//      Lkotlinx/datetime/Instant;
//        at org.readium.r2.shared.util.Instant$Companion.parse
//        at org.readium.r2.streamer.parser.epub.MetadataAdapter.adapt
//    Adding the implementation explicitly fixes it.
//
// Lost-on-prebuild fix: this plugin is referenced from app.json so the
// next prebuild re-applies it.

const { withAppBuildGradle } = require('expo/config-plugins')

const DESUGAR_VERSION = '2.1.2'
// Match Readium 3.1.0's transitive deps exactly to avoid GMM variant
// resolution surprises. We use the -jvm artifacts (not the multiplatform
// ones) because Gradle Module Metadata has caused ClassNotFoundException
// at runtime for kotlinx.datetime.Instant even when classes appear in the
// dex — the fix is to force the JVM-targeted artifact directly.
const KOTLINX_DATETIME_VERSION = '0.6.1'
const KOTLINX_SERIALIZATION_JSON_VERSION = '1.7.3'
const KOTLINX_COROUTINES_VERSION = '1.10.1'

const COMPILE_OPTIONS_BLOCK = `
    compileOptions {
        coreLibraryDesugaringEnabled true
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
`
const DESUGAR_LINE = `    coreLibraryDesugaring "com.android.tools:desugar_jdk_libs:${DESUGAR_VERSION}"`
const KOTLINX_DATETIME_LINE = `    implementation "org.jetbrains.kotlinx:kotlinx-datetime-jvm:${KOTLINX_DATETIME_VERSION}"`
const KOTLINX_SERIALIZATION_LINE = `    implementation "org.jetbrains.kotlinx:kotlinx-serialization-json-jvm:${KOTLINX_SERIALIZATION_JSON_VERSION}"`
const KOTLINX_COROUTINES_LINE = `    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:${KOTLINX_COROUTINES_VERSION}"`

function patchBuildGradle(contents) {
  let out = contents

  // Add compileOptions inside the android { } block if not already present.
  if (!out.includes('coreLibraryDesugaringEnabled')) {
    // Insert right after the `namespace` line (always present in Expo's
    // generated build.gradle) so we land inside android { }.
    out = out.replace(
      /(namespace\s+'[^']+'\s*\n)/,
      `$1${COMPILE_OPTIONS_BLOCK}`,
    )
  }

  // Add the desugar dependency inside the dependencies { } block.
  if (!out.includes('desugar_jdk_libs')) {
    out = out.replace(
      /dependencies\s*\{\s*\n/,
      (match) => `${match}${DESUGAR_LINE}\n`,
    )
  }

  // Add Readium's transitive Kotlin runtime deps using the JVM-targeted
  // artifacts. Even though Readium's POM declares these, Gradle Module
  // Metadata variant resolution has produced runtime ClassNotFoundException
  // for kotlinx.datetime.Instant — pinning the -jvm artifacts forces a
  // single, deterministic variant into the APK.
  if (!out.includes('kotlinx-datetime-jvm')) {
    out = out.replace(
      /dependencies\s*\{\s*\n/,
      (match) =>
        `${match}${KOTLINX_DATETIME_LINE}\n${KOTLINX_SERIALIZATION_LINE}\n${KOTLINX_COROUTINES_LINE}\n`,
    )
  }

  return out
}

function withAndroidReadiumDeps(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents)
    return cfg
  })
}

module.exports = withAndroidReadiumDeps
