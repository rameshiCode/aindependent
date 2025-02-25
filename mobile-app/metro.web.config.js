const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Fix MIME type issues for web
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
config.transformer.minifierPath = require.resolve('metro-minify-terser');
config.transformer.minifierConfig = {};

// Make sure web js files are properly handled
config.resolver.sourceExts.unshift('web.js', 'web.ts', 'web.tsx');

module.exports = withNativeWind(config, { input: './global.css' });