import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import {
  Copy,
  Eye,
  FolderDown,
  Pencil,
  Printer,
  Share2,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ScrollShadow } from 'heroui-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ResponsiveSheetFrame } from './ResponsiveSheetFrame';
import { SwipeableBottomSheet } from './SwipeableBottomSheet';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { showAppAlert } from './AppAlertProvider';
import type { PdfPreviewSize } from '@/lib/pdf-content';
import { getPdfFileNameFromUrl } from '@/lib/pdf-content';
import { copyText, printRemotePdf, saveRemoteDocument, shareRemoteDocument, type NoteExportText } from '@/lib/note-export';
import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

export interface PdfActionTarget {
  url: string;
  title?: string;
  size?: PdfPreviewSize;
  isPdf?: boolean;
}

interface PdfActionSheetProps {
  visible: boolean;
  target: PdfActionTarget | null;
  onClose: () => void;
  onOpen: (target: PdfActionTarget) => void;
  onRename?: (target: PdfActionTarget, nextTitle: string) => void | Promise<void>;
  onDelete?: (target: PdfActionTarget) => void | Promise<void>;
  keepKeyboardDismissed?: boolean;
}

type SheetMode = 'actions' | 'rename' | 'delete';
type PdfAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean;
};

const BLUE = '#0A84FF';

