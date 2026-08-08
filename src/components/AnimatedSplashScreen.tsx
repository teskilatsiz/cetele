import { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { View } from 'react-native';
import Svg, { Line, G } from 'react-native-svg';
import { useAppTheme } from '@/lib/theme';

const AnimatedLine = Animated.createAnimatedComponent(Line);

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
}

export function AnimatedSplashScreen({ onAnimationComplete }: AnimatedSplashScreenProps) {
  const { colors } = useAppTheme();
  const line1Progress = useSharedValue(0);
  const line2Progress = useSharedValue(0);
  const line3Progress = useSharedValue(0);
  const line4Progress = useSharedValue(0);
  const line5Progress = useSharedValue(0);
  const crossLineProgress = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const logoScale = useSharedValue(0.8);

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const triggerCompleteHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  useEffect(() => {

    logoScale.set(withSpring(1, {
      damping: 12,
      stiffness: 100,
    }));

    const lineHeight = 24;
    const springConfig = { damping: 14, stiffness: 120, mass: 0.8 };

    line1Progress.set(withDelay(100, withSpring(lineHeight, springConfig)));
    line2Progress.set(withDelay(180, withSpring(lineHeight, springConfig)));
    line3Progress.set(withDelay(260, withSpring(lineHeight, springConfig)));
    line4Progress.set(withDelay(340, withSpring(lineHeight, springConfig)));
    line5Progress.set(withDelay(420, withSpring(lineHeight, springConfig)));

    crossLineProgress.set(withDelay(
      700,
      withSpring(1, { damping: 14, stiffness: 100, mass: 0.6 })
    ));

    setTimeout(() => {
      runOnJS(triggerHaptic)();
    }, 900);

    setTimeout(() => {
      runOnJS(triggerCompleteHaptic)();
      containerOpacity.set(withTiming(0, {
        duration: 350,
        easing: Easing.out(Easing.ease),
      }, (finished) => {
        if (finished) {
          runOnJS(onAnimationComplete)();
        }
      }));
    }, 1600);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.get(),
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.get() }],
  }));

  const line1AnimatedProps = useAnimatedProps(() => ({
    y2: interpolate(line1Progress.get(), [0, 24], [12, 36], Extrapolation.CLAMP),
  }));

  const line2AnimatedProps = useAnimatedProps(() => ({
    y2: interpolate(line2Progress.get(), [0, 24], [12, 36], Extrapolation.CLAMP),
  }));

  const line3AnimatedProps = useAnimatedProps(() => ({
    y2: interpolate(line3Progress.get(), [0, 24], [12, 36], Extrapolation.CLAMP),
  }));

  const line4AnimatedProps = useAnimatedProps(() => ({
    y2: interpolate(line4Progress.get(), [0, 24], [12, 36], Extrapolation.CLAMP),
  }));

  const line5AnimatedProps = useAnimatedProps(() => ({
    y2: interpolate(line5Progress.get(), [0, 24], [12, 36], Extrapolation.CLAMP),
  }));

  const crossLineAnimatedProps = useAnimatedProps(() => ({
    x1: interpolate(crossLineProgress.get(), [0, 1], [24, 4], Extrapolation.CLAMP),
    x2: interpolate(crossLineProgress.get(), [0, 1], [24, 44], Extrapolation.CLAMP),
    opacity: interpolate(crossLineProgress.get(), [0, 0.1, 1], [0, 0.3, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={[styles.gradient, { backgroundColor: colors.background }]}>
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <Svg width={160} height={160} viewBox="0 0 48 48">
            <G>
              <AnimatedLine
                x1="8" y1="12" x2="8"
                y2="12"
                animatedProps={line1AnimatedProps}
                stroke={colors.accent}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <AnimatedLine
                x1="16" y1="12" x2="16"
                y2="12"
                animatedProps={line2AnimatedProps}
                stroke={colors.accent}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <AnimatedLine
                x1="24" y1="12" x2="24"
                y2="12"
                animatedProps={line3AnimatedProps}
                stroke={colors.accent}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <AnimatedLine
                x1="32" y1="12" x2="32"
                y2="12"
                animatedProps={line4AnimatedProps}
                stroke={colors.accent}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <AnimatedLine
                x1="40" y1="12" x2="40"
                y2="12"
                animatedProps={line5AnimatedProps}
                stroke={colors.accent}
                strokeWidth={3}
                strokeLinecap="round"
              />

              <AnimatedLine
                x1="24"
                y1="20"
                x2="24"
                y2="28"
                animatedProps={crossLineAnimatedProps}
                stroke={colors.accent}
                strokeWidth={3.5}
                strokeLinecap="round"
                opacity={0}
              />
            </G>
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
