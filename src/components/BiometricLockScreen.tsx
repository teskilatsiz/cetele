import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaBox } from '@/components/SafeAreaBox';
import { LinearGradient } from 'expo-linear-gradient';
import { ScanFace } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { biometricAuthService } from '@/lib/biometric-auth';
import { CeteleLogo } from '@/components/CeteleLogo';
import { t } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

interface BiometricLockScreenProps {
  onUnlock: () => void;
  onAuthenticatingChange?: (active: boolean) => void;
}

type StatusType = 'idle' | 'authenticating' | 'success' | 'failed';

export function BiometricLockScreen({ onUnlock, onAuthenticatingChange }: BiometricLockScreenProps) {
  const { colors, scheme } = useAppTheme();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusType>('idle');

  const [fadeAnim] = useState(new Animated.Value(0));
  const [shakeAnim] = useState(new Animated.Value(0));

  const [islandScale] = useState(() => new Animated.Value(0));
  const [islandOpacity] = useState(() => new Animated.Value(0));
  const [iconScale] = useState(() => new Animated.Value(0));
  const [checkmarkRotate] = useState(() => new Animated.Value(0));
  const authenticatingRef = useRef(false);
  const mountedRef = useRef(true);
  const autoAuthTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showDynamicIsland = (statusType: StatusType) => {
    setStatus(statusType);

    islandScale.setValue(0);
    islandOpacity.setValue(0);
    iconScale.setValue(0);

    Animated.parallel([
      Animated.spring(islandScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(islandOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(iconScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    if (statusType === 'success') {
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(checkmarkRotate, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        hideDynamicIsland();
      }, 2000);
    } else if (statusType === 'failed') {
      setTimeout(() => {
        hideDynamicIsland();
      }, 2500);
    }
  };

  const hideDynamicIsland = () => {
    Animated.parallel([
      Animated.timing(islandScale, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(islandOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStatus('idle');
      checkmarkRotate.setValue(0);
    });
  };

  const handleBiometricAuth = async () => {
    if (Platform.OS === 'web') return;
    if (authenticatingRef.current || loading) return;

    authenticatingRef.current = true;
    onAuthenticatingChange?.(true);
    setLoading(true);
    setError('');
    showDynamicIsland('authenticating');

    try {
      const result = await biometricAuthService.authenticate(t('biometric.cetelePrompt'));
      if (!mountedRef.current) return;
      if (result.success) {
        showDynamicIsland('success');
        onAuthenticatingChange?.(false);
        onUnlock();
      } else {
        onAuthenticatingChange?.(false);
        setError(result.error || t('biometric.failed'));
        showDynamicIsland('failed');
        shakeAnimation();
      }
    } catch (error) {
      console.error('Biometric auth error:', error);
      if (!mountedRef.current) return;
      onAuthenticatingChange?.(false);
      setError(t('biometric.unavailable'));
      showDynamicIsland('failed');
      shakeAnimation();
    } finally {
      authenticatingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    autoAuthTimerRef.current = setTimeout(() => {
      void handleBiometricAuth();
    }, 500);

    return () => {
      mountedRef.current = false;
      onAuthenticatingChange?.(false);
      if (autoAuthTimerRef.current) clearTimeout(autoAuthTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getIslandBackgroundColor = () => {
    switch (status) {
      case 'success':
        return colors.accent;
      case 'failed':
        return colors.destructive;
      case 'authenticating':
        return colors.accent;
      default:
        return colors.elevated;
    }
  };

  const getIslandText = () => {
    switch (status) {
      case 'authenticating':
        return t('biometric.authenticating');
      case 'success':
        return t('biometric.authenticated');
      case 'failed':
        return t('biometric.failed');
      default:
        return '';
    }
  };

  const rotateInterpolate = checkmarkRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <LinearGradient
        colors={scheme === 'light' ? [colors.background, colors.elevatedMuted] : [colors.background, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        <Animated.View
          style={[
            styles.dynamicIsland,
            {
              backgroundColor: getIslandBackgroundColor(),
              opacity: islandOpacity,
              transform: [{ scale: islandScale }],
            },
          ]}>
          <BlurView intensity={40} tint={colors.blurTint} style={styles.islandBlur}>
            {status === 'authenticating' && (
              <Animated.View style={[styles.islandContent, { transform: [{ scale: iconScale }] }]}>
                <ScanFace size={24} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.islandText}>{getIslandText()}</Text>
              </Animated.View>
            )}

            {status === 'success' && (
              <Animated.View style={[styles.islandContent, { transform: [{ scale: iconScale }] }]}>
                <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={24}
                    color="#FFFFFF"
                  />
                </Animated.View>
                <Text style={styles.islandText}>{getIslandText()}</Text>
              </Animated.View>
            )}

            {status === 'failed' && (
              <Animated.View style={[styles.islandContent, { transform: [{ scale: iconScale }] }]}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.islandText}>{getIslandText()}</Text>
              </Animated.View>
            )}
          </BlurView>
        </Animated.View>

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateX: shakeAnim }],
            },
          ]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => {
            if (status === 'idle' || status === 'failed') {
              void handleBiometricAuth();
            }
          }}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconBackground, { backgroundColor: colors.iconBackground }]}>
              <CeteleLogo size={56} color={colors.accent} strokeWidth={3} />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Çetele</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('biometric.required')}</Text>

          <View style={styles.authContainer}>
            <View style={styles.authIcon}>
              <ScanFace size={64} color={colors.accent} strokeWidth={1.5} />
            </View>

            {status !== 'success' && (
              <TouchableOpacity
                style={styles.authButton}
                onPress={handleBiometricAuth}
                disabled={loading}
                activeOpacity={0.8}>
                <BlurView
                  intensity={30}
                  tint={colors.blurTint}
                  style={[styles.buttonBlur, { backgroundColor: colors.iconBackground, borderColor: colors.border }]}
                >
                  <Text style={[styles.authButtonText, { color: colors.accent }]}>
                    {loading ? t('biometric.authenticating') : t('biometric.authenticate')}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            )}

            {error ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            ) : null}
          </View>
        </Animated.View>
      </LinearGradient>
    </SafeAreaBox>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dynamicIsland: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 14 : 20,
    alignSelf: 'center',
    minWidth: 150,
    height: 37,
    borderRadius: 40,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  islandBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  islandContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  islandText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: '#8E8E93',
    marginBottom: 48,
    letterSpacing: -0.2,
  },
  authContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  authIcon: {
    marginBottom: 16,
  },
  authButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonBlur: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  authButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A84FF',
    letterSpacing: -0.2,
  },
  errorText: {
    fontSize: 14,
    color: '#FF453A',
    textAlign: 'center',
    fontWeight: '600',
  },
});
