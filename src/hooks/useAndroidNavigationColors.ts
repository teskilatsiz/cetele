import { Color } from 'expo-router';
import { Platform, type ColorValue, useColorScheme } from 'react-native';

import { useAppTheme } from '@/lib/theme';

type AndroidNavigationColors = {
  surfaceContainer: ColorValue;
  onSurfaceVariant: ColorValue;
  secondary: ColorValue;
  secondaryContainer: ColorValue;
  onSecondaryContainer: ColorValue;
};

export function useAndroidNavigationColors(): AndroidNavigationColors {
  const systemScheme = useColorScheme();
  const { colors } = useAppTheme();

  if (Platform.OS !== 'android') {
    return {
      surfaceContainer: colors.tabBackground,
      onSurfaceVariant: colors.textSecondary,
      secondary: colors.accent,
      secondaryContainer: colors.iconBackground,
      onSecondaryContainer: colors.accent,
    };
  }

  void systemScheme;
  const dynamic = Color.android.dynamic;
  const material = Color.android.material;

  return {
    surfaceContainer:
      dynamic.surfaceContainer ?? material.surfaceContainer ?? colors.tabBackground,
    onSurfaceVariant:
      dynamic.onSurfaceVariant ?? material.onSurfaceVariant ?? colors.textSecondary,
    secondary: dynamic.secondary ?? material.secondary ?? colors.accent,
    secondaryContainer:
      dynamic.secondaryContainer ?? material.secondaryContainer ?? colors.iconBackground,
    onSecondaryContainer:
      dynamic.onSecondaryContainer ?? material.onSecondaryContainer ?? colors.accent,
  };
}
