import type { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme';

interface ScrollShadowHeaderProps {
  title: string;
  scrollY: SharedValue<number>;
  rightElement?: ReactNode;
  leftElement?: ReactNode;
  collapseThreshold?: number;
}

const LARGE_TITLE_HEIGHT = 64;
const COMPACT_HEADER_HEIGHT = 44;

export function ScrollShadowHeader({
  title,
  scrollY,
  rightElement,
  leftElement,
  collapseThreshold = 56,
}: ScrollShadowHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const compactHeight = insets.top + COMPACT_HEADER_HEIGHT;

  const headerBlurStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.get(),
      [8, collapseThreshold],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  const largeTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.get(),
      [0, collapseThreshold * 0.72],
      [1, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.get(),
      [0, collapseThreshold],
      [0, -18],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      scrollY.get(),
      [0, collapseThreshold],
      [1, 0.94],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  const compactTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.get(),
      [collapseThreshold * 0.55, collapseThreshold],
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.get(),
      [collapseThreshold * 0.55, collapseThreshold],
      [4, 0],
      Extrapolation.CLAMP
    );
    return { opacity, transform: [{ translateY }] };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      scrollY.get(),
      [collapseThreshold, collapseThreshold + 20],
      [0, 0.15],
      Extrapolation.CLAMP
    );
    return {
      shadowOpacity,
      elevation: interpolate(
        scrollY.get(),
        [collapseThreshold, collapseThreshold + 20],
        [0, 8],
        Extrapolation.CLAMP
      ),
    };
  });

  const borderStyle = useAnimatedStyle(() => {
    const borderOpacity = interpolate(
      scrollY.get(),
      [collapseThreshold * 0.8, collapseThreshold],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      borderBottomColor: colors.divider,
      borderBottomWidth: borderOpacity > 0.02 ? 0.5 : 0,
    };
  });

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <Animated.View
        style={[
          styles.compactHeader,
          { height: compactHeight, paddingTop: insets.top },
          { backgroundColor: colors.header, shadowColor: colors.shadow },
          shadowStyle,
          borderStyle,
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, headerBlurStyle]}>
          <BlurView
            intensity={80}
            tint={colors.blurTint}
            style={[StyleSheet.absoluteFill, styles.blurBackground, { backgroundColor: colors.header }]}
          />
        </Animated.View>

        <View style={styles.compactContent}>
          <View style={styles.leftSlot}>{leftElement}</View>

          <Animated.View style={[styles.compactTitleContainer, compactTitleStyle]}>
            <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
          </Animated.View>

          <View style={styles.rightSlot}>{rightElement}</View>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.largeTitleContainer,
          { top: compactHeight + 8 },
          largeTitleStyle,
        ]}
        pointerEvents="none"
      >
        <Text style={[styles.largeTitle, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86}>
          {title}
        </Text>
      </Animated.View>
    </View>
  );
}

export function useScrollShadow() {
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
    },
  });

  return { scrollY, scrollHandler };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  compactHeader: {
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  blurBackground: {},
  compactContent: {
    height: COMPACT_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  leftSlot: {
    width: 56,
    alignItems: 'flex-start',
  },
  rightSlot: {
    width: 56,
    alignItems: 'flex-end',
  },
  compactTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  compactTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  largeTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    height: LARGE_TITLE_HEIGHT,
    justifyContent: 'center',
  },
  largeTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});

export { LARGE_TITLE_HEIGHT, COMPACT_HEADER_HEIGHT };
