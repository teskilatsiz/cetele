import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SwipeableBottomSheet,
  type SwipeableBottomSheetRef,
} from './SwipeableBottomSheet';
import { latexToPlainText } from '@/lib/math-content';
import { useAppTheme } from '@/lib/theme';
import { useI18n, type TranslationKey } from '@/lib/i18n';

export type FormulaSheetMode =
  | 'power'
  | 'subscript'
  | 'fraction'
  | 'root'
  | 'sum'
  | 'integral';

export type FormulaValues = Record<string, string>;
export const FORMULA_FIELD_MAX_LENGTH = 20;

const NOTE_BODY_FONT_SIZE = 17;
const NOTE_BODY_LINE_HEIGHT = 27;
const NOTE_BODY_FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'system-ui',
});

interface FormulaField {
  key: string;
  labelKey: TranslationKey;
  placeholder: string;
  placeholderKey?: TranslationKey;
  defaultValue: string;
  required?: boolean;
  wide?: boolean;
}

interface FormulaConfig {
  titleKey: TranslationKey;
  symbol: string;
  fields: FormulaField[];
}

const FORMULA_CONFIGS: Record<FormulaSheetMode, FormulaConfig> = {
  power: {
    titleKey: 'formula.power.title',
    symbol: 'xⁿ',
    fields: [
      { key: 'base', labelKey: 'formula.field.base', placeholder: '2', defaultValue: '2', required: true },
      { key: 'exponent', labelKey: 'formula.field.exponent', placeholder: '8', defaultValue: '2', required: true },
    ],
  },
  subscript: {
    titleKey: 'formula.subscript.title',
    symbol: 'xₙ',
    fields: [
      { key: 'base', labelKey: 'formula.field.mainExpression', placeholder: 'x', defaultValue: 'x', required: true },
      { key: 'subscript', labelKey: 'formula.field.subscript', placeholder: 'n', defaultValue: 'n', required: true },
    ],
  },
  fraction: {
    titleKey: 'formula.fraction.title',
    symbol: 'a⁄b',
    fields: [
      { key: 'numerator', labelKey: 'formula.field.numerator', placeholder: 'a', defaultValue: 'a', required: true },
      { key: 'denominator', labelKey: 'formula.field.denominator', placeholder: 'b', defaultValue: 'b', required: true },
    ],
  },
  root: {
    titleKey: 'formula.root.title',
    symbol: '√x',
    fields: [
      { key: 'radicand', labelKey: 'formula.field.radicand', placeholder: 'x', defaultValue: 'x', required: true, wide: true },
      { key: 'degree', labelKey: 'formula.field.degree', placeholder: '', placeholderKey: 'formula.optional', defaultValue: '' },
    ],
  },
  sum: {
    titleKey: 'formula.sum.title',
    symbol: '∑',
    fields: [
      { key: 'lower', labelKey: 'formula.field.lowerLimit', placeholder: 'i=1', defaultValue: 'i=1', required: true },
      { key: 'upper', labelKey: 'formula.field.upperLimit', placeholder: 'n', defaultValue: 'n', required: true },
      { key: 'expression', labelKey: 'formula.field.expression', placeholder: 'i', defaultValue: 'i', required: true, wide: true },
    ],
  },
  integral: {
    titleKey: 'formula.integral.title',
    symbol: '∫',
    fields: [
      { key: 'lower', labelKey: 'formula.field.lowerLimit', placeholder: 'a', defaultValue: 'a', required: true },
      { key: 'upper', labelKey: 'formula.field.upperLimit', placeholder: 'b', defaultValue: 'b', required: true },
      { key: 'expression', labelKey: 'formula.field.expression', placeholder: 'f(x)', defaultValue: 'f(x)', required: true, wide: true },
      { key: 'variable', labelKey: 'formula.field.variable', placeholder: 'x', defaultValue: 'x', required: true },
    ],
  },
};

function cleanFormulaValue(value: string) {
  return value
    .trim()
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, FORMULA_FIELD_MAX_LENGTH);
}

export function buildFormulaLatex(mode: FormulaSheetMode, values: FormulaValues) {
  const value = (key: string, fallback: string) => cleanFormulaValue(values[key] || '') || fallback;

  switch (mode) {
    case 'power':
      return `${value('base', '2')}^{${value('exponent', '2')}}`;
    case 'subscript':
      return `${value('base', 'x')}_{${value('subscript', 'n')}}`;
    case 'fraction':
      return `\\frac{${value('numerator', 'a')}}{${value('denominator', 'b')}}`;
    case 'root': {
      const degree = cleanFormulaValue(values.degree || '');
      return degree
        ? `\\sqrt[${degree}]{${value('radicand', 'x')}}`
        : `\\sqrt{${value('radicand', 'x')}}`;
    }
    case 'sum':
      return `\\sum_{${value('lower', 'i=1')}}^{${value('upper', 'n')}} ${value('expression', 'i')}`;
    case 'integral':
      return `\\int_{${value('lower', 'a')}}^{${value('upper', 'b')}} ${value('expression', 'f(x)')}\\,d${value('variable', 'x')}`;
  }
}

