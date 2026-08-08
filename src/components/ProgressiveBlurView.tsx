import type { RefObject } from 'react';
import {
  Platform,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView, type BlurTint } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

interface ProgressiveBlurViewProps {
  intensity?: number;
  tint: BlurTint;
  blurTarget?: RefObject<View | null>;
  direction?: 'top' | 'bottom';
  fallbackColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressiveBlurView({
  intensity = 24,
  tint,
  blurTarget,
  direction = 'top',
  fallbackColor = 'transparent',
  style,
}: ProgressiveBlurViewProps) {
  const maskColors = direction === 'top'
    ? [
        'rgba(0,0,0,1)',
        'rgba(0,0,0,0.98)',
        'rgba(0,0,0,0.86)',
        'rgba(0,0,0,0.62)',
        'rgba(0,0,0,0.28)',
        'rgba(0,0,0,0)',
      ] as const
    : [
        'rgba(0,0,0,0)',
        'rgba(0,0,0,0.28)',
        'rgba(0,0,0,0.62)',
        'rgba(0,0,0,0.86)',
        'rgba(0,0,0,0.98)',
        'rgba(0,0,0,1)',
      ] as const;
  const overlayColors = direction === 'top'
    ? [colorWithAlpha(fallbackColor, 0.98), colorWithAlpha(fallbackColor, 0.48), colorWithAlpha(fallbackColor, 0)] as const
    : [colorWithAlpha(fallbackColor, 0), colorWithAlpha(fallbackColor, 0.48), colorWithAlpha(fallbackColor, 0.98)] as const;
  const resolvedTint: BlurTint = Platform.OS === 'ios'
    ? tint === 'light'
      ? 'systemChromeMaterialLight'
      : tint === 'dark'
        ? 'systemChromeMaterialDark'
        : tint
    : tint;
  const webMaskStyle = Platform.OS === 'web'
    ? ({
        WebkitMaskImage: direction === 'top'
          ? 'linear-gradient(to bottom, #000 0%, rgba(0,0,0,.98) 35%, rgba(0,0,0,.62) 72%, transparent 100%)'
          : 'linear-gradient(to top, #000 0%, rgba(0,0,0,.98) 35%, rgba(0,0,0,.62) 72%, transparent 100%)',
        maskImage: direction === 'top'
          ? 'linear-gradient(to bottom, #000 0%, rgba(0,0,0,.98) 35%, rgba(0,0,0,.62) 72%, transparent 100%)'
          : 'linear-gradient(to top, #000 0%, rgba(0,0,0,.98) 35%, rgba(0,0,0,.62) 72%, transparent 100%)',
      } as ViewStyle)
    : undefined;

  const blur = (
    <BlurView
      intensity={intensity}
      tint={resolvedTint}
      blurTarget={blurTarget}
      blurMethod={Platform.OS === 'android' && blurTarget ? 'dimezisBlurViewSdk31Plus' : 'none'}
      blurReductionFactor={2}
      style={StyleSheet.absoluteFill}
    />
  );

  if (Platform.OS === 'web') {
    return (
      <View pointerEvents="none" style={[styles.container, style, webMaskStyle]}>
        <LinearGradient
          colors={overlayColors}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
        {blur}
      </View>
    );
  }

  return (
    <MaskedView
      pointerEvents="none"
      style={[styles.container, style]}
      maskElement={(
        <LinearGradient
          colors={maskColors}
          locations={[0, 0.35, 0.55, 0.72, 0.86, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    >
      <LinearGradient
        colors={overlayColors}
        locations={[0, 0.58, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {blur}
    </MaskedView>
  );
}

function colorWithAlpha(color: string, alpha: number) {
  const hex = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (hex) {
    return `rgba(${parseInt(hex[1], 16)},${parseInt(hex[2], 16)},${parseInt(hex[3], 16)},${alpha})`;
  }

  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${alpha})`;
  }

  return color;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
});
