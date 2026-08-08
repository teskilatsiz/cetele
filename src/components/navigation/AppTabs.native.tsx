import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DynamicColorIOS, Platform } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import * as Haptics from 'expo-haptics';
import { TabBarVisibilityContext } from '@/components/TabBarVisibilityContext';
import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

const ACCENT_COLOR = '#0A84FF';

export function AppTabs() {
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const [isTabBarManuallyHidden, setTabBarHidden] = useState(false);
  const [tabBarHideLockCount, setTabBarHideLockCount] = useState(0);
  const tabBarHideLocksRef = useRef(new Set<symbol>());
  const mountedRef = useRef(true);
  const isAndroid = Platform.OS === 'android';
  const isTabBarHidden = isTabBarManuallyHidden || tabBarHideLockCount > 0;

  useEffect(() => {
    const tabBarHideLocks = tabBarHideLocksRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      tabBarHideLocks.clear();
    };
  }, []);

  const acquireTabBarHidden = useCallback(() => {
    const lock = Symbol('tab-bar-hidden');
    tabBarHideLocksRef.current.add(lock);
    if (mountedRef.current) {
      setTabBarHideLockCount(tabBarHideLocksRef.current.size);
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      tabBarHideLocksRef.current.delete(lock);
      if (mountedRef.current) {
        setTabBarHideLockCount(tabBarHideLocksRef.current.size);
      }
    };
  }, []);

  const tintColor = Platform.OS === 'ios'
    ? DynamicColorIOS({ light: ACCENT_COLOR, dark: ACCENT_COLOR })
    : ACCENT_COLOR;

  const labelStyle = Platform.OS === 'ios'
    ? {
        default: {
          color: DynamicColorIOS({ light: '#6B6B70', dark: '#8E8E93' }),
        },
        selected: { color: tintColor },
      }
    : {
        default: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' as const },
        selected: { color: ACCENT_COLOR, fontSize: 12, fontWeight: '700' as const },
      };

  const contentStyle = { backgroundColor: colors.background };
  const navigationTheme = useMemo(() => {
    const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: colors.background,
        card: colors.background,
      },
    };
  }, [colors.background, scheme]);
  const tabBarContextValue = useMemo(
    () => ({ isTabBarHidden, setTabBarHidden, acquireTabBarHidden }),
    [acquireTabBarHidden, isTabBarHidden]
  );

  return (
    <TabBarVisibilityContext.Provider value={tabBarContextValue}>
      <NavigationThemeProvider value={navigationTheme}>
      <NativeTabs
        backBehavior="history"
        hidden={isTabBarHidden}
        backgroundColor={isAndroid ? colors.background : 'transparent'}
        blurEffect={Platform.OS === 'ios'
          ? (scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight')
          : undefined}
        tintColor={tintColor}
        iconColor={{
          default: colors.textSecondary,
          selected: ACCENT_COLOR,
        }}
        indicatorColor={isAndroid ? colors.iconBackground : undefined}
        labelStyle={labelStyle}
        labelVisibilityMode={isAndroid ? 'labeled' : undefined}
        minimizeBehavior={Platform.OS === 'ios' ? 'onScrollDown' : undefined}
        shadowColor={Platform.OS === 'ios' ? colors.shadow : undefined}
        screenListeners={{
          tabPress: () => {
            void Haptics.selectionAsync();
          },
        }}
      >
        <NativeTabs.Trigger
          name="index"
          contentStyle={contentStyle}
          disableAutomaticContentInsets={false}
        >
          <NativeTabs.Trigger.Icon
            sf={{ default: 'doc.text', selected: 'doc.text.fill' }}
            md="description"
          />
          <NativeTabs.Trigger.Label>{t('common.notes')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="settings"
          contentStyle={contentStyle}
          disableAutomaticContentInsets={false}
        >
          <NativeTabs.Trigger.Icon
            sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
            md="settings"
          />
          <NativeTabs.Trigger.Label>{t('common.settings')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      </NavigationThemeProvider>
    </TabBarVisibilityContext.Provider>
  );
}