export function parseFormulaLatex(tex: string): { mode: FormulaSheetMode; values: FormulaValues } | null {
  const source = tex.trim();
  let match = source.match(/^(.+?)\^\{([^{}]+)\}$/);
  if (match) return { mode: 'power', values: { base: match[1], exponent: match[2] } };

  match = source.match(/^(.+?)_\{([^{}]+)\}$/);
  if (match) return { mode: 'subscript', values: { base: match[1], subscript: match[2] } };

  match = source.match(/^\\frac\{([^{}]+)\}\{([^{}]+)\}$/);
  if (match) return { mode: 'fraction', values: { numerator: match[1], denominator: match[2] } };

  match = source.match(/^\\sqrt(?:\[([^\]]+)\])?\{([^{}]+)\}$/);
  if (match) return { mode: 'root', values: { degree: match[1] || '', radicand: match[2] } };

  match = source.match(/^\\sum_\{([^{}]+)\}\^\{([^{}]+)\}\s*(.+)$/);
  if (match) return { mode: 'sum', values: { lower: match[1], upper: match[2], expression: match[3] } };

  match = source.match(/^\\int_\{([^{}]+)\}\^\{([^{}]+)\}\s*(.+?)\\,d\s*([^\s]+)$/);
  if (match) {
    return {
      mode: 'integral',
      values: { lower: match[1], upper: match[2], expression: match[3], variable: match[4] },
    };
  }

  return null;
}

interface FormulaInputSheetProps {
  visible: boolean;
  mode: FormulaSheetMode;
  initialValues?: FormulaValues;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (tex: string, values: FormulaValues) => void;
}

