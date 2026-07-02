import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaBox } from '@/components/SafeAreaBox';
import { useAppTheme } from '@/lib/theme';
import { nostrService } from '@/lib/nostr';
import { useI18n } from '@/lib/i18n';

const RESULT_PREFIX = 'cetele:nip55:result:';
const PENDING_PREFIX = 'cetele:nip55:pending:';
const LOGIN_FALLBACK_KEY = 'cetele:nip55:login';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function SignerCallbackScreen() {
  const params = useLocalSearchParams<{
    requestId?: string | string[];
    result?: string | string[];
    event?: string | string[];
    error?: string | string[];
    rejected?: string | string[];
  }>();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/');
      return;
    }

    const requestId = firstParam(params.requestId);
    const value = firstParam(params.event) || firstParam(params.result);
    const rejected = firstParam(params.rejected) === 'true';
    const callbackError = firstParam(params.error);

    if (!requestId) {
      // The callback result is synchronized from URL parameters.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessage(t('settings.androidCallbackInvalid'));
      return;
    }

    const pendingType = window.localStorage.getItem(`${PENDING_PREFIX}${requestId}`);
    const error = rejected ? t('settings.androidCallbackRejected') : callbackError;
    window.localStorage.setItem(
      `${RESULT_PREFIX}${requestId}`,
      JSON.stringify({ value, error })
    );

    if (pendingType === 'login' && value && /^[0-9a-f]{64}$/i.test(value)) {
      window.localStorage.setItem(LOGIN_FALLBACK_KEY, value);
      void nostrService.acceptAndroidSignerCallback(value).catch(() => undefined);
    }

    setMessage(error ? error : t('settings.androidCallbackReady'));
  }, [params.error, params.event, params.rejected, params.requestId, params.result, t]);

  const returnToApp = () => {
    if (Platform.OS === 'web' && window.opener) {
      window.close();
      return;
    }
    if (Platform.OS === 'web' && window.history.length > 1) {
      window.history.back();
      return;
    }
    router.replace('/(tabs)/settings');
  };

  return (
    <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.androidCallbackTitle')}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message || t('settings.androidCallbackProcessing')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={returnToApp}
          style={[styles.button, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.buttonText}>{t('settings.returnToCetele')}</Text>
        </Pressable>
      </View>
    </SafeAreaBox>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
