import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, G } from 'react-native-svg';

const AnimatedLine = Animated.createAnimatedComponent(Line);

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
}

export function AnimatedSplashScreen({ onAnimationComplete }: AnimatedSplashScreenProps) {
  const line1Anim = useRef(new Animated.Value(0)).current;
  const line2Anim = useRef(new Animated.Value(0)).current;
  const line3Anim = useRef(new Animated.Value(0)).current;
  const line4Anim = useRef(new Animated.Value(0)).current;
  const line5Anim = useRef(new Animated.Value(0)).current;
  const crossLineAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const lineHeight = 24;

    const createLineAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.spring(animValue, {
          toValue: lineHeight,
          friction: 8,
          tension: 40,
          useNativeDriver: false,
        }),
      ]);
    };

    Animated.parallel([
      createLineAnimation(line1Anim, 0),
      createLineAnimation(line2Anim, 100),
      createLineAnimation(line3Anim, 200),
      createLineAnimation(line4Anim, 300),
      createLineAnimation(line5Anim, 400),
    ]).start(() => {
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(crossLineAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: false,
        }),
        Animated.delay(600),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimationComplete();
      });
    });
  }, []);

  const crossLineOpacity = crossLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const crossLineTranslateX = crossLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 0],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={['#000000', '#0A0A0A', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        <View style={styles.logoContainer}>
          <Svg width={160} height={160} viewBox="0 0 48 48">
            <G>
              <AnimatedLine
                x1="8"
                y1="12"
                x2="8"
                y2={line1Anim.interpolate({
                  inputRange: [0, 24],
                  outputRange: [12, 36],
                })}
                stroke="#0A84FF"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <AnimatedLine
                x1="16"
                y1="12"
                x2="16"
                y2={line2Anim.interpolate({
                  inputRange: [0, 24],
                  outputRange: [12, 36],
                })}
                stroke="#0A84FF"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <AnimatedLine
                x1="24"
                y1="12"
                x2="24"
                y2={line3Anim.interpolate({
                  inputRange: [0, 24],
                  outputRange: [12, 36],
                })}
                stroke="#0A84FF"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <AnimatedLine
                x1="32"
                y1="12"
                x2="32"
                y2={line4Anim.interpolate({
                  inputRange: [0, 24],
                  outputRange: [12, 36],
                })}
                stroke="#0A84FF"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <AnimatedLine
                x1="40"
                y1="12"
                x2="40"
                y2={line5Anim.interpolate({
                  inputRange: [0, 24],
                  outputRange: [12, 36],
                })}
                stroke="#0A84FF"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <AnimatedLine
                x1={crossLineTranslateX.interpolate({
                  inputRange: [-40, 0],
                  outputRange: [0, 4],
                })}
                y1="20"
                x2={crossLineTranslateX.interpolate({
                  inputRange: [-40, 0],
                  outputRange: [0, 44],
                })}
                y2="28"
                stroke="#0A84FF"
                strokeWidth={3.5}
                strokeLinecap="round"
                opacity={crossLineOpacity}
              />
            </G>
          </Svg>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
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
