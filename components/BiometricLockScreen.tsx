import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { biometricAuthService, type AuthType } from '@/lib/biometric-auth';
import { CeteleLogo } from '@/components/CeteleLogo';

interface BiometricLockScreenProps {
  onUnlock: () => void;
}

type StatusType = 'idle' | 'authenticating' | 'success' | 'failed';

export function BiometricLockScreen({ onUnlock }: BiometricLockScreenProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusType>('idle');
  const [authType, setAuthType] = useState<AuthType | null>(null);

  const [fadeAnim] = useState(new Animated.Value(0));
  const [shakeAnim] = useState(new Animated.Value(0));

  const islandScale = useRef(new Animated.Value(0)).current;
  const islandOpacity = useRef(new Animated.Value(0)).current;
  const islandWidth = useRef(new Animated.Value(120)).current;
  const islandHeight = useRef(new Animated.Value(37)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const checkmarkRotate = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: () => {
        if (status === 'idle' || status === 'failed') {
          handleDeviceAuth();
        }
      },
    })
  ).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      handleDeviceAuth();
    }, 500);
  }, []);

  const showDynamicIsland = (statusType: StatusType, type?: AuthType) => {
    setStatus(statusType);
    if (type) setAuthType(type);

    islandScale.setValue(0);
    islandOpacity.setValue(0);
    iconScale.setValue(0);

    const bgColor = statusType === 'success' ? '#34C759' : statusType === 'failed' ? '#FF453A' : '#1C1C1E';

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
      setAuthType(null);
      checkmarkRotate.setValue(0);
    });
  };

  const handleDeviceAuth = async () => {
    if (Platform.OS === 'web') return;

    setLoading(true);
    setError('');
    showDynamicIsland('authenticating');

    try {
      const result = await biometricAuthService.authenticate('Kilidi açmak için doğrulayın');
      if (result.success) {
        showDynamicIsland('success', result.authType);
        setTimeout(() => {
          onUnlock();
        }, 1500);
      } else {
        setError(result.error || 'Kimlik doğrulama başarısız');
        showDynamicIsland('failed');
        shakeAnimation();
      }
    } catch (error) {
      console.error('Device auth error:', error);
      setError('Doğrulama hatası');
      showDynamicIsland('failed');
      shakeAnimation();
    } finally {
      setLoading(false);
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

  const getIslandBackgroundColor = () => {
    switch (status) {
      case 'success':
        return '#34C759';
      case 'failed':
        return '#FF453A';
      case 'authenticating':
        return '#0A84FF';
      default:
        return '#1C1C1E';
    }
  };

  const getIslandText = () => {
    switch (status) {
      case 'authenticating':
        return 'Doğrulanıyor...';
      case 'success':
        if (authType === 'face') return 'Yüz Tanındı';
        if (authType === 'fingerprint') return 'Parmak İzi Tanındı';
        return 'Doğrulandı';
      case 'failed':
        return 'Başarısız';
      default:
        return '';
    }
  };

  const rotateInterpolate = checkmarkRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#000000', '#0A0A0A', '#000000']}
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
          <BlurView intensity={40} tint="dark" style={styles.islandBlur}>
            {status === 'authenticating' && (
              <Animated.View style={[styles.islandContent, { transform: [{ scale: iconScale }] }]}>
                <MaterialCommunityIcons
                  name="face-recognition"
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.islandText}>{getIslandText()}</Text>
              </Animated.View>
            )}

            {status === 'success' && (
              <Animated.View style={[styles.islandContent, { transform: [{ scale: iconScale }] }]}>
                <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                  {authType === 'face' ? (
                    <MaterialCommunityIcons
                      name="face-recognition"
                      size={24}
                      color="#FFFFFF"
                    />
                  ) : authType === 'fingerprint' ? (
                    <MaterialCommunityIcons
                      name="fingerprint"
                      size={24}
                      color="#FFFFFF"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color="#FFFFFF"
                    />
                  )}
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
          {...panResponder.panHandlers}>
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <CeteleLogo size={56} color="#0A84FF" strokeWidth={3} />
            </View>
          </View>

          <Text style={styles.title}>Çetele</Text>
          <Text style={styles.subtitle}>Uygulama Kilitli</Text>

          <View style={styles.authContainer}>
            <View style={styles.authIcon}>
              <Lock size={64} color="#0A84FF" strokeWidth={2} />
            </View>

            <TouchableOpacity
              style={styles.authButton}
              onPress={handleDeviceAuth}
              disabled={loading}
              activeOpacity={0.8}>
              <BlurView intensity={30} tint="dark" style={styles.buttonBlur}>
                <Text style={styles.authButtonText}>
                  {loading ? 'Doğrulanıyor...' : 'Kilidi Aç'}
                </Text>
              </BlurView>
            </TouchableOpacity>

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </View>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
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
