const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `initials/` (referencia) y los proyectos de build `webeditor/` y `pdfviewer/`
// (cada uno con su propio node_modules) NO son parte de la app: que Metro no los
// resuelva. Su salida son los assets .html.
config.resolver.blockList = [
  /[\\/]initials[\\/].*/,
  /[\\/]webeditor[\\/].*/,
  /[\\/]pdfviewer[\\/].*/,
];

// El editor WYSIWYG se embebe como asset .html (lo carga el WebView por archivo).
config.resolver.assetExts = [...config.resolver.assetExts, 'html'];

module.exports = config;
