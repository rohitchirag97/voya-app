module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js'],
  // Transform these ESM packages too (lucide ships .mjs files).
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json'],
  transform: { '^.+\\.(js|jsx|mjs|ts|tsx)$': 'babel-jest' },
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community|-google-signin)?|react-native-svg|lucide-react-native)/)'],
};
