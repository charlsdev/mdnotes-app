// plugins/withCmakeVersion.js — Fuerza la versión de CMake en android/app/build.gradle.
//
// Por qué: el CMake 3.22.1 por defecto de React Native trae un ninja que IGNORA las
// rutas largas de Windows y muere con "Filename longer than 260 characters" al compilar
// los componentes Fabric de react-native-keyboard-controller (rutas C++ >300 chars).
// CMake 4.x trae un ninja que sí respeta LongPaths. Este plugin reaplica el override en
// cada `expo prebuild` (que regenera android/ y borraría la edición a mano).

const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withCmakeVersion(config, { version = '4.1.2' } = {}) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    // Si ya hay un bloque cmake en android/app/build.gradle, no tocamos nada.
    if (/externalNativeBuild\s*\{[\s\S]*?cmake/.test(src)) return cfg;
    const block =
      '\n    externalNativeBuild {\n        cmake {\n            version "' +
      version +
      '"\n        }\n    }\n';
    // Inserta justo tras la apertura del bloque android { } principal.
    src = src.replace(/^android\s*\{/m, (m) => m + block);
    cfg.modResults.contents = src;
    return cfg;
  });
};
