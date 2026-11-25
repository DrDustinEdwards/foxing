const { withAppBuildGradle } = require("expo/config-plugins");

// expo-build-properties@56 dropped enableCoreLibraryDesugaring, but Readium's kotlin-toolkit AARs still need it under SDK 56; this adds the desugar compileOption and dependency on prebuild.
const DESUGAR_LIB_VERSION = "2.1.5";

function injectCompileOptions(contents) {
  if (contents.includes("coreLibraryDesugaringEnabled")) return contents;

  return contents.replace(
    /android\s*\{\n/,
    `android {
    compileOptions {
        coreLibraryDesugaringEnabled true
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

`,
  );
}

function injectDesugarDependency(contents) {
  if (contents.includes("desugar_jdk_libs")) return contents;

  return contents.replace(
    /dependencies\s*\{\n/,
    `dependencies {
    coreLibraryDesugaring "com.android.tools:desugar_jdk_libs:${DESUGAR_LIB_VERSION}"

`,
  );
}

const withDesugaring = (config) => {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    contents = injectCompileOptions(contents);
    contents = injectDesugarDependency(contents);
    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withDesugaring;
