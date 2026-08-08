import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  PanResponder,
  useWindowDimensions,
  Keyboard,
  KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme';
import { useTabBarVisibility } from '@/components/TabBarVisibilityContext';

export interface SwipeableBottomSheetLayout {
  maxContentHeight: number;
  keyboardHeight: number;
  keyboardVisible: boolean;
}

interface SwipeableBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode | ((layout: SwipeableBottomSheetLayout) => ReactNode);
  keyboardAware?: boolean;
  contentBottomPadding?: number;
}

export interface SwipeableBottomSheetRef {
  close: (afterClose?: () => void) => void;
}

const SWIPE_THRESHOLD = 80;

const BOTTOM_OVERFLOW = 600;

export const SwipeableBottomSheet = forwardRef<SwipeableBottomSheetRef, SwipeableBottomSheetProps>(function SwipeableBottomSheet({
  visible,
  onClose,
  children,
  keyboardAware = false,
  contentBottomPadding = 0,
}: SwipeableBottomSheetProps, ref) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { colors } = useAppTheme();
  const { acquireTabBarHidden } = useTabBarVisibility();
  const sheetSurfaceColor = colors.scheme === 'light' ? '#FFFFFF' : '#0F0F10';

  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const restingScreenHeightRef = useRef(screenHeight);
  const screenHeightRef = useRef(screenHeight);
  const closeSheetRef = useRef<(afterClose?: () => void) => void>(() => {});
  const mountedRef = useRef(true);
  const isClosingRef = useRef(false);
  const afterCloseRef = useRef<(() => void) | undefined>(undefined);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    screenHeightRef.current = screenHeight;
    if (keyboardHeight === 0) {
      restingScreenHeightRef.current = visible
        ? Math.max(restingScreenHeightRef.current, screenHeight)
        : screenHeight;
    }
  }, [keyboardHeight, screenHeight, visible]);

  useEffect(() => {
    if (!keyboardAware) return;
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, [keyboardAware]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      translateY.stopAnimation();
      backdropOpacity.stopAnimation();
    };
  }, [backdropOpacity, translateY]);

  useEffect(() => {
    if (!visible) {
      isClosingRef.current = false;
      afterCloseRef.current = undefined;
      return;
    }
    return acquireTabBarHidden();
  }, [acquireTabBarHidden, visible]);

  const openSheet = useCallback(() => {
    isClosingRef.current = false;
    translateY.stopAnimation();
    backdropOpacity.stopAnimation();
    translateY.setValue(screenHeight);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 20,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, screenHeight, translateY]);

  const closeSheet = useCallback((afterClose?: () => void) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    afterCloseRef.current = afterClose;
    Keyboard.dismiss();
    translateY.stopAnimation();
    backdropOpacity.stopAnimation();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 230,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (!mountedRef.current) return;
      const completion = afterCloseRef.current;
      afterCloseRef.current = undefined;
      onClose();
      translateY.setValue(screenHeight);
      backdropOpacity.setValue(0);
      isClosingRef.current = false;
      completion?.();
    });
  }, [onClose, screenHeight, translateY, backdropOpacity]);

  useEffect(() => {
    closeSheetRef.current = closeSheet;
  }, [closeSheet]);

  useImperativeHandle(ref, () => ({ close: closeSheet }), [closeSheet]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx * 1.5),
      onPanResponderGrant: () => { Keyboard.dismiss(); },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
          const progress = Math.min(gs.dy / (screenHeightRef.current * 0.35), 1);
          backdropOpacity.setValue(1 - progress * 0.75);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > SWIPE_THRESHOLD || gs.vy > 0.5) {
          closeSheetRef.current();
        } else {
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              friction: 12,
              tension: 80,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 1,
              duration: 180,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const windowResizeAmount = Math.max(restingScreenHeightRef.current - screenHeight, 0);
  const keyboardOcclusion = keyboardAware
    ? Math.max(keyboardHeight - windowResizeAmount, 0)
    : 0;
  const computedBottomPadding = contentBottomPadding !== 0
    ? contentBottomPadding 
    : (keyboardAware && Platform.OS === 'ios'
      ? Math.max(keyboardOcclusion > 0 ? keyboardOcclusion + 16 : 0, insets.bottom, 36)
      : Math.max(insets.bottom + 16, 40));
  const sheetBottom =
    keyboardAware && Platform.OS === 'android' && keyboardOcclusion > 0
      ? keyboardOcclusion - BOTTOM_OVERFLOW
      : -BOTTOM_OVERFLOW;
  const maxContentHeight = Math.max(
    220,
    screenHeight - keyboardOcclusion - insets.top - Math.max(insets.bottom, 16) - 36
  );
  let renderedChildren: ReactNode = null;
  if (visible) {
    renderedChildren = typeof children === 'function'
      ? children({
        maxContentHeight,
        keyboardHeight: keyboardOcclusion,
        keyboardVisible: keyboardHeight > 0,
      })
      : children;
  }

  if (Platform.OS === 'web') {
    if (!visible) return null;
    const isDesktop = screenWidth >= 768;
    return (
      <View style={[
        StyleSheet.absoluteFill, 
        styles.backdrop,
        { backgroundColor: colors.scheme === 'light' ? 'rgba(17,17,20,0.32)' : 'rgba(0,0,0,0.75)' },
        isDesktop && styles.webModalContainer,
        { position: 'fixed' as any, zIndex: 9999 }
      ]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); onClose(); }} />
        {isDesktop ? (
          <Animated.View
            style={[
              styles.webModalContent,
              ({
                backgroundColor: sheetSurfaceColor,
                borderColor: colors.border,
                boxShadow: colors.scheme === 'light'
                  ? '0 4px 16px rgba(0, 0, 0, 0.06)'
                  : '0 20px 40px rgba(0,0,0,0.5)',
              } as any),
            ]}
          >
            {renderedChildren}
          </Animated.View>
        ) : (
          <Animated.View style={[styles.sheetWrapper, { bottom: 0 }]}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[
                styles.sheetInner,
                {
                  backgroundColor: sheetSurfaceColor,
                  borderTopColor: colors.border,
                  borderLeftColor: colors.border,
                  borderRightColor: colors.border,
                  shadowOpacity: colors.scheme === 'light' ? 0.08 : 0.3,
                  shadowRadius: colors.scheme === 'light' ? 12 : 20,
                },
              ]}
            >
              <View style={{ paddingBottom: computedBottomPadding }}>
                {renderedChildren}
              </View>
            </Pressable>
          </Animated.View>
        )}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={() => closeSheet()}
      onShow={openSheet}
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated={Platform.OS === 'android'}
    >

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          { backgroundColor: colors.scheme === 'light' ? 'rgba(17,17,20,0.32)' : 'rgba(0,0,0,0.75)', opacity: backdropOpacity },
        ]}
        pointerEvents="box-none"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSheet()} />
      </Animated.View>

      <Animated.View
        style={[styles.sheetWrapper, { bottom: sheetBottom, transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheetInner,
            {
              backgroundColor: sheetSurfaceColor,
              borderTopColor: colors.border,
              borderLeftColor: colors.border,
              borderRightColor: colors.border,
              shadowOpacity: colors.scheme === 'light' ? 0.08 : 0.3,
              shadowRadius: colors.scheme === 'light' ? 12 : 20,
            },
          ]}
        >

          <View style={{ paddingBottom: computedBottomPadding }}>
            {renderedChildren}
          </View>

          <View style={{ height: BOTTOM_OVERFLOW }} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
});

SwipeableBottomSheet.displayName = 'SwipeableBottomSheet';

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheetWrapper: {
    position: 'absolute',

    bottom: -BOTTOM_OVERFLOW,
    left: 0,
    right: 0,
    maxWidth: 540,
    alignSelf: 'center',
    width: '100%',
  },
  sheetInner: {
    backgroundColor: '#0F0F10',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.02)',
    borderRightColor: 'rgba(255,255,255,0.02)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  webModalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  webModalContent: {
    backgroundColor: '#0A0A0A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 540,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)' as any,
    maxHeight: '90vh' as any,
    overflow: 'auto' as any,
  },
});
