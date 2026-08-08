import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaBox } from '@/components/SafeAreaBox';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Redirect } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { CeteleLogo } from '@/components/CeteleLogo';
import { nostrService } from '@/lib/nostr';
import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

export default function WelcomeScreen() {
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const mountedRef = useRef(true);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const checkAuth = useCallback(async () => {
    try {
      const session = await nostrService.restoreSession();
      if (!mountedRef.current) return;
      if (session) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkAuth();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
    return () => {
      mountedRef.current = false;
      fadeAnim.stopAnimation();
      slideAnim.stopAnimation();
    };
  }, [checkAuth, fadeAnim, slideAnim]);

  const handleGetStarted = () => {
    router.push('/(tabs)/settings');
  };

  if (!isChecking && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.background, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.header,
              isDesktop && styles.desktopHeader,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}>
            <View style={[styles.iconContainer, isDesktop && styles.desktopIconContainer]}>
              <View style={[styles.iconBackground, isDesktop && styles.desktopIconBackground, { backgroundColor: scheme === 'dark' ? 'rgba(10, 132, 255, 0.15)' : 'rgba(10, 132, 255, 0.1)' }]}>
                <CeteleLogo size={isDesktop ? 80 : 56} color="#0A84FF" strokeWidth={3} />
              </View>
            </View>

            <Text style={[styles.title, isDesktop && styles.desktopTitle, { color: colors.text }]}>{t('welcome.title')}</Text>
            <Text style={[styles.description, isDesktop && styles.desktopDescription, { color: colors.textSecondary }]}>
              {t('welcome.description')}
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.footer,
            isDesktop && styles.desktopFooter,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}>
          <TouchableOpacity
            style={[styles.ctaButton, isDesktop && styles.desktopCtaButton]}
            activeOpacity={0.8}
            onPress={handleGetStarted}
            disabled={isChecking}>
            <LinearGradient
              colors={['#0A84FF', '#0A84FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}>
              <Text style={styles.buttonText}>{t('welcome.start')}</Text>
              <ArrowRight size={isDesktop ? 22 : 18} color="#FFFFFF" strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.disclaimer, isDesktop && styles.desktopDisclaimer, { color: colors.textSecondary }]}>
            {t('welcome.disclaimer')}
          </Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        borderCurve: 'continuous' as any,
      },
    }),
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: -1,
  },
  description: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: -0.2,
    maxWidth: 320,
  },
  footer: {
    marginBottom: 40,
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  buttonGradient: {
    flexDirection: 'row',
    paddingVertical: 18,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  disclaimer: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  desktopHeader: {
    maxWidth: 800,
  },
  desktopIconContainer: {
    marginBottom: 40,
  },
  desktopIconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  desktopTitle: {
    fontSize: 72,
    marginBottom: 24,
  },
  desktopDescription: {
    fontSize: 24,
    maxWidth: 600,
    lineHeight: 34,
  },
  desktopFooter: {
    alignItems: 'center',
    marginBottom: 60,
  },
  desktopCtaButton: {
    width: 300,
  },
  desktopDisclaimer: {
    fontSize: 15,
  },
});
