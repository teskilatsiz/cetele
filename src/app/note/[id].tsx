import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaBox } from '@/components/SafeAreaBox';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Trash2, Edit, Calendar, Clock, Share2, FileDown, Printer, Copy, RadioTower } from 'lucide-react-native';
import { nostrService } from '@/lib/nostr';
import type { Note } from '@/types/note';
import { RichTextRenderer } from '@/components/RichTextRenderer';
import { showAppAlert, showAppConfirm } from '@/components/AppAlertProvider';
import { ActionBottomSheet, type ActionBottomSheetRef, type ActionItem } from '@/components/ActionBottomSheet';
import {
  copyNoteMarkdown,
  copyText,
  noteToMarkdown,
  printNote,
  shareNoteText,
  sharePdfExport,
  type NoteExportText,
} from '@/lib/note-export';
import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';
import { useAndroidNotesBackHandler } from '@/hooks/useAndroidNotesBackHandler';

export default function NoteDetailScreen() {
  const { t, language } = useI18n();
  const { colors, scheme } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  useAndroidNotesBackHandler();

  const loadRequestId = useRef(0);
  const shareSheetRef = useRef<ActionBottomSheetRef>(null);
  const [detailScrollY] = useState(() => new Animated.Value(0));
  const [detailViewportHeight, setDetailViewportHeight] = useState(0);
  const [detailContentHeight, setDetailContentHeight] = useState(0);
  const detailMaxScroll = Math.max(detailContentHeight - detailViewportHeight, 0);
  const detailTrackHeight = Math.max(detailViewportHeight - 8, 0);
  const detailThumbHeight = detailViewportHeight > 0 && detailContentHeight > 0
    ? Math.max(32, (detailViewportHeight / detailContentHeight) * detailTrackHeight)
    : 0;
  const detailThumbTravel = Math.max(detailTrackHeight - detailThumbHeight, 0);
  const detailThumbTranslateY = detailScrollY.interpolate({
    inputRange: [0, Math.max(detailMaxScroll, 1)],
    outputRange: [0, detailThumbTravel],
    extrapolate: 'clamp',
  });
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

  const loadNote = useCallback(async () => {
    loadRequestId.current += 1;
    const requestId = loadRequestId.current;
    let hadCachedNote = false;

    try {
      setLoadError(null);

      if (!nostrService.isAuthenticated()) {
        await nostrService.restoreSession();
      }
      if (!nostrService.isAuthenticated()) {
        router.replace('/');
        return;
      }

      const cachedNotes = await nostrService.getCachedNotes();
      if (requestId !== loadRequestId.current) return;
      const cachedNote = cachedNotes.find((n) => n.id === id);
      if (cachedNote) {
        hadCachedNote = true;
        setNote(cachedNote);
      }

      setLoading(false);
      setSyncing(true);

      const notes = await nostrService.fetchNotes();
      if (requestId !== loadRequestId.current) return;
      const foundNote = notes.find((n) => n.id === id);
      if (foundNote) {
        setNote(foundNote);
      }
    } catch (error) {
      console.error('Error loading note:', error);
      setLoadError(t('note.syncFailed'));
      if (hadCachedNote) return;
      showAppAlert(t('common.error'), t('alerts.noteLoadFailed'));
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [id, loadRequestId, t]);

  useFocusEffect(
    useCallback(() => {
      const syncNote = nostrService.getNoteFromCacheSync(id);
      if (syncNote) {
        setNote(syncNote);
        setLoading(false);
      }
      loadNote();
      return () => {
        loadRequestId.current += 1;
      };
    }, [id, loadNote])
  );

  const handleDelete = async () => {
    if (!note?.id) return;

    const confirmed = await showAppConfirm({
      title: t('notes.deleteTitle'),
      message: t('notes.deleteMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });

    if (!confirmed) return;

    setDeleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const success = await nostrService.deleteNote(note.id);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.dismissTo('/(tabs)');
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAppAlert(t('common.error'), t('alerts.noteDeleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const runNoteAction = useCallback(
    async (action: () => Promise<void>, errorMessage = t('note.actionFailed')) => {
      if (!note || exporting) return;
      setExporting(true);
      try {
        await action();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error(errorMessage, error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showAppAlert(t('common.error'), errorMessage);
      } finally {
        setExporting(false);
      }
    },
    [exporting, note, t]
  );

  const persistNoteContent = useCallback(
    async (nextContent: string) => {
      if (!note) return;
      const nextNote: Note = {
        ...note,
        content: nextContent,
        updatedAt: Date.now(),
      };
      setNote(nextNote);
      const eventId = await nostrService.updateNote(nextNote);
      if (!eventId) {
        throw new Error('Note update failed');
      }
    },
    [note]
  );

  const handlePublishPublic = useCallback(async () => {
    if (!note) return;

    const confirmed = await showAppConfirm({
      title: t('note.publishPublicTitle'),
      message: t('note.publishPublicMessage'),
      confirmText: t('note.publish'),
      cancelText: t('common.cancel'),
    });

    if (!confirmed) return;

    await runNoteAction(async () => {
      const result = await nostrService.publishPublicNote(note, noteToMarkdown(note, exportText));
      if (!result) throw new Error('Public publish failed');
      const shareMessage = result.webUrl;

      if (Platform.OS === 'web') {
        const copied = await copyText(shareMessage);
        showAppAlert(
          copied ? t('note.nostrLinkCopied') : t('note.nostrLink'),
          copied ? t('note.shareLinkCopied') : t('note.linkCreated'),
          [
            { text: t('common.ok') },
            {
              text: t('note.copyAgain'),
              onPress: () => {
                void copyText(shareMessage);
              },
            },
          ],
          { link: result.webUrl }
        );
        return;
      }

      await Share.share({
        title: t('note.nostrLink'),
        ...(Platform.OS === 'ios' ? { url: result.webUrl } : { message: result.webUrl }),
      });
    }, t('note.publishFailed'));
  }, [exportText, note, runNoteAction, t]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
    if (diffInMinutes < 1) return t('common.justNow');
    if (diffInMinutes < 60) return formatter.format(-diffInMinutes, 'minute');
    if (diffInHours < 24) return formatter.format(-diffInHours, 'hour');
    if (diffInDays < 7) return formatter.format(-diffInDays, 'day');
    return formatDate(timestamp);
  };

  if (loading) {
    return (
      <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('note.loading')}</Text>
        </View>
      </SafeAreaBox>
    );
  }

  if (!note) {
    return (
      <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          {syncing ? (
            <>
              <ActivityIndicator size="large" color="#0A84FF" />
              <Text style={[styles.syncText, { color: colors.textSecondary }]}>{t('notes.syncingOne')}</Text>
            </>
          ) : (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {loadError ? t('note.syncFailed') : t('notes.notFound')}
            </Text>
          )}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.dismissTo('/(tabs)')}
            activeOpacity={0.8}
          >
            <Text style={[styles.backButtonText, { color: colors.text }]}>{t('note.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaBox>
    );
  }

  return (
    <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.iconBackground }]}
          onPress={() => router.dismissTo('/(tabs)')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#0A84FF" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.iconBackground }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              shareSheetRef.current?.open();
            }}
            activeOpacity={0.7}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#0A84FF" />
            ) : (
              <Share2 size={20} color="#0A84FF" strokeWidth={2.5} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.iconBackground }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/edit/${id}`);
            }}
            activeOpacity={0.7}
          >
            <Edit size={20} color="#0A84FF" strokeWidth={2.5} />
          </TouchableOpacity>

          <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.iconBackground }]}
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.7}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#FF453A" />
            ) : (
              <Trash2 size={20} color="#FF453A" strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={[{ flex: 1 }, Platform.OS === 'web' && styles.desktopContent]}>
        <View style={styles.contentSection}>
          <Text style={[styles.title, { color: colors.text }]}>{note.title || t('common.untitledNote')}</Text>

          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Calendar size={14} color={colors.textSecondary} strokeWidth={2.5} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {formatDate(note.createdAt)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={14} color={colors.textSecondary} strokeWidth={2.5} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {formatRelativeTime(note.updatedAt)}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        </View>

        {Platform.OS === 'web' ? (
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            <RichTextRenderer
              content={note.content}
              onContentChange={persistNoteContent}
            />
          </View>
        ) : (
          <View style={styles.scrollViewport}>
              <Animated.ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                persistentScrollbar={false}
                scrollEventThrottle={16}
                onLayout={(event) => setDetailViewportHeight(event.nativeEvent.layout.height)}
                onContentSizeChange={(_width, contentHeight) => setDetailContentHeight(contentHeight)}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: detailScrollY } } }],
                  { useNativeDriver: false }
                )}
              >
                <View style={{ paddingHorizontal: 20 }}>
                  <RichTextRenderer
                    content={note.content}
                    onContentChange={persistNoteContent}
                  />
                </View>
              </Animated.ScrollView>
              {detailMaxScroll > 2 && (
                <View pointerEvents="none" style={styles.scrollIndicatorTrack}>
                  <Animated.View
                    style={[
                      styles.scrollIndicatorThumb,
                      {
                        height: detailThumbHeight,
                        backgroundColor: scheme === 'light' ? '#C8CDD6' : 'rgba(255,255,255,0.48)',
                        transform: [{ translateY: detailThumbTranslateY }],
                      },
                    ]}
                  />
                </View>
              )}
          </View>
        )}
      </View>

      <ActionBottomSheet
        ref={shareSheetRef}
        title={t('note.shareExport')}
        actions={([
          {
            id: 'share-text',
            label: t('note.shareNote'),
            icon: <Share2 size={22} color={colors.text} />,
            onPress: () => runNoteAction(() => shareNoteText(note, exportText), t('note.shareFailed')),
          },
          {
            id: 'copy-markdown',
            label: t('note.copyFormatted'),
            icon: <Copy size={22} color={colors.text} />,
            onPress: () => runNoteAction(async () => {
              const copied = await copyNoteMarkdown(note, exportText);
              showAppAlert(
                copied ? t('alerts.copied') : t('note.copyFormattedTitle'),
                copied ? t('note.copyFormattedDone') : noteToMarkdown(note, exportText)
              );
            }, t('note.copyFailed')),
          },
          {
            id: 'share-pdf',
            label: t('note.exportPdf'),
            icon: <FileDown size={22} color={colors.text} />,
            onPress: () => runNoteAction(async () => {
              await sharePdfExport(note, exportText);
            }, t('note.pdfShareFailed')),
          },

          {
            id: 'print',
            label: t('pdf.print'),
            icon: <Printer size={22} color={colors.text} />,
            onPress: () => runNoteAction(async () => {
              await printNote(note, exportText);
            }, t('note.printFailed')),
          },
          {
            id: 'nostr',
            label: t('note.publishPublic'),
            icon: <RadioTower size={22} color="#0A84FF" />,
            color: '#0A84FF',
            onPress: handlePublishPublic,
          },
        ] satisfies ActionItem[])}
      />
    </SafeAreaBox>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 24,
  },
  errorText: {
    fontSize: 20,
    color: '#FF453A',
    fontWeight: '600',
  },
  syncText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    zIndex: 100,
  },
  headerBlurBg: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },

  scrollView: {
    flex: 1,
  },
  scrollViewport: {
    flex: 1,
    position: 'relative',
  },
  scrollIndicatorTrack: {
    position: 'absolute',
    top: 4,
    right: 2,
    bottom: 4,
    width: Platform.OS === 'android' ? 2 : 3,
  },
  scrollIndicatorThumb: {
    width: Platform.OS === 'android' ? 2 : 3,
    borderRadius: 999,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  desktopContent: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  contentSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
  },
});
