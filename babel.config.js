module.exports = function (api) {
  api.cache(true);
  return {
    // SDK 54: babel-preset-expo ya incluye el plugin de worklets/reanimated 4.
    presets: ['babel-preset-expo'],
  };
};
