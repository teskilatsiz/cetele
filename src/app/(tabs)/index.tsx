import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TextInput,
  Keyboard,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  FadeIn,
  SlideInDown,
  Easing,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BlurTargetView, BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Edit2, Trash2, Lock, FileText, Search, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NostrSecurityError, nostrService } from '@/lib/nostr';
import type { Note } from '@/types/note';
import { router } from 'expo-router';
import { NoteCard } from '@/components/NoteCard';
import { useTabBarVisibility } from '@/components/TabBarVisibilityContext';
import { showAppAlert, showAppConfirm } from '@/components/AppAlertProvider';
import {
  ActionBottomSheet,
  type ActionBottomSheetRef,
  type ActionItem,
} from '@/components/ActionBottomSheet';
import { FloatingNewButton } from '@/components/FloatingNewButton';
import { useI18n } from '@/lib/i18n';
import { SafeAreaBox } from '@/components/SafeAreaBox';
import { useAppTheme } from '@/lib/theme';
import { ProgressiveBlurView } from '@/components/ProgressiveBlurView';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Note>);
function SyncingNotesState({ minHeight }: { minHeight: number }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.set(withRepeat(
      withTiming(1, {
        duration: 1600,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    ));
  }, [fill]);

  const fillStyle = useAnimatedStyle(() => ({
    height: interpolate(fill.get(), [0, 1], [0, 48]),
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      style={[styles.emptyContainer, { minHeight }]}
    >
      <View style={[styles.emptyIconBg, { backgroundColor: colors.elevatedMuted }]}>
        <View style={{ width: 48, height: 48 }}>

          <FileText size={48} color={colors.textTertiary} strokeWidth={1.5} />

          <Animated.View 
            style={[
              { position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden' }, 
              fillStyle
            ]}
          >
            <View style={{ height: 48, width: 48, position: 'absolute', bottom: 0 }}>
              <FileText size={48} color={colors.accent} strokeWidth={1.5} />
            </View>
          </Animated.View>
        </View>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('notes.syncing')}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {t('notes.syncingDesc')}
      </Text>
    </Animated.View>
  );
}

export default function NotesScreen() {
  const { t, language } = useI18n();
  const { colors, scheme } = useAppTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasSyncedOnce, setHasSyncedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); 
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const blurTargetRef = useRef<View | null>(null);

  const { width, height } = useWindowDimensions();
  const getNumColumns = (w: number) => {
    if (Platform.OS !== 'web') return 1;
    if (w >= 1200) return 4;
    if (w >= 900) return 3;
    if (w >= 768) return 2;
    return 1;
  };
  const numColumns = getNumColumns(width);

  const insets = useSafeAreaInsets();
  const loadRequestId = useRef(0);
  const notesCountRef = useRef(0);
  const { setTabBarHidden } = useTabBarVisibility();

  const scrollY = useSharedValue(0);
  const bottomSheetRef = useRef<ActionBottomSheetRef>(null);

  useEffect(() => {
    return () => setTabBarHidden(false);
  }, [setTabBarHidden]);

  useEffect(() => {
    notesCountRef.current = notes.length;
  }, [notes.length]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const lowerQuery = searchQuery.toLocaleLowerCase(language);
    return notes.filter((note) => {
      const titleMatch = note.title?.toLocaleLowerCase(language).includes(lowerQuery);
      const contentMatch = note.content.toLocaleLowerCase(language).includes(lowerQuery);
      return titleMatch || contentMatch;
    });
  }, [language, notes, searchQuery]);

  const showSignedOutState = useCallback((requestId: number) => {
    if (requestId !== loadRequestId.current) return false;
    setNotes([]);
    setError(null);
    setHasSyncedOnce(false);
    setIsAuthenticated(false);
    setLoading(false);
    setRefreshing(false);
    setSyncing(false);
    setSelectedNote(null);
    setTabBarHidden(false);
    return true;
  }, [setTabBarHidden]);

  const loadNotes = useCallback(async (options?: { userInitiated?: boolean }) => {
    const requestId = loadRequestId.current + 1;
    loadRequestId.current = requestId;
    const shouldShowInitialSync = !options?.userInitiated && notesCountRef.current === 0;

    try {
      setError(null);
      if (options?.userInitiated) {
        setRefreshing(true);
      }
      if (shouldShowInitialSync) {
        setLoading(true);
        setSyncing(true);
        setHasSyncedOnce(false);
      }

      if (!nostrService.isAuthenticated()) {
        const session = await nostrService.restoreSession();
        if (!session) {
          showSignedOutState(requestId);
          return;
        }
      }

      if (requestId !== loadRequestId.current) return;
      setIsAuthenticated(true);

      const cachedNotes = await nostrService.getCachedNotes();
      if (requestId !== loadRequestId.current) return;
      setNotes(cachedNotes);
      if (cachedNotes.length === 0) {
        setHasSyncedOnce(false);
      }
      setLoading(false);
      setSyncing(true);

      if (!nostrService.isAuthenticated()) {
        showSignedOutState(requestId);
        return;
      }

      const fetchedNotes = await nostrService.fetchNotes();
      if (requestId !== loadRequestId.current) return;
      setNotes(fetchedNotes);
      setHasSyncedOnce(true);
    } catch (err) {
      if (requestId !== loadRequestId.current) return;
      if (
        err instanceof NostrSecurityError ||
        (err instanceof Error && err.message === 'Not authenticated')
      ) {
        showSignedOutState(requestId);
        return;
      }
      setError(t('notes.syncFailed'));
      if (requestId === loadRequestId.current) {
        setHasSyncedOnce(true);
      }
      console.error(err);
    } finally {
      if (requestId !== loadRequestId.current) return;
      setLoading(false);
      setRefreshing(false);
      setSyncing(false);
    }
  }, [showSignedOutState, t]);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
      return () => {
        loadRequestId.current += 1;
      };
    }, [loadNotes])
  );

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadNotes({ userInitiated: true });
  }, [loadNotes]);

  const scrollHandler = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.set(event.nativeEvent.contentOffset.y);
    },
    [scrollY]
  );

  const headerBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 50], [0, 1], Extrapolation.CLAMP),
  }));

  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 30], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.get(), [0, 50], [0, -10], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.get(), [0, 50], [1, 0.85], Extrapolation.CLAMP) },
    ],
  }));

  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [25, 50], [0, 1], Extrapolation.CLAMP),
  }));

  const handleNotePress = useCallback((note: Note) => {
    router.push(`/note/${note.id}`);
  }, []);

  const handleNoteLongPress = useCallback((note: Note) => {
    setSelectedNote(note);
    setTabBarHidden(true);
    bottomSheetRef.current?.open();
  }, [setTabBarHidden]);

  const handleEdit = useCallback(() => {
    if (selectedNote) {
      bottomSheetRef.current?.close();
      setTimeout(() => {
        router.push(`/edit/${selectedNote.id}`);
      }, 300);
    }
  }, [selectedNote]);

  const handleDelete = useCallback(async () => {
    if (!selectedNote?.id) return;

    const confirmed = await showAppConfirm({
      title: t('notes.deleteTitle'),
      message: t('notes.deleteMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      destructive: true,
    });

    if (!confirmed) return;

    setDeleting(true);
    try {
      const success = await nostrService.deleteNote(selectedNote.id);
      if (success) {
        await loadNotes();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      showAppAlert(t('common.error'), t('alerts.noteDeleteFailed'));
    } finally {
      setDeleting(false);
    }
  }, [loadNotes, selectedNote, t]);

  const bottomSheetActions: ActionItem[] = [
    {
      id: 'edit',
      label: t('common.edit'),
      icon: <Edit2 size={20} color="#0A84FF" strokeWidth={2.5} />,
      onPress: handleEdit,
    },
    {
      id: 'delete',
      label: deleting ? t('notes.deleting') : t('common.delete'),
      icon: deleting
        ? <ActivityIndicator size="small" color="#FF453A" />
        : <Trash2 size={20} color="#FF453A" strokeWidth={2.5} />,
      destructive: true,
      onPress: handleDelete,
    },
  ];

  const renderNote = useCallback(
    ({ item, index }: { item: Note; index: number }) => (
      <View style={{ flex: 1, maxWidth: numColumns > 1 ? `${100 / numColumns}%` : '100%', paddingHorizontal: numColumns > 1 ? 8 : 0 }}>
        <NoteCard
          note={item}
          index={index}
          onPress={handleNotePress}
          onLongPress={handleNoteLongPress}
        />
      </View>
    ),
    [handleNotePress, handleNoteLongPress, numColumns]
  );

  const showSyncingEmpty = notes.length === 0 && (syncing || !hasSyncedOnce);
  const emptyStateMinHeight = Math.max(420, height - insets.top - 150);

  if (loading || isAuthenticated === null) {
    return (
      <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <SyncingNotesState minHeight={height - insets.top} />
      </SafeAreaBox>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaBox
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={Platform.OS === 'android' ? ['top'] : ['top', 'bottom']}
      >
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
                <Lock size={48} color={colors.accent} strokeWidth={2} />
              </View>
            </View>

            <Text style={[styles.welcomeTitle, { color: colors.text }]}>{t('notes.signInRequiredTitle')}</Text>
            <Text style={[styles.welcomeDescription, { color: colors.textSecondary }]}>
              {t('notes.signInRequiredDesc')}
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

  return (
    <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>

      {error && (
        <Animated.View
          entering={SlideInDown.duration(300)}
          style={styles.errorContainer}
        >
          <BlurView intensity={30} tint={colors.blurTint} style={styles.errorBlur}>
            <Text style={styles.errorText}>{error}</Text>
          </BlurView>
        </Animated.View>
      )}

      <View style={{ flex: 1 }}>
        <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
          <AnimatedFlatList
            key={numColumns}
            numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: 16 } : undefined}
          data={filteredNotes}
          extraData={[isSearchActive, searchQuery]}
          renderItem={renderNote}
          keyExtractor={(item: any) => item.eventId || item.id}
          contentContainerStyle={[
            styles.listContainer,
            numColumns > 1 && { paddingHorizontal: 12 },
            filteredNotes.length === 0 && { flexGrow: 1 },
          ]}
          ListHeaderComponent={
            <View style={styles.headerRow}>
              {!isSearchActive && !searchQuery ? (
                <>
                  <Animated.View pointerEvents="none" style={[styles.largeTitleContainer, largeTitleStyle]}>
                    <Text style={[styles.largeTitle, { color: colors.text }]}>{t('common.notes')}</Text>
                  </Animated.View>
                  <Pressable
                    style={({ pressed, hovered }: any) => [
                      styles.headerSearchButton,
                      { backgroundColor: colors.iconBackground },
                      { opacity: pressed ? 0.7 : 1 },
                      hovered && { backgroundColor: colors.iconBackground },
                      Platform.OS === 'web' && { cursor: 'pointer', outlineStyle: 'none' } as any
                    ]}
                    onPress={() => {
                      setIsSearchActive(true);
                    }}
                  >
                    <View pointerEvents="none">
                      <Search size={22} color={colors.text} strokeWidth={2.5} />
                    </View>
                  </Pressable>
                </>
              ) : (
                <Animated.View style={[styles.nativeSearchTitleContainer, largeTitleStyle]}>
                  <TextInput
                    ref={searchInputRef}
                    style={[
                      styles.nativeSearchTitleInput,
                      { color: colors.text },
                      width < 360 && styles.nativeSearchTitleInputCompact,
                      Platform.OS === 'web' && { outlineStyle: 'none' } as any
                    ]}
                    placeholder={t('common.searchNotes')}
                    placeholderTextColor={colors.placeholder}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus={true}
                    returnKeyType="search"
                    keyboardAppearance={scheme}
                    clearButtonMode="never"
                    selectionColor={colors.accent}
                  />
                  <Pressable
                    onPress={() => {
                      setSearchQuery('');
                      setIsSearchActive(false);
                      Keyboard.dismiss();
                    }}
                    style={({ pressed, hovered }: any) => [
                      styles.nativeSearchCloseButton,
                      { backgroundColor: colors.iconBackground, opacity: pressed ? 0.7 : 1 },
                      hovered && { backgroundColor: colors.iconBackground },
                      Platform.OS === 'web' && { cursor: 'pointer', outlineStyle: 'none' } as any
                    ]}
                  >
                    <View pointerEvents="none">
                      <X size={21} color={colors.text} strokeWidth={2.5} />
                    </View>
                  </Pressable>
                </Animated.View>
              )}
            </View>
          }
          ListEmptyComponent={
            showSyncingEmpty ? (
              <SyncingNotesState minHeight={emptyStateMinHeight} />
            ) : (
            <Animated.View
              entering={FadeIn.duration(400).delay(120)}
              style={[styles.emptyContainer, { minHeight: Math.max(420, height - insets.top - 150) }]}
            >
              <View style={[styles.emptyIconBg, { backgroundColor: colors.elevatedMuted }]}>
                {syncing && !hasSyncedOnce ? (
                  <ActivityIndicator size="large" color={colors.accent} />
                ) : (
                  <FileText size={48} color={colors.textTertiary} strokeWidth={1.5} />
                )}
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {searchQuery.length > 0 ? t('notes.noResults') : (syncing && !hasSyncedOnce ? t('notes.syncing') : t('notes.empty'))}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {searchQuery.length > 0
                  ? t('notes.emptySearchDesc')
                  : (syncing && !hasSyncedOnce
                    ? t('notes.syncingDesc')
                    : t('notes.emptyDesc'))}
              </Text>
            </Animated.View>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent, colors.accent, colors.accent]}
              progressBackgroundColor={colors.background}
              progressViewOffset={Math.max(insets.top + 72, 96)}
              title={refreshing ? t('notes.syncing') : ''}
              titleColor={colors.accent}
            />
          }
          showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          />
        </BlurTargetView>
      </View>

      <Animated.View pointerEvents="none" style={[styles.fixedHeader, { height: 56 + insets.top, paddingTop: insets.top }]}>
        <Animated.View style={[StyleSheet.absoluteFill, headerBlurStyle]}>
          <ProgressiveBlurView
            intensity={20}
            tint={colors.blurTint}
            blurTarget={blurTargetRef}
            fallbackColor={colors.header}
            style={{ bottom: -64 }}
          />
        </Animated.View>

        <View style={styles.headerContent}>
          <Animated.Text style={[styles.compactTitle, { color: colors.text }, compactTitleStyle]} pointerEvents="none">
            {t('common.notes')}
          </Animated.Text>
        </View>
      </Animated.View>

      {isAuthenticated && !selectedNote && <FloatingNewButton />}

      <ActionBottomSheet
        ref={bottomSheetRef}
        title={selectedNote?.title || t('common.untitledNote')}
        actions={bottomSheetActions}
        onClose={() => {
          setSelectedNote(null);
          setTabBarHidden(false);
        }}
      />
    </SafeAreaBox>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  blurTarget: {
    flex: 1,
  },
  headerContent: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  compactTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  headerSearchButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  cancelSearchButton: {
    paddingVertical: 8,
    paddingLeft: 12,
  },
  cancelSearchText: {
    color: '#0A84FF',
    fontSize: 17,
  },

  largeTitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    transformOrigin: 'left center',
  },
  largeTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  nativeSearchTitleContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 0,
    paddingTop: 4,
    paddingBottom: 12,
    transformOrigin: 'left center',
  },
  nativeSearchTitleInput: {
    flex: 1,
    minWidth: 0,
    height: 54,
    padding: 0,
    margin: 0,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  nativeSearchTitleInputCompact: {
    fontSize: 30,
    lineHeight: 38,
  },
  nativeSearchCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    ...Platform.select({
      ios: { borderCurve: 'continuous' as any },
    }),
  },


  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loadingSubtext: {
    maxWidth: 280,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 21,
  },

  errorContainer: {
    marginHorizontal: 20,
    marginTop: 56,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  errorBlur: {
    padding: 16,
    backgroundColor: 'rgba(255, 69, 58, 0.12)',
  },
  errorText: {
    fontSize: 14,
    color: '#FF453A',
    textAlign: 'center',
    fontWeight: '600',
  },

  emptyContainer: {
    flex: 1,
    minHeight: 420,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconBg: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: { borderCurve: 'continuous' as any },
    }),
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.1,
  },

  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  welcomeContent: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : 400,
    alignItems: 'center',
    paddingHorizontal: 24,
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
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    maxWidth: '100%',
    flexShrink: 1,
  },
  welcomeDescription: {
    fontSize: 17,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
    maxWidth: '100%',
  },
  welcomeButton: {
    width: '100%',
    maxWidth: 320,
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
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Platform.select({
      ios: { borderCurve: 'continuous' as any },
    }),
  },
  searchBarFocused: {
    borderColor: 'rgba(10, 132, 255, 0.5)',
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#FFFFFF',
    height: '100%',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any),
  },
  clearButton: {
    marginLeft: 8,
  },
  clearIconBg: {
    backgroundColor: '#8E8E93',
    borderRadius: 10,
    padding: 3,
  },
});
