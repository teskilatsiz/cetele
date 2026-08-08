import { useCallback, useRef, forwardRef, useImperativeHandle, useEffect, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Keyboard,
} from 'react-native';
import { ResponsiveSheetFrame } from './ResponsiveSheetFrame';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme';

export interface ActionItem {
  id: string;
  label: string;
  icon: ReactNode;
  color?: string;
  destructive?: boolean;
  immediate?: boolean;
  onPress: () => void;
}

interface ActionBottomSheetProps {
  title?: string;
  actions: ActionItem[];
  onClose?: () => void;
}

export interface ActionBottomSheetRef {
  open: () => void;
  close: () => void;
}

export const ActionBottomSheet = forwardRef<ActionBottomSheetRef, ActionBottomSheetProps>(
  ({ title, actions, onClose }, ref) => {
    const [visible, setVisible] = useState(false);
    const actionTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const insets = useSafeAreaInsets();
    const { colors } = useAppTheme();

    useImperativeHandle(ref, () => ({
      open: () => {
        Keyboard.dismiss();
        setVisible(true);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      },
      close: () => {
        setVisible(false);
      },
    }));

    useEffect(() => {
      return () => {
        if (actionTimerRef.current) {
          clearTimeout(actionTimerRef.current);
        }
      };
    }, []);

    const handleActionPress = useCallback(
      (action: ActionItem) => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(
            action.destructive
              ? Haptics.ImpactFeedbackStyle.Heavy
              : Haptics.ImpactFeedbackStyle.Light
          );
        }
        setVisible(false);
        if (action.immediate) {
          action.onPress();
          return;
        }
        if (actionTimerRef.current) {
          clearTimeout(actionTimerRef.current);
        }
        if (Platform.OS === 'web') {
          action.onPress();
          return;
        }
        actionTimerRef.current = setTimeout(() => {
          action.onPress();
        }, Platform.OS === 'ios' ? 220 : 180);
      },
      []
    );

    return (
      <ResponsiveSheetFrame
        visible={visible}
        onOpenChange={(v) => {
          setVisible(v);
          if (!v) onClose?.();
        }}
      >
        <View style={[styles.contentContainer, { paddingBottom: Math.max(insets.bottom, 16) + (Platform.OS === 'ios' ? 4 : 0) }]}>
          {title && (
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            </View>
          )}

          {actions.map((action, index) => (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.actionItem,
                { borderBottomColor: colors.divider },
                index === actions.length - 1 && styles.lastActionItem,
              ]}
              onPress={() => handleActionPress(action)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.iconBackground },
                  action.destructive && styles.actionIconDestructive,
                ]}
              >
                {action.icon}
              </View>
              <Text
                style={[
                  styles.actionLabel,
                  { color: colors.text },
                  action.destructive && { color: colors.destructive },
                  action.color ? { color: action.color } : undefined,
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ResponsiveSheetFrame>
    );
  }
);

ActionBottomSheet.displayName = 'ActionBottomSheet';

const styles = StyleSheet.create({
  sheet: {
    zIndex: 999,
    width: '100%',
    shadowColor: 'transparent',
    elevation: 0,
  },
  sheetBackground: {
    backgroundColor: '#1C1C1E',
    borderWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      ios: {
        borderCurve: 'continuous' as any,
      },
    }),
  },
  handleIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 40,
    height: 5,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  titleContainer: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  lastActionItem: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        borderCurve: 'continuous' as any,
      },
    }),
  },
  actionIconDestructive: {
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
  },
  actionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    flex: 1,
  },
  actionLabelDestructive: {
    color: '#FF453A',
  },
});
