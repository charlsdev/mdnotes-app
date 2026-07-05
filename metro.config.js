const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `initials/` (referencia) y `webeditor/` (proyecto de build del editor Crepe, con
// su propio node_modules) NO son parte de la app: que Metro no los resuelva.
config.resolver.blockList = [/[\\/]initials[\\/].*/, /[\\/]webeditor[\\/].*/];

// El editor WYSIWYG se embebe como asset .html (lo carga el WebView por archivo).
config.resolver.assetExts = [...config.resolver.assetExts, 'html'];

module.exports = config;
