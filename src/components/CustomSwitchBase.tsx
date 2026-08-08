import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';

interface CustomSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

const SWITCH_WIDTH = 50;
const SWITCH_HEIGHT = 28;
const THUMB_SIZE = 24;

export default function CustomSwitch({ value, onValueChange, disabled }: CustomSwitchProps) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.set(withSpring(value ? 1 : 0, {
      mass: 1,
      damping: 18,
      stiffness: 150,
      overshootClamping: false,
    }));
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.get(),
      [0, 1],
      ['#3A3A3C', '#0A84FF']
    );
    return { backgroundColor };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const translateX = progress.get() * (SWITCH_WIDTH - THUMB_SIZE - 4);
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <Pressable
      onPress={() => {
        if (!disabled) onValueChange(!value);
      }}
      style={[
        styles.container,
        disabled && styles.disabled,
        Platform.OS === 'web' && { cursor: disabled ? 'not-allowed' : 'pointer' } as any,
      ]}
    >
      <Animated.View 
        style={[
          styles.track, 
          trackStyle,
          Platform.OS === 'web' && value && !disabled ? styles.glowEffect : null
        ]}
      >
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  track: {
    width: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    borderRadius: SWITCH_HEIGHT / 2,
    padding: 2,
  },
  glowEffect: {
    ...Platform.select({
      web: {
        boxShadow: '0 0 12px rgba(10, 132, 255, 0.5)'
      }
    })
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: '#FFFFFF',
    borderRadius: THUMB_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  disabled: {
    opacity: 0.4,
  },
});
