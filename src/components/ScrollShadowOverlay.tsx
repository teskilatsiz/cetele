import { useCallback, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/lib/theme';


interface ScrollShadowState {
  top: boolean;
  bottom: boolean;
}

interface ScrollShadowOptions {
  offset?: number;
}

interface ScrollShadowOverlayProps extends ScrollShadowState {
  size?: number;
  topOffset?: number;
  bottomOffset?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

function colorWithOpacity(color: string, opacity: number) {
  if (color.startsWith('#') && color.length === 7) {
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    return `rgba(${red},${green},${blue},${opacity})`;
  }

  return color;
}

export function useScrollShadow({ offset = 0 }: ScrollShadowOptions = {}) {
  const [shadows, setShadows] = useState<ScrollShadowState>({
    top: false,
    bottom: false,
  });

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const maxScrollY = Math.max(contentSize.height - layoutMeasurement.height, 0);
      const nextTop = contentOffset.y > offset;
      const nextBottom = contentOffset.y < maxScrollY - offset;

      setShadows((previous) => {
        if (previous.top === nextTop && previous.bottom === nextBottom) {
          return previous;
        }

        return {
          top: nextTop,
          bottom: nextBottom,
        };
      });
    },
    [offset]
  );

  return { shadows, onScroll };
}

export function ScrollShadowOverlay({
  top,
  bottom,
  size = 48,
  topOffset = 0,
  bottomOffset = 0,
  color,
  style,
}: ScrollShadowOverlayProps) {
  const { colors, scheme } = useAppTheme();
  const shadowColor = color || colors.background;
  const opaque = colorWithOpacity(shadowColor, scheme === 'light' ? 0.92 : 0.8);
  const medium = colorWithOpacity(shadowColor, scheme === 'light' ? 0.46 : 0.38);
  const soft = colorWithOpacity(shadowColor, scheme === 'light' ? 0.14 : 0.12);
  const transparent = colorWithOpacity(shadowColor, 0);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.container, style]}>
      {top && (
        <LinearGradient
          pointerEvents="none"
          colors={[opaque, medium, soft, transparent]}
          locations={[0, 0.22, 0.56, 1]}
          style={[styles.shadow, { top: topOffset, height: size }]}
        />
      )}

      {bottom && (
        <LinearGradient
          pointerEvents="none"
          colors={[transparent, soft, medium, opaque]}
          locations={[0, 0.44, 0.78, 1]}
          style={[styles.shadow, { bottom: bottomOffset, height: size }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 90,
    elevation: 90,
  },
  shadow: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
