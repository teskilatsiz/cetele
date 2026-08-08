import { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  PlatformColor,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ListTodo,
  Table,
  Paperclip,
  PenTool,
  MoreHorizontal
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import type { FormulaSheetMode } from './PowerFormulaSheet';

export interface ToolbarAction {
  id: string;
  icon?: ReactNode;
  activeIcon?: ReactNode;
  label?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
  isActive?: boolean;
  isDivider?: boolean;
}

interface KeyboardToolbarProps {
  onFormatAa?: () => void;
  onCheckList?: () => void;
  onTable?: () => void;
  onAttachment?: () => void;
  onDrawing?: () => void;
  onMore?: () => void;
  onLatexSnippet?: (snippet: string) => void;
  onApplyPower?: (exponent: string) => void;
  onOpenFormula?: (mode: FormulaSheetMode) => void;
  activeStyles?: string[];
  customActions?: ToolbarAction[];
}

const TOOLBAR_HEIGHT = 46;
const ICON_SIZE = 20;

export function KeyboardToolbar({
  onFormatAa,
  onCheckList,
  onTable,
  onAttachment,
  onDrawing,
  onMore,
  onLatexSnippet,
  onApplyPower,
  onOpenFormula,
  activeStyles = [],
  customActions,
}: KeyboardToolbarProps) {
  const { colors, scheme } = useAppTheme();
  const { t } = useI18n();
  const [handlePress] = useState(() => {
    let pressGate: { id: string; at: number } | null = null;

    return (id: string, action: (() => void) | undefined) => {
      if (!action) return;

      const now = Date.now();
      if (pressGate && now - pressGate.at < 220) return;

      pressGate = { id, at: now };
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      action();
      setTimeout(() => {
        if (pressGate?.id === id) pressGate = null;
      }, 240);
    };
  });
  const toolbarSurface =
    Platform.OS === 'ios'
      ? PlatformColor('systemGray6Color')
      : scheme === 'light'
        ? '#F2F2F7'
        : '#1C1C1E';
  const toolbarBorder =
    Platform.OS === 'ios'
      ? PlatformColor('separatorColor')
      : scheme === 'light'
        ? 'rgba(60, 60, 67, 0.18)'
        : 'rgba(255, 255, 255, 0.12)';
  const toolbarForeground = scheme === 'light' ? '#3C3C43' : '#EBEBF5';
  const activeButtonBackground = scheme === 'light' ? '#FFFFFF' : '#3A3A3C';

  const defaultActions: ToolbarAction[] = [
    onFormatAa && {
      id: 'formatAa',
      icon: <Text style={[styles.formatAaText, { color: toolbarForeground }]}>Aa</Text>,
      onPress: () => handlePress('formatAa', onFormatAa),
      accessibilityLabel: 'Format',
    },
    onCheckList && {
      id: 'checkList',
      icon: <ListTodo size={ICON_SIZE} color={toolbarForeground} />,
      onPress: () => handlePress('checkList', onCheckList),
      accessibilityLabel: 'Checklist',
    },
    onTable && {
      id: 'table',
      icon: <Table size={ICON_SIZE} color={toolbarForeground} />,
      onPress: () => handlePress('table', onTable),
      accessibilityLabel: 'Table',
    },
    onAttachment && {
      id: 'attachment',
      icon: <Paperclip size={ICON_SIZE} color={toolbarForeground} />,
      onPress: () => handlePress('attachment', onAttachment),
      accessibilityLabel: 'Attachment',
    },
    onDrawing && {
      id: 'drawing',
      icon: <PenTool size={ICON_SIZE} color={toolbarForeground} />,
      onPress: () => handlePress('drawing', onDrawing),
      accessibilityLabel: 'Drawing',
    },
    onMore && {
      id: 'more',
      icon: <MoreHorizontal size={ICON_SIZE} color={toolbarForeground} />,
      onPress: () => handlePress('more', onMore),
      accessibilityLabel: 'More',
    },
  ].filter(Boolean) as ToolbarAction[];

  const latexActions: ToolbarAction[] = (() => {
    if (!onLatexSnippet && !onApplyPower && !onOpenFormula) return [];

    const snippets = [
      onApplyPower && { id: 'latex-sup2', label: 'x²', name: t('formula.toolbar.square'), onPress: () => handlePress('latex-sup2', () => onApplyPower('2')) },
      onOpenFormula && { id: 'latex-power-custom', label: 'xⁿ', name: t('formula.power.title'), onPress: () => handlePress('latex-power-custom', () => onOpenFormula('power')) },
      onOpenFormula && { id: 'latex-sub', label: 'xₙ', name: t('formula.subscript.title'), onPress: () => handlePress('latex-sub', () => onOpenFormula('subscript')) },
      onOpenFormula && { id: 'latex-frac', label: 'a⁄b', name: t('formula.fraction.title'), onPress: () => handlePress('latex-frac', () => onOpenFormula('fraction')) },
      onOpenFormula && { id: 'latex-root', label: '√x', name: t('formula.root.title'), onPress: () => handlePress('latex-root', () => onOpenFormula('root')) },
      onOpenFormula && { id: 'latex-sum', label: '∑', name: t('formula.sum.title'), onPress: () => handlePress('latex-sum', () => onOpenFormula('sum')) },
      onOpenFormula && { id: 'latex-integral', label: '∫', name: t('formula.integral.title'), onPress: () => handlePress('latex-integral', () => onOpenFormula('integral')) },
      onLatexSnippet && { id: 'latex-pi', label: 'π', value: '\\pi', name: t('formula.toolbar.pi') },
      onLatexSnippet && { id: 'latex-infinity', label: '∞', value: '\\infty', name: t('formula.toolbar.infinity') },
    ];

    return [
      { id: 'latex-divider', isDivider: true },
      ...snippets.filter(Boolean).map((item: any) => ({
        id: item.id,
        label: item.label,
        accessibilityLabel: item.name,
        onPress: item.onPress || (() => handlePress(item.id, () => onLatexSnippet?.(item.value))),
      })),
    ];
  })();

  const actions = customActions || [...defaultActions, ...latexActions];

  return (
    <View style={[styles.container, { borderColor: toolbarBorder }]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 34 : 0}
        tint={colors.blurTint}
        style={[
          styles.blurBackground,
          {
            backgroundColor: toolbarSurface,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          bounces={false}
        >
          {actions.map((action) => {
            if (action.isDivider) {
              return <View key={action.id} style={[styles.divider, { backgroundColor: toolbarBorder }]} />;
            }

            return (
              <TouchableOpacity
                key={action.id}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
                style={[
                  styles.button,
                  action.isActive && { backgroundColor: activeButtonBackground },
                ]}
                onPress={action.onPress}
                {...(Platform.OS === 'web' ? { onMouseDown: (e: any) => e.preventDefault() } : {})}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                {action.label ? (
                  <Text style={[styles.mathText, { color: toolbarForeground }]} numberOfLines={1}>
                    {action.label}
                  </Text>
                ) : (
                  action.isActive ? (action.activeIcon || action.icon) : action.icon
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 46,
    marginHorizontal: 18,
    marginBottom: 8,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  blurBackground: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 2,
  },
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formatAaText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0,
  },
  mathText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 6,
  },
});

export { TOOLBAR_HEIGHT };
