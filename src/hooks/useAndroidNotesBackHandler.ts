import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

export function useAndroidNotesBackHandler(onBeforeBack?: () => void) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onBeforeBack?.();
        router.dismissTo('/(tabs)');
        return true;
      });

      return () => subscription.remove();
    }, [onBeforeBack])
  );
}
