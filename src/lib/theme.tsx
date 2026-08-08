import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Appearance,
  Platform,
  useColorScheme,
  type ColorSchemeName,
} from 'react-native';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemeScheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cetele_theme_preference';

const ACCENT = '#0A84FF';

const palette = {
  light: {
    scheme: 'light' as const,
    accent: ACCENT,
    background: '#F5F6F8',
    elevated: '#FFFFFF',
    elevatedMuted: '#EEF0F4',
    header: 'rgba(245,246,248,0.92)',
    text: '#111114',
    textSecondary: '#686B73',
    textTertiary: '#8A8D96',
    border: 'rgba(17,17,20,0.10)',
    divider: 'rgba(17,17,20,0.08)',
    iconBackground: 'rgba(10,132,255,0.10)',
    inputBackground: '#FFFFFF',
    placeholder: 'rgba(17,17,20,0.42)',
    destructive: '#D92D20',
    tabBackground: '#FFFFFF',
    shadow: 'rgba(20,24,32,0.12)',
    statusBarStyle: 'dark' as const,
    blurTint: 'light' as const,
  },
  dark: {
    scheme: 'dark' as const,
    accent: ACCENT,
    background: '#000000',
    elevated: 'rgba(28,28,30,0.90)',
    elevatedMuted: '#1C1C1E',
    header: 'rgba(0,0,0,0.86)',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    textTertiary: '#636366',
    border: 'rgba(255,255,255,0.08)',
    divider: 'rgba(255,255,255,0.06)',
    iconBackground: 'rgba(255,255,255,0.06)',
    inputBackground: '#1C1C1E',
    placeholder: 'rgba(255,255,255,0.44)',
    destructive: '#FF453A',
    tabBackground: '#050506',
    shadow: 'rgba(0,0,0,0.28)',
    statusBarStyle: 'light' as const,
    blurTint: 'dark' as const,
  },
};

type ThemePalette = typeof palette;
export type AppTheme = ThemePalette[keyof ThemePalette];

interface ThemeContextValue {
  preference: ThemePreference;
  scheme: ThemeScheme;
  colors: AppTheme;
  setPreference: (preference: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  scheme: 'dark',
  colors: palette.dark,
  setPreference: async () => {},
});

function normalizePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function resolveScheme(preference: ThemePreference, systemScheme: ColorSchemeName): ThemeScheme {
  if (preference !== 'system') return preference;
  return systemScheme === 'light' ? 'light' : 'dark';
}

function setNativeColorScheme(preference: ThemePreference) {
  if (Platform.OS === 'web') return;

  const setColorScheme = (
    Appearance as unknown as {
      setColorScheme?: (scheme: 'light' | 'dark' | 'unspecified') => void;
    }
  ).setColorScheme;

  if (typeof setColorScheme === 'function') {
    setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!mounted) return;
        const restoredPreference = normalizePreference(stored);
        setNativeColorScheme(restoredPreference);
        setPreferenceState(restoredPreference);
      })
      .catch((error) => {
        console.error('Error reading theme preference', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const scheme = resolveScheme(preference, systemScheme);
  const colors = palette[scheme];

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
      if (Platform.OS === 'android') {
        NavigationBar.setStyle(scheme === 'dark' ? 'light' : 'dark');
      }
      return;
    }

    if (typeof document !== 'undefined') {
      document.documentElement.style.backgroundColor = colors.background;
      document.documentElement.style.colorScheme = scheme;
      document.body.style.backgroundColor = colors.background;
    }
  }, [colors.background, scheme]);

  const setPreference = useCallback(async (nextPreference: ThemePreference) => {
    const normalized = normalizePreference(nextPreference);
    setPreferenceState(normalized);
    setNativeColorScheme(normalized);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch (error) {
      console.error('Error saving theme preference', error);
    }
  }, []);

  const value = useMemo(
    () => ({
      preference,
      scheme,
      colors,
      setPreference,
    }),
    [colors, preference, scheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
