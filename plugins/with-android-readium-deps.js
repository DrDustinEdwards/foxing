// Expo config plugin: Android setup for react-native-readium.
//
// Three things this injects:
//
// 1. compileOptions + core library desugaring in android/app/build.gradle —
//    Readium uses Java 8+ APIs (java.time, java.util.stream) that aren't
//    natively available below the library's minSdk. Without desugaring,
//    Gradle fails the dex step. expo-build-properties doesn't expose this.
//
// 2. Pinned Kotlin runtime deps (kotlinx-datetime, kotlinx-serialization-json,
//    kotlinx-coroutines-android) in android/app/build.gradle. Readium's
//    transitive deps of these can produce runtime NoClassDefFoundError via
//    Gradle Module Metadata variant resolution — pinning the -jvm/-android
//    artifacts forces a single deterministic variant.
//
// 3. ext.kotlinVersion = "2.1.20" in the ROOT android/build.gradle's
//    buildscript block. Readium 3.1.0 was compiled with Kotlin 2.1.20
//    (per its kotlin-stdlib:2.1.20 POM dep). Older Kotlin runtimes can't
//    fully read its classfile metadata, producing the same kind of silent
//    runtime ClassNotFoundException. react-native-readium's own android
//    build.gradle reads this from rootProject.ext.kotlinVersion — note
//    expo-build-properties' android.kotlinVersion option only writes to
//    gradle.properties, which is read for AGP's compiler version, NOT
//    for what Readium pulls in.
//
// Lost-on-prebuild fix: this plugin is referenced from app.json so the
// next prebuild re-applies all three patches.

const {
  withAppBuildGradle,
  withProjectBuildGradle,
} = require('expo/config-plugins')

const KOTLIN_VERSION = '2.1.20'
const DESUGAR_VERSION = '2.1.2'
// Match Readium 3.1.0's transitive deps exactly. We use the -jvm artifacts
// (not the multiplatform ones) because Gradle Module Metadata variant
// resolution has caused ClassNotFoundException at runtime.
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

function patchAppBuildGradle(contents) {
  let out = contents

  // Add compileOptions inside the android { } block if not already present.
  if (!out.includes('coreLibraryDesugaringEnabled')) {
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

  // Add Readium's pinned Kotlin runtime deps.
  if (!out.includes('kotlinx-datetime-jvm')) {
    out = out.replace(
      /dependencies\s*\{\s*\n/,
      (match) =>
        `${match}${KOTLINX_DATETIME_LINE}\n${KOTLINX_SERIALIZATION_LINE}\n${KOTLINX_COROUTINES_LINE}\n`,
    )
  }

  return out
}

function patchProjectBuildGradle(contents) {
  // Inject ext.kotlinVersion into the root buildscript block. The Expo
  // template's root build.gradle has a buildscript {} but no `ext { ... }`
  // child by default — we need to add one if missing, or insert into the
  // existing one if present.

  if (contents.includes('kotlinVersion')) {
    // Already injected (e.g. user re-ran prebuild without --clean).
    return contents
  }

  // Try to insert into an existing `ext { ... }` block first.
  const extBlockRegex = /(buildscript\s*\{[\s\S]*?ext\s*\{)/m
  if (extBlockRegex.test(contents)) {
    return contents.replace(
      extBlockRegex,
      `$1\n    kotlinVersion = "${KOTLIN_VERSION}"`,
    )
  }

  // Otherwise add a new ext block at the top of buildscript {}.
  return contents.replace(
    /(buildscript\s*\{\s*\n)/,
    `$1  ext {\n    kotlinVersion = "${KOTLIN_VERSION}"\n  }\n`,
  )
}

function withAndroidReadiumDeps(config) {
  let next = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchAppBuildGradle(cfg.modResults.contents)
    return cfg
  })
  next = withProjectBuildGradle(next, (cfg) => {
    cfg.modResults.contents = patchProjectBuildGradle(cfg.modResults.contents)
    return cfg
  })
  return next
}

module.exports = withAndroidReadiumDeps
