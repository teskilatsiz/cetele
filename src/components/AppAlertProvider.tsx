import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { t } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

export interface AppAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AppAlertConfig {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
  options?: {
    cancelable?: boolean;
    link?: string;
  };
}

let presentAlert: ((config: AppAlertConfig) => void) | null = null;

export function showAppAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  options?: AppAlertConfig['options']
) {
  const normalizedButtons = buttons?.length ? buttons : [{ text: t('common.ok') }];

  if (Platform.OS === 'ios') {
    Alert.alert(title, message, normalizedButtons, options);
    return;
  }

  if (presentAlert) {
    presentAlert({ title, message, buttons: normalizedButtons, options });
    return;
  }

  if (Platform.OS === 'web') {
    const body = [title, message].filter(Boolean).join('\n\n');
    if (normalizedButtons.length > 1 && typeof globalThis.confirm === 'function') {
      const confirmed = globalThis.confirm(body);
      const nextButton = confirmed
        ? normalizedButtons.find((button) => button.style !== 'cancel') || normalizedButtons[0]
        : normalizedButtons.find((button) => button.style === 'cancel');
      nextButton?.onPress?.();
      return;
    }
    globalThis.alert?.(body);
    normalizedButtons[0]?.onPress?.();
    return;
  }



  Alert.alert(title, message, normalizedButtons, options);
}

export function showAppConfirm({
  title,
  message,
  confirmText = 'Tamam',
  cancelText = 'Vazgeç',
  destructive = false,
}: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    showAppAlert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true }
    );
  });
}

export function AppAlertProvider({ children }: { children: ReactNode }) {
  const { colors, scheme } = useAppTheme();
  const [config, setConfig] = useState<AppAlertConfig | null>(null);
  const { width } = useWindowDimensions();
  const isCompact = width < 380;

  useEffect(() => {
    if (Platform.OS === 'ios') {
      return;
    }

    const nativeAlert = Alert.alert;
    presentAlert = setConfig;
    Alert.alert = ((title, message, buttons, options) => {
      setConfig({
        title: String(title),
        message,
        buttons: buttons as AppAlertButton[] | undefined,
        options,
      });
    }) as typeof Alert.alert;

    return () => {
      if (presentAlert === setConfig) {
        presentAlert = null;
      }
      Alert.alert = nativeAlert;
    };
  }, []);

  const buttons = useMemo(
    () => (config?.buttons?.length ? config.buttons : [{ text: t('common.ok') }]),
    [config?.buttons]
  );

  const closeWithButton = useCallback((button?: AppAlertButton) => {
    setConfig(null);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(
        button?.style === 'destructive'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );
      setTimeout(() => button?.onPress?.(), 80);
      return;
    }
    button?.onPress?.();
  }, []);

  const handleRequestClose = useCallback(() => {
    if (config?.options?.cancelable === false) return;
    const cancelButton = buttons.find((button) => button.style === 'cancel');
    closeWithButton(cancelButton);
  }, [buttons, closeWithButton, config?.options?.cancelable]);

  return (
    <>
      {children}
      {Platform.OS !== 'ios' && (
        <Modal
          visible={!!config}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        hardwareAccelerated
        onRequestClose={handleRequestClose}
        >
          <View
            style={[
              styles.overlay,
              Platform.OS === 'web' && styles.overlayWeb,
              Platform.OS === 'android' && styles.overlayAndroid,
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleRequestClose} />
            <View
              style={[
                styles.card,
                Platform.OS === 'web' && styles.cardWeb,
                Platform.OS === 'android' && styles.cardAndroid,
                isCompact && styles.cardCompact,
                {
                  backgroundColor: scheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
                  borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                }
              ]}
            >
              <BlurView intensity={26} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <View style={styles.content}>
                <Text style={[styles.title, Platform.OS === 'web' && styles.titleWeb, { color: colors.text }]}>
                  {config?.title}
                </Text>
                {!!config?.message && (
                  <Text style={[styles.message, Platform.OS === 'web' && styles.messageWeb, { color: colors.textSecondary }]}>
                    {config.message}
                  </Text>
                )}
                {!!config?.options?.link && (
                  <View style={styles.linkContainer}>
                    <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="middle">
                      {config.options.link}
                    </Text>
                  </View>
                )}
                <View style={[styles.actions, buttons.length > 2 && styles.actionsStacked]}>
                  {buttons.map((button, index) => (
                    <TouchableOpacity
                      key={`${button.text}-${index}`}
                      style={[
                        styles.button,
                        Platform.OS === 'web' && styles.buttonWeb,
                        button.style === 'cancel' && styles.cancelButton,
                        button.style === 'cancel' && { backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)' },
                        button.style === 'destructive' && styles.destructiveButton,
                        button.style === 'destructive' && { backgroundColor: scheme === 'dark' ? 'rgba(255,69,58,0.14)' : 'rgba(255,59,48,0.1)' },
                        buttons.length > 2 && styles.buttonStacked,
                      ]}
                      activeOpacity={0.78}
                      onPress={() => closeWithButton(button)}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          button.style === 'cancel' && styles.cancelText,
                          button.style === 'cancel' && { color: scheme === 'dark' ? '#FFFFFF' : '#000000' },
                          button.style === 'destructive' && styles.destructiveText,
                        ]}
                      >
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  overlayAndroid: {
    paddingHorizontal: 18,
  },
  overlayWeb: {
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  card: {
    width: '100%',
    maxWidth: 364,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(28,28,30,0.72)' : '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: { borderCurve: 'continuous' as any },
      android: { elevation: 22 },
    }),
  },
  cardAndroid: {
    maxWidth: 348,
    borderRadius: 22,
  },
  cardWeb: {
    maxWidth: 420,
    borderRadius: 22,
    ...Platform.select({
      web: {
        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
      } as any,
    }),
  },
  cardCompact: {
    borderRadius: 22,
  },
  content: {
    padding: Platform.OS === 'android' ? 20 : 22,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  titleWeb: {
    fontSize: 20,
  },
  message: {
    marginTop: 10,
    color: '#C7C7CC',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  messageWeb: {
    fontSize: 15,
    lineHeight: 22,
  },
  linkContainer: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.2)',
  },
  linkText: {
    color: '#0A84FF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  actionsStacked: {
    flexDirection: 'column-reverse',
  },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A84FF',
  },
  buttonWeb: {
    minHeight: 44,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      } as any,
    }),
  },
  buttonStacked: {
    width: '100%',
    flex: 0,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  destructiveButton: {
    backgroundColor: 'rgba(255,69,58,0.14)',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelText: {
    color: '#FFFFFF',
  },
  destructiveText: {
    color: '#FF453A',
  },
});
