import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Pressable,
  Keyboard,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Check } from 'lucide-react-native';
import { nostrService } from '@/lib/nostr';
import type { Note } from '@/types/note';
import { RichTextEditor, type RichTextEditorRef, type UploadProgressInfo } from '@/components/RichTextEditor';
import { showAppAlert } from '@/components/AppAlertProvider';
import { useI18n } from '@/lib/i18n';
import { SafeAreaBox } from '@/components/SafeAreaBox';
import { hasMeaningfulRichContent } from '@/lib/rich-content';
import { useAppTheme } from '@/lib/theme';
import { readNoteDraft } from '@/lib/note-drafts';
import { useNoteDraftPersistence } from '@/hooks/useNoteDraftPersistence';
import { useAndroidNotesBackHandler } from '@/hooks/useAndroidNotesBackHandler';

const THEME_COLOR = '#0A84FF';

export default function EditNoteScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const editorRef = useRef<RichTextEditorRef>(null);
  const insets = useSafeAreaInsets();
  const headerTopPadding = Math.max(insets.top, 16) + 8;

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo | null>(null);
  const titleRef = useRef('');
  const contentRef = useRef('');
  const editingStartedRef = useRef(false);
  const draftRestoredRef = useRef(false);
  const editDraftKey = `edit:${id || 'unknown'}`;

  const { flushDraft, discardDraft } = useNoteDraftPersistence({
    draftKey: editDraftKey,
    title,
    content: contentHtml,
    enabled: draftReady,
    dirty: draftDirty,
    sourceUpdatedAt: note?.updatedAt,
  });

  const flushBeforeAndroidBack = useCallback(() => {
    void flushDraft();
  }, [flushDraft]);
  useAndroidNotesBackHandler(flushBeforeAndroidBack);

  const loadNote = useCallback(async () => {
    if (!id) return;

    let hadCachedNote = false;
    const storedDraft = draftRestoredRef.current ? null : await readNoteDraft(editDraftKey);

    const applyLoadedNote = (loadedNote: Note) => {
      setNote(loadedNote);

      if (storedDraft && !draftRestoredRef.current) {
        draftRestoredRef.current = true;
        editingStartedRef.current = true;
        titleRef.current = storedDraft.title;
        contentRef.current = storedDraft.content;
        setTitle(storedDraft.title);
        setContentHtml(storedDraft.content);
        setDraftDirty(true);
      } else if (!editingStartedRef.current) {
        titleRef.current = loadedNote.title || '';
        contentRef.current = loadedNote.content || '';
        setTitle(titleRef.current);
        setContentHtml(contentRef.current);
      }

      setDraftReady(true);
    };

    try {
      if (!nostrService.isAuthenticated()) {
        await nostrService.restoreSession();
      }
      if (!nostrService.isAuthenticated()) {
        router.replace('/');
        return;
      }

      const cachedNotes = await nostrService.getCachedNotes();
      const cachedNote = cachedNotes.find((n) => n.id === id);
      if (cachedNote) {
        hadCachedNote = true;
        applyLoadedNote(cachedNote);
        setLoading(false);
      }

      setSyncing(true);

      const notes = await nostrService.fetchNotes();
      const foundNote = notes.find((n) => n.id === id);
      if (foundNote) {
        applyLoadedNote(foundNote);
        if (!hadCachedNote) {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error loading note:', error);
      if (hadCachedNote) return;
      showAppAlert(t('common.error'), t('alerts.noteLoadFailed'));
    } finally {
      setLoading(false);
      setSyncing(false);
      setDraftReady(true);
    }
  }, [editDraftKey, id, t]);

  useEffect(() => {
    // Load the persisted note when this route becomes active.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNote();
  }, [loadNote]);

  const handleContentChange = useCallback((html: string) => {
    if (html === contentRef.current) return;
    contentRef.current = html;
    editingStartedRef.current = true;
    setContentHtml(html);
    if (draftReady) setDraftDirty(true);
  }, [draftReady]);

  const handleTitleChange = useCallback((nextTitle: string) => {
    if (nextTitle === titleRef.current) return;
    titleRef.current = nextTitle;
    editingStartedRef.current = true;
    setTitle(nextTitle);
    if (draftReady) setDraftDirty(true);
  }, [draftReady]);

  const dismissEditor = useCallback(() => {
    editorRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const handleUploadProgressPress = useCallback(() => {
    if (!uploadProgress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showAppAlert(
      t('alerts.distribution.title'),
      t('alerts.distribution.message')
    );
  }, [t, uploadProgress]);

  const handleSave = async () => {
    if (!note) return;

    try {
      const latestContent = (await editorRef.current?.getContent()) ?? contentHtml;
      contentRef.current = latestContent;
      setContentHtml(latestContent);

      if (!hasMeaningfulRichContent(latestContent) && (!title || !title.trim())) {
        await discardDraft();
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
        return;
      }

      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const finalTitle = title.trim() || t('editor.defaultTitle');

      const updatedNote: Note = {
        ...note,
        title: finalTitle,
        content: latestContent,
        updatedAt: Date.now(),
      };

      const eventId = await nostrService.updateNote(updatedNote);

      if (eventId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await discardDraft();
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)');
      } else {
        throw new Error('Güncelleme hatası');
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAppAlert(t('common.error'), t('alerts.noteUpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
      </View>
    );
  }

  if (!note) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        {syncing ? (
          <>
            <ActivityIndicator size="large" color={THEME_COLOR} />
            <Text style={[styles.centerText, { color: colors.textSecondary }]}>{t('notes.syncingOne')}</Text>
          </>
        ) : (
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>{t('notes.notFound')}</Text>
        )}
      </View>
    );
  }

  return (
    <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>

      <Pressable style={[styles.header, { paddingTop: headerTopPadding, backgroundColor: colors.background, borderBottomColor: colors.divider }]} onPress={dismissEditor}>
        <TouchableOpacity
          style={[styles.headerBtnLeft, { backgroundColor: colors.elevatedMuted }]}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('editor.editTitle')}</Text>
        </View>

        <View style={styles.headerRightCluster}>
          {uploadProgress && (
            <TouchableOpacity
              style={styles.uploadProgressPill}
              onPress={handleUploadProgressPress}
              activeOpacity={0.76}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ActivityIndicator size="small" color="#0A84FF" />
              <Text style={[styles.uploadProgressText, { color: colors.text }]}>{Math.round(uploadProgress.percent)}%</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.headerBtnRight, (saving || !!uploadProgress) && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving || !!uploadProgress}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Check size={20} color="#FFFFFF" strokeWidth={3} />
            )}
          </TouchableOpacity>
        </View>
      </Pressable>

      <KeyboardAvoidingView
        behavior="padding"
        enabled={Platform.OS === 'ios'}
        style={styles.keyboardAvoider}
      >
        <View style={[styles.contentContainer, Platform.OS === 'web' && styles.desktopContent]}>
          <RichTextEditor
            ref={editorRef}
            initialTitle={title}
            onTitleChange={handleTitleChange}
            style={styles.editor}
            initialContent={contentHtml}
            placeholder={t('editor.placeholder')}
            onChange={handleContentChange}
            onUploadProgress={setUploadProgress}
          />
        </View>
      </KeyboardAvoidingView>

    </SafeAreaBox>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    gap: 14,
  },
  centerText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#000000',
    zIndex: 10,
  },
  headerBtnLeft: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginRight: 12,
    maxWidth: '48%',
  },
  uploadProgressPill: {
    minWidth: 62,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(10, 132, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.30)',
  },
  uploadProgressText: {
    minWidth: 28,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerBtnRight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBanner: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginLeft: 20,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
  },
  syncBannerText: {
    color: THEME_COLOR,
    fontSize: 13,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    marginBottom: 12,
  },
  desktopContent: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  keyboardAvoider: {
    flex: 1,
    minHeight: 0,
  },
  editor: {
    flex: 1,
    minHeight: 0,
  },
});
