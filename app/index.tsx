import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Redirect } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { CeteleLogo } from '@/components/CeteleLogo';
import { nostrService } from '@/lib/nostr';

export default function WelcomeScreen() {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
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
  }, []);

  const checkAuth = async () => {
    try {
      const session = await nostrService.restoreSession();
      if (session) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleGetStarted = () => {
    router.push('/(tabs)/settings');
  };

  if (!isChecking && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#000000', '#0A0A0A', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}>
            <View style={styles.iconContainer}>
              <View style={styles.iconBackground}>
                <CeteleLogo size={56} color="#0A84FF" strokeWidth={3} />
              </View>
            </View>

            <Text style={styles.title}>Çetele</Text>
            <Text style={styles.description}>
              Nostr protokolü ile şifrelenmiş notlarınızı güvenle saklayın ve paylaşın
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.footer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}>
          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.8}
            onPress={handleGetStarted}
            disabled={isChecking}>
            <LinearGradient
              colors={['#0A84FF', '#0A84FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}>
              <Text style={styles.buttonText}>Başla</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Gizliliğiniz bizim için önemlidir. Hiçbir veri sunucuda saklanmaz.
          </Text>
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
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
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
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -1,
  },
  description: {
    fontSize: 18,
    color: '#AEAEB2',
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
    color: '#636366',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
});
