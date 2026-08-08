import '@formatjs/intl-getcanonicallocales/polyfill.js';
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/tr.js';
import '@formatjs/intl-pluralrules/locale-data/ru.js';
import '@formatjs/intl-pluralrules/locale-data/hi.js';
import '@formatjs/intl-pluralrules/locale-data/pt.js';
import '@formatjs/intl-numberformat/polyfill.js';
import '@formatjs/intl-numberformat/locale-data/en.js';
import '@formatjs/intl-numberformat/locale-data/tr.js';
import '@formatjs/intl-numberformat/locale-data/ru.js';
import '@formatjs/intl-numberformat/locale-data/hi.js';
import '@formatjs/intl-numberformat/locale-data/pt.js';
import '@formatjs/intl-relativetimeformat/polyfill.js';
import '@formatjs/intl-relativetimeformat/locale-data/en.js';
import '@formatjs/intl-relativetimeformat/locale-data/tr.js';
import '@formatjs/intl-relativetimeformat/locale-data/ru.js';
import '@formatjs/intl-relativetimeformat/locale-data/hi.js';
import '@formatjs/intl-relativetimeformat/locale-data/pt.js';
import '../styles/global.css';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Stack, useSegments } from 'expo-router';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import { AppState, AppStateStatus, Modal, Platform, View, StyleSheet, useWindowDimensions, LogBox } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { isRunningInExpoGo } from 'expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { biometricAuthService } from '@/lib/biometric-auth';
import { nostrService } from '@/lib/nostr';
import { WebSidebar } from '@/components/WebSidebar';
import { BiometricLockScreen } from '@/components/BiometricLockScreen';
import { AnimatedSplashScreen } from '@/components/AnimatedSplashScreen';
import { AppAlertProvider } from '@/components/AppAlertProvider';
import { HeroUINativeProvider } from 'heroui-native';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider, useAppTheme } from '@/lib/theme';
import { SessionProvider, useSession } from '@/providers/SessionProvider';
import { WebSeo } from '@/components/WebSeo';
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

LogBox.ignoreLogs([
  "HeroUI Native Styling Principles"
]);

const WebLayoutWrapper = ({ children }: { children: React.ReactNode }) => {
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const { isAuthenticated } = useSession();
  const segments = useSegments();
  if (Platform.OS !== 'web') return <>{children}</>;

  const isDesktop = width >= 768;
  const primarySegment = segments[0] as string | undefined;
  const isAuthenticatedAppRoute =
    primarySegment === '(tabs)' ||
    primarySegment === 'note' ||
    primarySegment === 'edit' ||
    primarySegment === 'new';
  const shouldShowSidebar = isAuthenticated && isAuthenticatedAppRoute;

  return isDesktop ? (
    <View style={[styles.webDesktopRoot, { backgroundColor: colors.background }]}>
      {shouldShowSidebar && <WebSidebar />}
      <View style={[styles.webDesktopContent, { backgroundColor: colors.background }]}>
        {children}
      </View>
    </View>
  ) : (
    <View style={[styles.webMobileRoot, { backgroundColor: colors.background }]}>{children}</View>
  );
};

const AndroidStatusBarBackground = ({ color }: { color: string }) => {
  const insets = useSafeAreaInsets();

  if (Platform.OS !== 'android' || insets.top <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.androidStatusBarBackground, { height: insets.top, backgroundColor: color }]}
    />
  );
};

const styles = StyleSheet.create({
  safeAreaProvider: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webDesktopRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#000000',
  },
  webDesktopContent: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webMobileRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  biometricOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: '#000000',
  },
  androidStatusBarBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 1000,
  },
});

export default function RootLayout() {
  useFrameworkReady();

  return (
    <>
      <WebSeo />
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </>
  );
}

