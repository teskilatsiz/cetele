const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

function projectPathPattern(relativePath) {
  return escapeRegex(path.resolve(__dirname, relativePath)).replace(/\\\\/g, '[/\\\\]');
}

const projectBlockList = [
  'dist',
  '.expo',
  'android/.gradle',
  'android/build',
  'android/app/build',
].map(
  (relativePath) => new RegExp(`^(${projectPathPattern(relativePath)})([/\\\\].*)?$`)
);

const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList];

config.resolver.blockList = [
  ...defaultBlockList.filter(Boolean),
  ...projectBlockList,
];

if (process.platform === 'win32') {
  // Tailwind/Uniwind CSS generation is I/O-heavy on Windows. Keeping a single
  // Metro worker prevents parallel transforms from exhausting file handles.
  config.maxWorkers = 1;
  config.stickyWorkers = false;
}

module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/styles/global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
