const { withAndroidStyles } = require('@expo/config-plugins');

module.exports = function withBottomNavStyle(config) {
  return withAndroidStyles(config, async (config) => {
    const styles = config.modResults;
    const appTheme = styles.resources.style.find(
      (style) => style.$.name === 'AppTheme'
    );
    if (appTheme) {
      // Check if it already exists
      const hasElevationOverlay = appTheme.item.some(
        (item) => item.$.name === 'elevationOverlayEnabled'
      );
      if (!hasElevationOverlay) {
        appTheme.item.push({
          $: { name: 'elevationOverlayEnabled' },
          _: 'false'
        });
      }
      
      const hasEnforceContrast = appTheme.item.some(
        (item) => item.$.name === 'android:enforceNavigationBarContrast'
      );
      if (!hasEnforceContrast) {
        appTheme.item.push({
          $: { name: 'android:enforceNavigationBarContrast', 'tools:targetApi': '29' },
          _: 'false'
        });
      } else {
        const item = appTheme.item.find(i => i.$.name === 'android:enforceNavigationBarContrast');
        if (item) item._ = 'false';
      }
    }

    return config;
  });
};
