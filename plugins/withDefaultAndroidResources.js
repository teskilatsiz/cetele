const {
  withDangerousMod,
  withPlugins,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

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

      fs.mkdirSync(valuesDir, { recursive: true });

      const colorsPath = path.join(valuesDir, 'colors.xml');

      const defaultColors = {
        expoCropToolbarColor: '#ffffff',
        expoCropToolbarIconColor: '#000000',
        expoCropToolbarActionTextColor: '#0A84FF',
        expoCropBackButtonIconColor: '#000000',
        expoCropBackgroundColor: '#ffffff',
      };

      if (fs.existsSync(colorsPath)) {
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

module.exports = function withDefaultAndroidResources(config) {
  return withPlugins(config, [withDefaultColors, withDefaultStrings]);
};
