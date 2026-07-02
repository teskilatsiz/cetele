const {
  withDangerousMod,
  withPlugins,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Ensures default colors.xml exists in values/ with all crop-related colors.
 * Fixes: MissingDefaultResource lint errors for expoCrop* colors that only
 * exist in values-night/colors.xml.
 */
function withDefaultColors(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const valuesDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'values'
      );

      // Ensure the directory exists
      fs.mkdirSync(valuesDir, { recursive: true });

      const colorsPath = path.join(valuesDir, 'colors.xml');

      // Default (light mode) color values matching the dark theme counterparts
      const defaultColors = {
        expoCropToolbarColor: '#ffffff',
        expoCropToolbarIconColor: '#000000',
        expoCropToolbarActionTextColor: '#0A84FF',
        expoCropBackButtonIconColor: '#000000',
        expoCropBackgroundColor: '#ffffff',
      };

      if (fs.existsSync(colorsPath)) {
        // File exists — inject missing colors
        let content = fs.readFileSync(colorsPath, 'utf-8');
        for (const [name, value] of Object.entries(defaultColors)) {
          if (!content.includes(`name="${name}"`)) {
            content = content.replace(
              '</resources>',
              `    <color name="${name}">${value}</color>\n</resources>`
            );
          }
        }
        fs.writeFileSync(colorsPath, content, 'utf-8');
      } else {
        // File doesn't exist — create it
        const colorEntries = Object.entries(defaultColors)
          .map(([name, value]) => `    <color name="${name}">${value}</color>`)
          .join('\n');
        const content = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${colorEntries}\n</resources>\n`;
        fs.writeFileSync(colorsPath, content, 'utf-8');
      }

      return config;
    },
  ]);
}

/**
 * Ensures default strings.xml contains photos_permission and face_id_permission.
 * Fixes: ExtraTranslation lint errors for strings that only exist in
 * language-specific values-b+XX directories.
 */
function withDefaultStrings(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const valuesDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'values'
      );

      fs.mkdirSync(valuesDir, { recursive: true });

      const stringsPath = path.join(valuesDir, 'strings.xml');

      // English defaults as base/fallback strings
      const defaultStrings = {
        photos_permission:
          'Çetele accesses your media library so you can attach photos and videos to notes.',
        face_id_permission:
          'Çetele uses biometric authentication to protect access to your encrypted notes and private key.',
      };

      if (fs.existsSync(stringsPath)) {
        let content = fs.readFileSync(stringsPath, 'utf-8');
        for (const [name, value] of Object.entries(defaultStrings)) {
          if (!content.includes(`name="${name}"`)) {
            // Escape XML special chars in value
            const escaped = value
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/'/g, "\\'");
            content = content.replace(
              '</resources>',
              `    <string name="${name}">${escaped}</string>\n</resources>`
            );
          }
        }
        fs.writeFileSync(stringsPath, content, 'utf-8');
      } else {
        const stringEntries = Object.entries(defaultStrings)
          .map(([name, value]) => {
            const escaped = value
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/'/g, "\\'");
            return `    <string name="${name}">${escaped}</string>`;
          })
          .join('\n');
        const content = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${stringEntries}\n</resources>\n`;
        fs.writeFileSync(stringsPath, content, 'utf-8');
      }

      return config;
    },
  ]);
}

/**
 * Combined plugin: ensures all default Android resources exist.
 */
module.exports = function withDefaultAndroidResources(config) {
  return withPlugins(config, [withDefaultColors, withDefaultStrings]);
};
