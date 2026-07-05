const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `initials/` es material de referencia (brand book, scaffold, assets fuente),
// no parte de la app. Que Metro no lo resuelva ni lo vigile.
config.resolver.blockList = [/[\\/]initials[\\/].*/];

module.exports = config;
