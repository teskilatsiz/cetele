import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Pressable,
  Keyboard,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, PenLine, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { nostrService } from '@/lib/nostr';
import type { Note } from '@/types/note';
import { router } from 'expo-router';
import { RichTextEditor, type RichTextEditorRef, type UploadProgressInfo } from '@/components/RichTextEditor';
import { showAppAlert } from '@/components/AppAlertProvider';
import { useI18n } from '@/lib/i18n';
import { SafeAreaBox } from '@/components/SafeAreaBox';
import { maybeRequestStoreReviewAfterNoteCreated } from '@/lib/store-review';
import { hasMeaningfulRichContent } from '@/lib/rich-content';
import { useAppTheme } from '@/lib/theme';
import { readNoteDraft } from '@/lib/note-drafts';
import { useNoteDraftPersistence } from '@/hooks/useNoteDraftPersistence';
import { useAndroidNotesBackHandler } from '@/hooks/useAndroidNotesBackHandler';
const THEME_COLOR = '#0A84FF';
const NEW_NOTE_DRAFT_KEY = 'new';

export default function NewNoteScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const editorRef = useRef<RichTextEditorRef>(null);
  const insets = useSafeAreaInsets();
  const headerTopPadding = Math.max(insets.top, 16) + 8;

  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo | null>(null);
  const titleRef = useRef('');
  const contentRef = useRef('');

  useEffect(() => {
    let mounted = true;
    readNoteDraft(NEW_NOTE_DRAFT_KEY)
      .then((draft) => {
        if (!mounted || !draft) return;
        titleRef.current = draft.title;
        contentRef.current = draft.content;
        setTitle(draft.title);
        setContentHtml(draft.content);
        setDraftDirty(Boolean(draft.title.trim() || hasMeaningfulRichContent(draft.content)));
      })
      .finally(() => {
        if (mounted) setDraftReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const { flushDraft, discardDraft } = useNoteDraftPersistence({
    draftKey: NEW_NOTE_DRAFT_KEY,
    title,
    content: contentHtml,
    enabled: draftReady,
    dirty: draftDirty,
  });

  const flushBeforeAndroidBack = useCallback(() => {
    void flushDraft();
  }, [flushDraft]);
  useAndroidNotesBackHandler(flushBeforeAndroidBack);

  const checkAuth = useCallback(async () => {
    try {
      if (!nostrService.isAuthenticated()) {
        const session = await nostrService.restoreSession();
        if (!session) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
      }
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkAuth();
    }, [checkAuth])
  );

  const handleContentChange = useCallback((html: string) => {
    if (html === contentRef.current) return;
    contentRef.current = html;
    setContentHtml(html);
    if (draftReady) setDraftDirty(true);
  }, [draftReady]);

  const handleTitleChange = useCallback((nextTitle: string) => {
    if (nextTitle === titleRef.current) return;
    titleRef.current = nextTitle;
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
    try {
      const latestContent = (await editorRef.current?.getContent()) ?? contentHtml;
      contentRef.current = latestContent;
      setContentHtml(latestContent);

      if (!hasMeaningfulRichContent(latestContent) && (!title || !title.trim())) {
        await discardDraft();
        router.dismissTo('/(tabs)');
        return;
      }

      if (!nostrService.isAuthenticated()) {
        showAppAlert(t('alerts.session.title'), t('alerts.session.message'));
        return;
      }

      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const finalTitle = title.trim() || t('editor.defaultTitle');

      const note: Note = {
        id: Date.now().toString(),
        title: finalTitle,
        content: latestContent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const eventId = await nostrService.publishNote(note);

      if (eventId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await discardDraft();
        titleRef.current = '';
        contentRef.current = '';
        setTitle('');
        setContentHtml('');
        editorRef.current?.setContent('');

        // The note has been saved and the current scene is still active: this is
        // the stable moment recommended by the native review APIs.
        dismissEditor();
        try {
          await maybeRequestStoreReviewAfterNoteCreated();
        } catch (error) {
          // A review failure must never interrupt the normal note-save flow.
          console.warn('Store review request failed:', error);
        }

        router.dismissTo('/(tabs)');
      } else {
        throw new Error('Yayınlama hatası');
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAppAlert(t('common.error'), t('alerts.noteSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draftReady) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <LinearGradient
          colors={[colors.background, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Animated.View
            entering={FadeIn.duration(600).delay(100)}
            style={styles.welcomeContent}
          >
            <View style={styles.lockIconContainer}>
              <View style={[styles.lockIconBg, { backgroundColor: colors.iconBackground }]}>
                <PenLine size={48} color={colors.accent} strokeWidth={2} />
              </View>
            </View>

            <Text style={[styles.welcomeTitle, { color: colors.text }]}>{t('auth.createEncryptedNote')}</Text>
            <Text style={[styles.welcomeDescription, { color: colors.textSecondary }]}>
              {t('auth.createEncryptedNoteDesc')}
            </Text>

            <TouchableOpacity
              style={styles.welcomeButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/settings');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#0A84FF', '#0070E0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.welcomeButtonGradient}
              >
                <Text style={styles.welcomeButtonText}>{t('auth.signInButton')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </SafeAreaBox>
    );
  }

  const content = (
    <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>

      <Pressable style={[styles.header, { paddingTop: headerTopPadding, backgroundColor: colors.background, borderBottomColor: colors.divider }]} onPress={dismissEditor}>
        <TouchableOpacity
          style={[styles.headerBtnLeft, { backgroundColor: colors.elevatedMuted }]}
          onPress={() => {
            router.dismissTo('/(tabs)');
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('editor.newTitle')}</Text>
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
            placeholder={t('editor.placeholder')}
            onChange={handleContentChange}
            onUploadProgress={setUploadProgress}
          />
        </View>
      </KeyboardAvoidingView>

    </SafeAreaBox>
  );

  return content;
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
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  welcomeContent: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : 400,
    alignItems: 'center',
  },
  lockIconContainer: {
    marginBottom: 32,
  },
  lockIconBg: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { borderCurve: 'continuous' as any },
    }),
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 17,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: -0.2,
    marginBottom: 40,
  },
  welcomeButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { borderCurve: 'continuous' as any },
    }),
  },
  welcomeButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  welcomeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
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