export const FormulaInputSheet = memo(function FormulaInputSheet({
  visible,
  mode,
  initialValues,
  submitLabel,
  onClose,
  onSubmit,
}: FormulaInputSheetProps) {
  const { colors, scheme } = useAppTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const sheetRef = useRef<SwipeableBottomSheetRef>(null);
  const scrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollFrameRef = useRef<number | null>(null);
  const config = FORMULA_CONFIGS[mode];
  const [values, setValues] = useState<FormulaValues>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const isNarrow = width < 440;
  const inputBorderColor = scheme === 'light' ? '#C9CED8' : '#3A3A3C';

  useEffect(() => {
    if (!visible) return;
    setValues(
      Object.fromEntries(
        config.fields.map((field) => [
          field.key,
          (initialValues?.[field.key]?.trim() ?? field.defaultValue).slice(
            0,
            FORMULA_FIELD_MAX_LENGTH
          ),
        ])
      )
    );
  }, [config, initialValues, visible]);

  const tex = useMemo(() => buildFormulaLatex(mode, values), [mode, values]);
  const preview = useMemo(() => latexToPlainText(tex), [tex]);
  const disabled = config.fields.some(
    (field) => field.required && !String(values[field.key] || '').trim()
  );

  const fieldRows = useMemo(() => {
    let rows = 0;
    let halfRowOpen = false;
    config.fields.forEach((field) => {
      if (isNarrow || field.wide) {
        if (halfRowOpen) rows += 1;
        rows += 1;
        halfRowOpen = false;
      } else if (halfRowOpen) {
        rows += 1;
        halfRowOpen = false;
      } else {
        halfRowOpen = true;
      }
    });
    return rows + (halfRowOpen ? 1 : 0);
  }, [config.fields, isNarrow]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
    }
  }, []);

  const close = useCallback(() => {
    if (sheetRef.current) sheetRef.current.close();
    else onClose();
  }, [onClose]);

  const submit = useCallback(() => {
    if (disabled) return;
    const complete = () => onSubmit(tex, values);
    if (sheetRef.current) sheetRef.current.close(complete);
    else complete();
  }, [disabled, onSubmit, tex, values]);

  return (
    <SwipeableBottomSheet ref={sheetRef} visible={visible} onClose={onClose} keyboardAware>
      {({ maxContentHeight, keyboardVisible }) => {
        const compact = keyboardVisible || maxContentHeight < 480;
        const desiredBodyHeight = (compact ? 126 : 198) + fieldRows * 77 + Math.max(fieldRows - 1, 0) * 12;
        const bodyHeight = Math.max(150, Math.min(desiredBodyHeight, maxContentHeight - 64));

        return (
      <View style={[styles.contentShell, { maxHeight: maxContentHeight }]}>
        <ScrollView
          ref={scrollRef}
          style={[styles.scrollView, { height: bodyHeight }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled
          overScrollMode="never"
          automaticallyAdjustKeyboardInsets={false}
          contentContainerStyle={styles.content}
        >
          <View style={[styles.illustration, keyboardVisible && styles.illustrationKeyboard]}>
            <View style={styles.iconOuter}>
              <View style={[styles.iconInner, { backgroundColor: colors.iconBackground }]}>
                <Text style={[styles.iconText, { color: colors.accent }]}>{config.symbol}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{t(config.titleKey)}</Text>
          <View style={[
            styles.preview,
            compact && styles.previewCompact,
            { backgroundColor: colors.elevatedMuted, borderColor: inputBorderColor },
          ]}>
            <ScrollView
              horizontal
              nestedScrollEnabled
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              style={styles.previewScroll}
              contentContainerStyle={styles.previewScrollContent}
            >
              <Text
                style={[
                  styles.previewText,
                  {
                    color: colors.text,
                    fontFamily: NOTE_BODY_FONT_FAMILY,
                    fontSize: NOTE_BODY_FONT_SIZE,
                    lineHeight: NOTE_BODY_LINE_HEIGHT,
                  },
                ]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.25}
              >
                {preview}
              </Text>
            </ScrollView>
          </View>

          <View style={styles.fieldsGrid}>
            {config.fields.map((field, index) => {
              const nextField = config.fields[index + 1];
              const isWide = field.wide || isNarrow || config.fields.length === 1;
              return (
                <View key={field.key} style={[styles.field, isWide ? styles.fieldWide : styles.fieldHalf]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>{t(field.labelKey)}</Text>
                  <TextInput
                    ref={(node) => {
                      inputRefs.current[field.key] = node;
                    }}
                    value={values[field.key] || ''}
                    onChangeText={(text) => setValues((current) => ({
                      ...current,
                      [field.key]: text.slice(0, FORMULA_FIELD_MAX_LENGTH),
                    }))}
                    maxLength={FORMULA_FIELD_MAX_LENGTH}
                    placeholder={field.placeholderKey ? t(field.placeholderKey) : field.placeholder}
                    placeholderTextColor={colors.placeholder}
                    selectionColor={colors.accent}
                    keyboardAppearance={scheme}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType={nextField ? 'next' : 'done'}
                    blurOnSubmit={!nextField}
                    disableFullscreenUI
                    onSubmitEditing={() => {
                      if (nextField) inputRefs.current[nextField.key]?.focus();
                      else submit();
                    }}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: focusedField === field.key ? colors.accent : inputBorderColor,
                        borderWidth: focusedField === field.key ? 1.5 : 1,
                        color: colors.text,
                        fontFamily: NOTE_BODY_FONT_FAMILY,
                      },
                      Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                    ]}
                    onFocus={(event) => {
                      setFocusedField(field.key);
                      if (Platform.OS !== 'web') {
                        const target = event.nativeEvent.target;
                        if (scrollFrameRef.current !== null) {
                          cancelAnimationFrame(scrollFrameRef.current);
                        }
                        scrollFrameRef.current = requestAnimationFrame(() => {
                          scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(target, 16, true);
                          scrollFrameRef.current = null;
                        });
                      }
                    }}
                    onBlur={() => setFocusedField((current) => current === field.key ? null : current)}
                  />
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.elevatedMuted }]}
            onPress={close}
            activeOpacity={0.76}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.accent }, disabled && styles.disabled]}
            onPress={submit}
            disabled={disabled}
            activeOpacity={0.78}
          >
            <Text style={styles.submitText}>{submitLabel || t('formula.add')}</Text>
          </TouchableOpacity>
        </View>
      </View>
        );
      }}
    </SwipeableBottomSheet>
  );
});

FormulaInputSheet.displayName = 'FormulaInputSheet';

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
  iconText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0,
  },
  preview: {
    minHeight: 72,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  previewCompact: {
    minHeight: 64,
    marginTop: 8,
    paddingVertical: 6,
  },
  previewText: {
    fontSize: NOTE_BODY_FONT_SIZE,
    lineHeight: NOTE_BODY_LINE_HEIGHT,
    fontWeight: '400',
    letterSpacing: 0,
    textAlign: 'center',
  },
  previewScroll: {
    width: '100%',
    flexGrow: 0,
  },
  previewScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  fieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  field: {
    minWidth: 0,
    flexShrink: 0,
  },
  fieldHalf: {
    width: '48%',
    flexGrow: 1,
  },
  fieldWide: {
    width: '100%',
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
    fontSize: NOTE_BODY_FONT_SIZE,
    lineHeight: NOTE_BODY_LINE_HEIGHT,
    fontWeight: '400',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '800',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
