import { useEffect, useState, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { biometricAuthService } from '@/lib/biometric-auth';
import { nostrService } from '@/lib/nostr';
import { BiometricLockScreen } from '@/components/BiometricLockScreen';
import { AnimatedSplashScreen } from '@/components/AnimatedSplashScreen';

SplashScreen.preventAutoHideAsync();

SplashScreen.setOptions({
  duration: 400,
  fade: true,
});

export default function RootLayout() {
  useFrameworkReady();

  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const appState = useRef(AppState.currentState);
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    checkInitialAuth();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
      }
    };
  }, [isAuthenticated]);

  const checkInitialAuth = async () => {
    const session = await nostrService.restoreSession();
    const authenticated = session !== null;
    setIsAuthenticated(authenticated);

    if (authenticated && Platform.OS !== 'web') {
      const shouldLock = await biometricAuthService.shouldShowLockScreen();
      if (shouldLock) {
        setIsLocked(true);
      }
    }

    await SplashScreen.hideAsync();
  };

  const handleAnimationComplete = () => {
    setShowAnimatedSplash(false);
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (!isAuthenticated) return;

    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      const shouldLock = await biometricAuthService.shouldShowLockScreen();
      if (shouldLock) {
        setIsLocked(true);
      }
    }

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
      }

      lockTimeoutRef.current = setTimeout(async () => {
        const shouldLock = await biometricAuthService.shouldShowLockScreen();
        if (shouldLock) {
          setIsLocked(true);
        }
      }, 100);
    }

    appState.current = nextAppState;
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  if (showAnimatedSplash) {
    return <AnimatedSplashScreen onAnimationComplete={handleAnimationComplete} />;
  }

  if (isLocked && Platform.OS !== 'web') {
    return <BiometricLockScreen onUnlock={handleUnlock} />;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'fade',
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="note/[id]" />
        <Stack.Screen name="edit/[id]" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="technical-documentation" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