export function PdfActionSheet({
  visible,
  target,
  onClose,
  onOpen,
  onRename,
  onDelete,
  keepKeyboardDismissed = false,
}: PdfActionSheetProps) {
  const { t, language } = useI18n();
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<SheetMode>('actions');
  const [renameValue, setRenameValue] = useState('');
  const { height } = useWindowDimensions();

  const isPdfTarget = target?.isPdf !== false;
  const title = target?.title || (target?.url ? getPdfFileNameFromUrl(target.url, isPdfTarget ? t('editor.pdfDocument') : t('editor.file')) : (isPdfTarget ? t('editor.pdfDocument') : t('editor.file')));
  const exportText = useMemo<NoteExportText>(() => ({
    untitledNote: t('common.untitledNote'),
    updated: t('export.updated'),
    appName: t('export.appName'),
    pdfDocument: t('editor.pdfDocument'),
    file: t('editor.file'),
    video: t('editor.video'),
    shareFormattedText: t('export.shareFormattedText'),
    sharePdf: t('export.sharePdf'),
    ceteleNote: t('export.ceteleNote'),
    pdfShare: t('export.pdfShare'),
    locale: language,
  }), [language, t]);
  const bottomClearance = Platform.OS === 'android'
    ? (height < 720 ? 36 : 44)
    : (height < 720 ? 30 : 38);

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      const timer = setTimeout(() => Keyboard.dismiss(), 80);
      const lateTimer = setTimeout(() => Keyboard.dismiss(), 220);
      // Reset transient sheet state whenever a new target is presented.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('actions');
      setRenameValue(title);
      return () => {
        clearTimeout(timer);
        clearTimeout(lateTimer);
      };
    }
  }, [title, visible]);

  useEffect(() => {
    if (!visible || !keepKeyboardDismissed) {
      return;
    }

    Keyboard.dismiss();
    const dismissKeyboard = () => Keyboard.dismiss();
    const timers = [
      setTimeout(dismissKeyboard, 0),
      setTimeout(dismissKeyboard, 40),
      setTimeout(dismissKeyboard, 120),
      setTimeout(dismissKeyboard, 260),
    ];
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', dismissKeyboard),
      Platform.OS === 'ios' ? Keyboard.addListener('keyboardWillShow', dismissKeyboard) : null,
    ].filter(Boolean) as { remove: () => void }[];

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [keepKeyboardDismissed, visible]);

  const close = useCallback(() => {
    setMode('actions');
    onClose();
  }, [onClose]);

  const run = useCallback(
    async (action: () => void | Promise<void>) => {
      try {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        await action();
      } catch (error) {
        console.error('PDF action failed:', error);
        showAppAlert(t('common.error'), t('alerts.pdfActionFailed'));
      }
    },
    [t]
  );

  const handleOpen = useCallback(() => {
    if (!target) return;
    close();
    onOpen(target);
  }, [close, onOpen, target]);

  const handleShare = useCallback(() => {
    if (!target) return;
    close();
    void run(() => shareRemoteDocument(target.url, title, exportText));
  }, [close, exportText, run, target, title]);

  const handleSave = useCallback(() => {
    if (!target) return;
    close();
    void run(() => saveRemoteDocument(target.url, title, exportText));
  }, [close, exportText, run, target, title]);

  const handlePrint = useCallback(() => {
    if (!target) return;
    close();
    void run(() => printRemotePdf(target.url, title, exportText));
  }, [close, exportText, run, target, title]);

  const handleCopy = useCallback(() => {
    if (!target) return;
    close();
    void run(async () => {
      const copied = await copyText(target.url);
      showAppAlert(
        copied ? t('alerts.copied') : t('note.nostrLink'),
        copied ? t('alerts.linkCopied') : target.url
      );
    });
  }, [close, run, t, target]);

  const handleRename = useCallback(() => {
    if (!target || !onRename) return;
    const nextTitle = renameValue.trim();
    if (!nextTitle) return;
    close();
    void run(() => onRename(target, nextTitle));
  }, [close, onRename, renameValue, run, target]);

  const handleDelete = useCallback(() => {
    if (!target || !onDelete) return;
    close();
    void run(() => onDelete(target));
  }, [close, onDelete, run, target]);

  const actions = useMemo<PdfAction[]>(
    () => [
      { id: 'open', label: t('pdf.look'), icon: <Eye size={22} color={colors.text} />, onPress: handleOpen },
      { id: 'share', label: t('common.share'), icon: <Share2 size={22} color={colors.text} />, onPress: handleShare },
        { id: 'save', label: t('pdf.saveToFiles'), icon: <FolderDown size={22} color={colors.text} />, onPress: handleSave },
      ...(isPdfTarget ? [{ id: 'print', label: t('pdf.print'), icon: <Printer size={22} color={colors.text} />, onPress: handlePrint }] : []),
      { id: 'copy', label: t('common.copy'), icon: <Copy size={22} color={colors.text} />, onPress: handleCopy },
      ...(onRename
        ? [{
            id: 'rename',
            label: t('pdf.rename'),
            icon: <Pencil size={22} color={colors.text} />,
            onPress: () => setMode('rename'),
          }]
        : []),
      ...(onDelete
        ? [{
            id: 'delete',
            label: t('common.delete'),
            icon: <Trash2 size={22} color={colors.destructive} />,
            destructive: true,
            onPress: () => setMode('delete'),
          }]
        : []),
    ],
    [colors.destructive, colors.text, handleCopy, handleOpen, handlePrint, handleSave, handleShare, isPdfTarget, onDelete, onRename, t]
  );

  return (
    <>
      <ResponsiveSheetFrame
        visible={visible && mode === 'actions'}
        onOpenChange={(nextVisible) => {
          if (!nextVisible) close();
        }}
        desktopMaxWidth={460}
      >
        <View style={[styles.sheet, { paddingBottom: bottomClearance }]}>
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View style={styles.headerTextWrap}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('pdf.options')}</Text>
            </View>
          </View>

          <ScrollShadow size={40} color={colors.elevated} style={styles.actionsScroll} LinearGradientComponent={LinearGradient}>
            <ScrollView
              contentContainerStyle={styles.actionsContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.actionItem,
                    { borderBottomColor: colors.divider },
                    index === actions.length - 1 && styles.lastActionItem,
                  ]}
                  onPress={action.onPress}
                  activeOpacity={0.75}
                >
                  <View style={[
                    styles.actionIcon,
                    { backgroundColor: colors.iconBackground },
                    action.selected && styles.actionIconSelected,
                    action.destructive && { backgroundColor: `${colors.destructive}1F` },
                  ]}>
                    {action.icon}
                  </View>
                  <Text style={[
                    styles.actionLabel,
                    { color: action.destructive ? colors.destructive : colors.text },
                    action.selected && styles.actionLabelSelected,
                  ]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollShadow>
        </View>
      </ResponsiveSheetFrame>

      <SwipeableBottomSheet
        visible={visible && mode === 'rename'}
        onClose={() => setMode('actions')}
        keyboardAware
      >
        <Animated.View
          entering={FadeInDown.duration(500).delay(100)}
          style={styles.compactIllustration}
        >
          <View style={styles.compactIconOuter}>
            <View style={styles.compactIconMiddle}>
              <View style={styles.compactIconInner}>
                <Pencil size={24} color={colors.accent} strokeWidth={1.5} />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(250)}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('pdf.renameTitle')}</Text>
          <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
            {t('pdf.renameDesc')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350)}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.sheetInput, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder={t('pdf.namePlaceholder')}
              placeholderTextColor={colors.placeholder}
              selectionColor={colors.accent}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRename}
            />
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.sheetBtnPrimary, { backgroundColor: colors.accent }, !renameValue.trim() && { opacity: 0.5 }]}
              onPress={handleRename}
              disabled={!renameValue.trim()}
              activeOpacity={0.8}
            >
              <Pencil size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.sheetBtnPrimaryText} numberOfLines={1} adjustsFontSizeToFit>{t('common.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetBtnCancel, { backgroundColor: colors.elevatedMuted }]}
              onPress={() => setMode('actions')}
              activeOpacity={0.8}
            >
              <Text style={[styles.sheetBtnCancelText, { color: colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SwipeableBottomSheet>

      <SwipeableBottomSheet
        visible={visible && mode === 'delete'}
        onClose={() => setMode('actions')}
      >
        <Animated.View
          entering={FadeInDown.duration(500).delay(100)}
          style={styles.compactIllustration}
        >
          <View style={[styles.compactIconOuter, { backgroundColor: `${colors.destructive}0A` }]}>
            <View style={[styles.compactIconMiddle, { backgroundColor: `${colors.destructive}14` }]}>
              <View style={[styles.compactIconInner, { backgroundColor: `${colors.destructive}24` }]}>
                <Trash2 size={24} color={colors.destructive} strokeWidth={1.5} />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(250)}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('pdf.deleteTitle')}</Text>
          <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
            {t('pdf.deleteDesc')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350)}>
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.sheetBtnPrimary, { backgroundColor: colors.destructive }]}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Trash2 size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.sheetBtnPrimaryText} numberOfLines={1} adjustsFontSizeToFit>{t('pdf.removeConfirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetBtnCancel, { backgroundColor: colors.elevatedMuted }]}
              onPress={() => setMode('actions')}
              activeOpacity={0.8}
            >
              <Text style={[styles.sheetBtnCancelText, { color: colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SwipeableBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 18 : 14,
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.10)',
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 3,
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsScroll: {
    maxHeight: 520,
  },
  actionsContent: {
    paddingTop: 6,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 8,
    gap: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  lastActionItem: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionIconSelected: {
    backgroundColor: 'rgba(10,132,255,0.16)',
  },
  actionLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  actionLabelSelected: {
    color: BLUE,
  },
  compactIllustration: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  compactIconOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(10, 132, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactIconMiddle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactIconInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(10, 132, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  sheetDesc: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  inputContainer: {
    marginBottom: 20,
  },
  sheetInput: {
    height: 52,
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  sheetActions: {
    gap: 10,
  },
  sheetBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0A84FF',
    paddingVertical: 16,
    borderRadius: 14,
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  sheetBtnPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetBtnCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  sheetBtnCancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#8E8E93',
  },
});
