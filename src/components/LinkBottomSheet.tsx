import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { Link2 } from 'lucide-react-native';
import { SwipeableBottomSheet } from './SwipeableBottomSheet';
import * as Haptics from 'expo-haptics';
import { showAppAlert } from './AppAlertProvider';
import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

export interface LinkBottomSheetRef {
  open: (initialText?: string) => void;
  close: () => void;
}

interface LinkBottomSheetProps {
  onInsert: (text: string, url: string) => void;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const LinkBottomSheet = forwardRef<LinkBottomSheetRef, LinkBottomSheetProps>(
  ({ onInsert }, ref) => {
    const { t } = useI18n();
    const { colors, scheme } = useAppTheme();
    const scrollRef = useRef<ScrollView>(null);
    const urlInputRef = useRef<TextInput>(null);
    const textInputRef = useRef<TextInput>(null);
    const [url, setUrl] = useState('');
    const [text, setText] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [focusedField, setFocusedField] = useState<'url' | 'text' | null>(null);
    const inputBorderColor = scheme === 'light' ? '#C9CED8' : '#3A3A3C';

    const close = useCallback(() => {
      Keyboard.dismiss();
      setFocusedField(null);
      setIsVisible(false);
    }, []);

    useImperativeHandle(ref, () => ({
      open: (initialText = '') => {
        Keyboard.dismiss();
        setUrl('');
        setText(initialText);
        setFocusedField(null);
        setIsVisible(true);
      },
      close,
    }), [close]);

    const handleInsert = useCallback(() => {
      const finalUrl = normalizeUrl(url);

      if (!finalUrl) {
        showAppAlert(t('link.missingTitle'), t('link.missingMessage'));
        return;
      }

      try {
        const parsed = new URL(finalUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Unsupported protocol');
        }
      } catch {
        showAppAlert(t('link.invalidTitle'), t('link.invalidMessage'));
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onInsert(text.trim() || finalUrl, finalUrl);
      close();
    }, [close, onInsert, t, text, url]);

    const scrollFocusedInputIntoView = useCallback((target: number) => {
      if (Platform.OS === 'web') return;
      setTimeout(() => {
        scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(target, 18, true);
      }, 100);
    }, []);

    const insertDisabled = !url.trim();

    return (
      <SwipeableBottomSheet visible={isVisible} onClose={close} keyboardAware>
        {({ maxContentHeight, keyboardVisible }) => {
          const compact = keyboardVisible || maxContentHeight < 430;
          const desiredBodyHeight = compact ? 224 : 320;
          const bodyHeight = Math.max(156, Math.min(desiredBodyHeight, maxContentHeight - 64));

          return (
            <View style={[styles.contentShell, { maxHeight: maxContentHeight }]}>
              <ScrollView
                ref={scrollRef}
                style={[styles.scrollView, { height: bodyHeight }]}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled
                overScrollMode="never"
                automaticallyAdjustKeyboardInsets={false}
              >
                <View style={[styles.illustration, keyboardVisible && styles.illustrationKeyboard]}>
                  <View style={styles.iconOuter}>
                    <View style={[styles.iconInner, { backgroundColor: colors.iconBackground }]}>
                      <Link2 size={24} color={colors.accent} strokeWidth={2.4} />
                    </View>
                  </View>
                </View>

                <Text style={[styles.title, { color: colors.text }]}>{t('link.add')}</Text>

                <View style={styles.fields}>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('link.url')}</Text>
                    <TextInput
                      ref={urlInputRef}
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: focusedField === 'url' ? colors.accent : inputBorderColor,
                          borderWidth: focusedField === 'url' ? 1.5 : 1,
                          color: colors.text,
                        },
                        Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                      ]}
                      placeholder="https://example.com"
                      placeholderTextColor={colors.placeholder}
                      value={url}
                      onChangeText={setUrl}
                      keyboardType="url"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="url"
                      textContentType="URL"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      disableFullscreenUI
                      selectionColor={colors.accent}
                      keyboardAppearance={scheme}
                      onSubmitEditing={() => textInputRef.current?.focus()}
                      onFocus={(event) => {
                        setFocusedField('url');
                        scrollFocusedInputIntoView(event.nativeEvent.target);
                      }}
                      onBlur={() => setFocusedField((current) => current === 'url' ? null : current)}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t('link.text')}</Text>
                    <TextInput
                      ref={textInputRef}
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: focusedField === 'text' ? colors.accent : inputBorderColor,
                          borderWidth: focusedField === 'text' ? 1.5 : 1,
                          color: colors.text,
                        },
                        Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                      ]}
                      placeholder={t('link.textPlaceholder')}
                      placeholderTextColor={colors.placeholder}
                      value={text}
                      onChangeText={setText}
                      autoCapitalize="sentences"
                      returnKeyType="done"
                      disableFullscreenUI
                      onSubmitEditing={handleInsert}
                      selectionColor={colors.accent}
                      keyboardAppearance={scheme}
                      onFocus={(event) => {
                        setFocusedField('text');
                        scrollFocusedInputIntoView(event.nativeEvent.target);
                      }}
                      onBlur={() => setFocusedField((current) => current === 'text' ? null : current)}
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.elevatedMuted }]}
                  onPress={close}
                  activeOpacity={0.76}
                >
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: colors.accent },
                    insertDisabled && styles.disabled,
                  ]}
                  onPress={handleInsert}
                  disabled={insertDisabled}
                  activeOpacity={0.78}
                >
                  <Text style={styles.primaryText} numberOfLines={1}>{t('link.insert')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      </SwipeableBottomSheet>
    );
  }
);

LinkBottomSheet.displayName = 'LinkBottomSheet';

const styles = StyleSheet.create({
  contentShell: {
    width: '100%',
  },
  scrollView: {
    width: '100%',
  },
  content: {
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 16,
  },
  illustration: {
    alignItems: 'center',
    marginBottom: 10,
  },
  illustrationKeyboard: {
    display: 'none',
  },
  iconOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0,
  },
  fields: {
    gap: 12,
    marginTop: 14,
  },
  field: {
    width: '100%',
    minWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },
  input: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 0,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    paddingBottom: 2,
    paddingHorizontal: 2,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '800',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
