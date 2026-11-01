// plugins/withReleaseSigning.js — Firma el .aab de Google Play con la llave de SUBIDA.
//
// Por qué un plugin: android/ se regenera en cada `expo prebuild` (está en
// .gitignore), así que editar build.gradle a mano se perdería. La plantilla de Expo
// firma el release con debug.keystore, y Play rechaza un bundle firmado así.
//
// La llave NUNCA entra al repo. build.gradle solo lee una ruta: la propiedad
// <PREFIX>_SIGNING (en ~/.gradle/gradle.properties o como variable de entorno)
// apunta a un signing.properties fuera del repo con storeFile, storePassword,
// keyAlias y keyPassword. Lo crea create-upload-key.ps1.
//
// La llave de subida se usa SOLO al pedir un bundle release (`bundleRelease`). El
// APK de build-and-install.ps1 sigue con la de debug a propósito: si cambiara, la
// próxima instalación por USB chocaría con la firma de la app ya instalada y el
// script la desinstalaría, borrando sus datos locales. Sin la propiedad, el bundle
// falla con un mensaje claro en vez de salir con una firma que Play rechaza.
//
// Mismo archivo en daemoni, mdnotes y rxtribe; solo cambia `prefix` en app.json.

const { withAppBuildGradle } = require('@expo/config-plugins');

const MARK = '// withReleaseSigning';

module.exports = function withReleaseSigning(config, { prefix } = {}) {
  if (!prefix) throw new Error('withReleaseSigning: falta la opción "prefix" (p. ej. "RXTRIBE").');
  const prop = `${prefix}_SIGNING`;

  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;

    // `\${…}` sale tal cual: es interpolación de Groovy, no de JS.
    const loader = `
${MARK}: llave de subida a Google Play, leída de fuera del repo.
def uploadSigningPath = findProperty('${prop}') ?: System.getenv('${prop}')
def uploadSigning = null
if (uploadSigningPath) {
    def f = file(uploadSigningPath)
    if (!f.exists()) throw new GradleException("${prop} apunta a \${f}, que no existe.")
    uploadSigning = new Properties()
    f.withInputStream { uploadSigning.load(it) }
}
def wantsUploadKey = gradle.startParameter.taskNames.any { it ==~ /(.*:)?bundle\\w*Release/ }
if (wantsUploadKey && !uploadSigning) {
    throw new GradleException("Falta la llave de subida: define ${prop} (crea la llave con create-upload-key.ps1). Google Play rechaza un .aab firmado con debug.keystore.")
}

`;
    const before = src;
    src = src.replace(/^android\s*\{/m, (m) => loader + m);

    src = src.replace(
      /signingConfigs\s*\{/,
      (m) => `${m}
        release {
            if (uploadSigning) {
                storeFile file(uploadSigning['storeFile'])
                storePassword uploadSigning['storePassword']
                keyAlias uploadSigning['keyAlias']
                keyPassword uploadSigning['keyPassword']
            }
        }`
    );

    // Solo el `signingConfig` del buildType release (el de debug va antes y no se toca).
    src = src.replace(
      /(\brelease\s*\{[^{}]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig wantsUploadKey ? signingConfigs.release : signingConfigs.debug'
    );

    // Si la plantilla de Expo cambia y algo no encaja, que reviente el prebuild: un
    // bundle firmado con la llave de debug no se nota hasta que Play lo rechaza.
    const applied = [
      src !== before && src.includes(loader),
      src.includes("storeFile file(uploadSigning['storeFile'])"),
      src.includes('signingConfig wantsUploadKey ? signingConfigs.release : signingConfigs.debug'),
    ];
    if (applied.includes(false)) {
      throw new Error(
        'withReleaseSigning: android/app/build.gradle no tiene la forma esperada (android { … signingConfigs { … } … release { signingConfig signingConfigs.debug … }). Revisa el plugin.'
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