function RootLayoutContent() {
  const { colors } = useAppTheme();

  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(
    Platform.OS !== 'web' && !isRunningInExpoGo()
  );
  const appState = useRef(AppState.currentState);
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isLockedRef = useRef(false);
  const isBiometricPromptActiveRef = useRef(false);
  const lastUnlockAtRef = useRef(0);
  const isMountedRef = useRef(true);

  const checkInitialAuth = useCallback(async () => {
    try {
      const session = await nostrService.restoreSession();
      const authenticated = session !== null;
      if (!isMountedRef.current) return;
      setIsAuthenticated(authenticated);
      if (authenticated && Platform.OS !== 'web') {
        const shouldLock = await biometricAuthService.shouldRequireBiometricAuth();
        if (shouldLock && isMountedRef.current) {
          setIsLocked(true);
        }
      }
    } catch {
      if (isMountedRef.current) {
        setIsAuthenticated(false);
        setIsLocked(false);
      }
    } finally {
      await SplashScreen.hideAsync().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkInitialAuth();
    return () => {
      isMountedRef.current = false;
    };
  }, [checkInitialAuth]);
  const handleAnimationComplete = () => {
    setShowAnimatedSplash(false);
  };
  const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
    if (!isAuthenticated) return;
    const recentlyUnlocked = Date.now() - lastUnlockAtRef.current < 3500;
    const canRequestLock =
      !isLockedRef.current &&
      !isBiometricPromptActiveRef.current &&
      !recentlyUnlocked;

    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      if (!canRequestLock) {
        appState.current = nextAppState;
        return;
      }
      const shouldLock = await biometricAuthService.shouldRequireBiometricAuth();
      if (shouldLock && isMountedRef.current && canRequestLock) {
        setIsLocked(true);
      }
    }

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
      }
      lockTimeoutRef.current = setTimeout(async () => {
        if (isLockedRef.current || isBiometricPromptActiveRef.current) return;
        const shouldLock = await biometricAuthService.shouldRequireBiometricAuth();
        if (shouldLock && isMountedRef.current && Date.now() - lastUnlockAtRef.current >= 3500) {
          setIsLocked(true);
        }
      }, 100);
    }
    appState.current = nextAppState;
  }, [isAuthenticated]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
      }
    };
  }, [handleAppStateChange]);
  const handleUnlock = () => {
    lastUnlockAtRef.current = Date.now();
    isBiometricPromptActiveRef.current = false;
    setIsLocked(false);
  };
  const handleBiometricPromptStateChange = (active: boolean) => {
    isBiometricPromptActiveRef.current = active;
  };
  if (showAnimatedSplash) {
    return (
      <GestureHandlerRootView className="bg-background text-foreground" style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaProvider style={[styles.safeAreaProvider, { backgroundColor: colors.background }]}>
          <AnimatedSplashScreen onAnimationComplete={handleAnimationComplete} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }
  return (
    <GestureHandlerRootView className="bg-background text-foreground" style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider style={[styles.safeAreaProvider, { backgroundColor: colors.background }]}>
      <AndroidStatusBarBackground color={colors.background} />
      <I18nProvider>
      <KeyboardProvider>
        <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
        <SessionProvider
          isAuthenticated={isAuthenticated}
          setIsAuthenticated={setIsAuthenticated}
        >
          <AppAlertProvider>
          <WebLayoutWrapper>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              ...Platform.select({
                ios: {
                  animation: 'default',
                  gestureEnabled: true,
                  fullScreenGestureEnabled: true,
                  animationDuration: 350,
                  customAnimationOnGesture: true,
                },
                android: {
                  animation: 'slide_from_right',
                  gestureEnabled: true,
                },
                default: {
                  animation: 'fade',
                },
              }),
            }}>
            <Stack.Screen name="index" options={{ gestureEnabled: false }} />
            <Stack.Screen
              name="(tabs)"
              options={{
                gestureEnabled: false,
                animation: 'none',
              }}
            />
            <Stack.Screen
              name="note/[id]"
              options={{
                ...Platform.select({
                  ios: { animation: 'default' },
                  android: { animation: 'slide_from_right' },
                }),
              }}
            />
            <Stack.Screen
              name="edit/[id]"
              options={{
                ...Platform.select({
                  ios: { animation: 'default' },
                  android: { animation: 'slide_from_right' },
                }),
              }}
            />
            <Stack.Screen
              name="new"
              options={{
                ...Platform.select({
                  ios: { animation: 'default' },
                  android: { animation: 'slide_from_right' },
                }),
              }}
            />
            <Stack.Screen name="+not-found" />
            <Stack.Screen name="signer-callback" options={{ animation: 'none' }} />
            <Stack.Screen
              name="privacy"
              options={{
                presentation: Platform.OS === 'web' ? 'card' : 'modal',
              }}
            />
            <Stack.Screen
              name="technical-documentation"
              options={{
                presentation: 'modal',
                ...Platform.select({
                  ios: {
                    animation: 'slide_from_bottom',
                    gestureDirection: 'vertical',
                  },
                  android: { animation: 'slide_from_bottom' },
                }),
              }}
            />
          </Stack>
          <StatusBar animated style={colors.statusBarStyle} />
        </WebLayoutWrapper>
        {isLocked && Platform.OS !== 'web' && (
          <Modal
            visible={isLocked}
            animationType="none"
            presentationStyle="fullScreen"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={() => {}}
          >
            <View
              style={[styles.biometricOverlay, { backgroundColor: colors.background }]}
              accessibilityViewIsModal
              importantForAccessibility="yes"
            >
              <BiometricLockScreen
                onUnlock={handleUnlock}
                onAuthenticatingChange={handleBiometricPromptStateChange}
              />
            </View>
          </Modal>
        )}
      </AppAlertProvider>
      </SessionProvider>
      </HeroUINativeProvider>
      </KeyboardProvider>
      </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
