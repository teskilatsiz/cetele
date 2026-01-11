import { View, StyleSheet } from 'react-native';
import Svg, { Line, G } from 'react-native-svg';

interface CeteleLogoProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function CeteleLogo({ size = 48, color = '#0A84FF', strokeWidth = 3 }: CeteleLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <G>
          <Line x1="8" y1="12" x2="8" y2="36" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="16" y1="12" x2="16" y2="36" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="24" y1="12" x2="24" y2="36" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="32" y1="12" x2="32" y2="36" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="40" y1="12" x2="40" y2="36" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1="4" y1="20" x2="44" y2="28" stroke={color} strokeWidth={strokeWidth + 0.5} strokeLinecap="round" />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
