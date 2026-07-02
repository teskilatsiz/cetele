import { forwardRef, useCallback, useImperativeHandle, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Keyboard } from 'react-native';
import { ResponsiveSheetFrame } from './ResponsiveSheetFrame';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Eraser,
  List,
  ListOrdered,
  CheckSquare,
  IndentDecrease,
  IndentIncrease,
  Pilcrow,
  Circle
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

export interface FormatBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface FormatBottomSheetProps {
  onFormat: (command: string, value?: string) => void;
  activeStyles: string[];
  activeTextColor?: string;
}

const THEME_COLOR = '#0A84FF';
const INACTIVE_COLOR = '#8E8E93';

function normalizeColorValue(value: string) {
  const color = value.trim().toUpperCase();
  const rgb = color.match(/^RGBA?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!rgb) return color;
  return `#${rgb
    .slice(1, 4)
    .map((channel) => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

export const FormatBottomSheet = forwardRef<FormatBottomSheetRef, FormatBottomSheetProps>(
  ({ onFormat, activeStyles, activeTextColor }, ref) => {
    const { t } = useI18n();
    const { colors, scheme } = useAppTheme();
    const [visible, setVisible] = useState(false);
    const insets = useSafeAreaInsets();

    useImperativeHandle(ref, () => ({
      open: () => {
        Keyboard.dismiss();
        setVisible(true);
      },
      close: () => {
        setVisible(false);
      },
    }));

    useEffect(() => {
      const showSubscription = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        () => setVisible(false)
      );
      return () => showSubscription.remove();
    }, []);

    const isActive = useCallback(
      (style: string) => activeStyles.includes(style),
      [activeStyles]
    );

    const handleFormat = useCallback((command: string, value?: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFormat(command, value);
    }, [onFormat]);

    const [colorMenuVisible, setColorMenuVisible] = useState(false);
    const defaultTextColor = scheme === 'light' ? '#111114' : '#FFFFFF';
    const [selectedColor, setSelectedColor] = useState(defaultTextColor);
    const normalizedSelectedColor = normalizeColorValue(selectedColor);
    const colorAtOpenRef = useRef(activeTextColor || defaultTextColor);

    useEffect(() => {
      if (!visible) colorAtOpenRef.current = activeTextColor || defaultTextColor;
    }, [activeTextColor, defaultTextColor, visible]);

    useEffect(() => {
      if (visible) setSelectedColor(colorAtOpenRef.current);
    }, [visible]);

    const handleColorPicker = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setColorMenuVisible((current) => !current);
    }, []);

    const selectColor = useCallback((colorHex: string) => {
      setSelectedColor(colorHex);
      handleFormat('foreColor', colorHex);
      setColorMenuVisible(false);
    }, [handleFormat]);

    const COLORS = [
      { label: scheme === 'light' ? 'Siyah' : t('format.white'), value: defaultTextColor },
      { label: t('format.red'), value: '#FF3B30' },
      { label: t('format.orange'), value: '#FF9500' },
      { label: t('format.blue'), value: '#0A84FF' },
      { label: t('format.purple'), value: '#AF52DE' }
    ];

    return (
      <ResponsiveSheetFrame
        visible={visible}
        onOpenChange={(v) => {
          setVisible(v);
        }}
      >
        <View style={[styles.contentContainer, { paddingBottom: Math.max(insets.bottom, 24) + (Platform.OS === 'ios' ? 8 : 0) }]}>
              <View style={styles.header}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('format.title')}</Text>
                <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.iconBackground }]} onPress={() => setVisible(false)}>
                  <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.blockBtn, isActive('heading1') && styles.blockBtnActive]}
                  onPress={() => handleFormat('heading1')}
                >
                  <Text style={[styles.blockBtnText, { color: colors.text }, isActive('heading1') && styles.blockBtnTextActive]} numberOfLines={1} adjustsFontSizeToFit>{t('format.heading')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.blockBtn, isActive('heading2') && styles.blockBtnActive]}
                  onPress={() => handleFormat('heading2')}
                >
                  <Text style={[styles.blockBtnText, { color: colors.text }, isActive('heading2') && styles.blockBtnTextActive]} numberOfLines={1} adjustsFontSizeToFit>{t('format.subheading')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.blockBtn, isActive('paragraph') && styles.blockBtnActive]}
                  onPress={() => handleFormat('paragraph')}
                >
                  <Text style={[styles.blockBtnText, { color: colors.text }, isActive('paragraph') && styles.blockBtnTextActive]} numberOfLines={1} adjustsFontSizeToFit>{t('format.paragraph')}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.iconRow, { zIndex: 10, backgroundColor: colors.elevatedMuted }]}>
                <TouchableOpacity style={[styles.iconBtn, isActive('bold') && styles.iconBtnActive]} onPress={() => handleFormat('bold')}>
                  <Bold size={20} color={isActive('bold') ? '#FFFFFF' : INACTIVE_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, isActive('italic') && styles.iconBtnActive]} onPress={() => handleFormat('italic')}>
                  <Italic size={20} color={isActive('italic') ? '#FFFFFF' : INACTIVE_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, isActive('underline') && styles.iconBtnActive]} onPress={() => handleFormat('underline')}>
                  <Underline size={20} color={isActive('underline') ? '#FFFFFF' : INACTIVE_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, isActive('strikethrough') && styles.iconBtnActive]} onPress={() => handleFormat('strikethrough')}>
                  <Strikethrough size={20} color={isActive('strikethrough') ? '#FFFFFF' : INACTIVE_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleFormat('removeFormat')}>
                  <Eraser size={20} color={INACTIVE_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, colorMenuVisible && styles.iconBtnActive]} onPress={handleColorPicker}>
                  <Circle size={20} color={selectedColor} fill={selectedColor} />
                </TouchableOpacity>
              </View>

              {colorMenuVisible && (
                <View style={[styles.colorDropdown, { backgroundColor: colors.elevatedMuted }]}>
                  {COLORS.map((c) => (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        styles.colorDropdownItem,
                        normalizedSelectedColor === normalizeColorValue(c.value) && { backgroundColor: colors.iconBackground },
                      ]}
                      onPress={() => selectColor(c.value)}
                    >
                      <Circle
                        size={16}
                        color={c.value}
                        fill={c.value}
                        strokeWidth={normalizedSelectedColor === normalizeColorValue(c.value) ? 3 : 2}
                        style={styles.colorDropdownIcon}
                      />
                      <Text style={[styles.colorDropdownText, { color: colors.text }]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={[styles.iconRow, { zIndex: 1, backgroundColor: colors.elevatedMuted }]}>
                <TouchableOpacity style={[styles.iconBtn, isActive('bulletList') && styles.iconBtnActive]} onPress={() => handleFormat('bulletList')}>
                  <List size={20} color={isActive('bulletList') ? '#FFFFFF' : INACTIVE_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, isActive('orderedList') && styles.iconBtnActive]} onPress={() => handleFormat('orderedList')}>
                  <ListOrdered size={20} color={isActive('orderedList') ? '#FFFFFF' : INACTIVE_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, isActive('checkList') && styles.iconBtnActive]} onPress={() => handleFormat('checkList')}>
                  <CheckSquare size={20} color={isActive('checkList') ? '#FFFFFF' : INACTIVE_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleFormat('indent')}>
                  <IndentIncrease size={20} color={INACTIVE_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleFormat('outdent')}>
                  <IndentDecrease size={20} color={INACTIVE_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleFormat('paragraph')}>
                  <Pilcrow size={20} color={INACTIVE_COLOR} />
                </TouchableOpacity>
              </View>

        </View>
      </ResponsiveSheetFrame>
    );
  }
);

FormatBottomSheet.displayName = 'FormatBottomSheet';

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#1C1C1E',
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    width: 40,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  blockBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  blockBtnActive: {
    backgroundColor: THEME_COLOR,
  },
  blockBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  blockBtnTextActive: {
    color: '#FFFFFF',
  },
  iconRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  iconBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  iconBtnActive: {
    backgroundColor: THEME_COLOR,
  },
  colorDropdown: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 8,
    width: '100%',
    marginTop: -8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  colorDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  colorDropdownIcon: {
    marginRight: 10,
  },
  colorDropdownText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
});
