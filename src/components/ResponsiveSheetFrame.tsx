import { useEffect, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from 'heroui-native';
import { useTabBarVisibility } from '@/components/TabBarVisibilityContext';
import { useAppTheme } from '@/lib/theme';

interface ResponsiveSheetFrameProps {
  visible: boolean;
  onOpenChange: (visible: boolean) => void;
  children: ReactNode;
  keyboardBehavior?: 'extend' | 'interactive' | 'fillParent';
  desktopMaxWidth?: number;
}

export function ResponsiveSheetFrame({
  visible,
  onOpenChange,
  children,
  keyboardBehavior,
  desktopMaxWidth = 430,
}: ResponsiveSheetFrameProps) {
  const { colors } = useAppTheme();
  const { acquireTabBarHidden } = useTabBarVisibility();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && width >= 768;
  const bottomLift = height < 720 ? 18 : 24;
  const sheetSurfaceColor = colors.scheme === 'light' ? '#FFFFFF' : '#1C1C1E';
  const sheetContentStyle = {
    paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 24) + bottomLift,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: sheetSurfaceColor,
  };

  useEffect(() => {
    if (!visible) return;
    return acquireTabBarHidden();
  }, [acquireTabBarHidden, visible]);

  if (isWebDesktop) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => onOpenChange(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => onOpenChange(false)} />
          <View
            style={[
              styles.modalCard,
              {
                maxWidth: desktopMaxWidth,
                maxHeight: Math.max(360, height - 80),
                backgroundColor: sheetSurfaceColor,
                borderColor: colors.border,
              },
            ]}
          >
            {children}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={onOpenChange}
    >
      <BottomSheet.Portal
        disableFullWindowOverlay={false}
        unstable_accessibilityContainerViewIsModal
      >
        <BottomSheet.Overlay
          style={[
            styles.nativeOverlay,
            { backgroundColor: colors.scheme === 'light' ? 'rgba(17,17,20,0.32)' : 'rgba(0,0,0,0.72)' },
          ]}
        />
        <BottomSheet.Content
          keyboardBehavior={keyboardBehavior}
          backgroundStyle={[styles.sheetBackground, { backgroundColor: sheetSurfaceColor }]}
          contentContainerProps={{ style: { backgroundColor: sheetSurfaceColor } }}
          handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: colors.textTertiary }]}
          style={sheetContentStyle}
        >
          {children}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  nativeOverlay: {
    ...StyleSheet.absoluteFill,
  },
  sheetBackground: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  handleIndicator: {
    backgroundColor: '#48484A',
  },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  modalCard: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.42)',
      } as any,
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.34,
        shadowRadius: 36,
      },
      android: {
        elevation: 16,
      },
    }),
  },
});
