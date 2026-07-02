import React from 'react';
import { StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Plus } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useAppTheme } from '@/lib/theme';

export function FloatingNewButton() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const bottomOffset = Platform.select({
    ios: 90 + insets.bottom,
    android: 16,
    default: 24,
  });

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/new');
  };

  return (
    <Animated.View 
      entering={FadeInUp.springify().damping(20).stiffness(200)}
      exiting={FadeOutDown}
      style={[
        styles.container, 
        { bottom: bottomOffset }
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.touchable, { backgroundColor: colors.accent }]}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    zIndex: 999,
  },
  touchable: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
