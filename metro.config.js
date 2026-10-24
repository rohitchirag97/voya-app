const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaults = getDefaultConfig(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // lucide-react-native ships ES modules as .mjs files.
    sourceExts: [...defaults.resolver.sourceExts, 'mjs'],
  },
};

module.exports = mergeConfig(defaults, config);
