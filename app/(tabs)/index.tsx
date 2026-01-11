import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
  Modal,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { RefreshCw, Edit2, Trash2, X, Lock } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { nostrService } from '@/lib/nostr';
import type { Note } from '@/types/note';
import { router } from 'expo-router';
import { RichTextRenderer } from '@/components/RichTextRenderer';
import { CeteleLogo } from '@/components/CeteleLogo';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const errorFadeAnim = useRef(new Animated.Value(0)).current;
  const emptyFadeAnim = useRef(new Animated.Value(0)).current;
  const menuFadeAnim = useRef(new Animated.Value(0)).current;
  const menuScaleAnim = useRef(new Animated.Value(0.9)).current;
  const welcomeFadeAnim = useRef(new Animated.Value(0)).current;
  const welcomeSlideAnim = useRef(new Animated.Value(30)).current;

  const loadNotes = useCallback(async () => {
    try {
      setError(null);

      if (!nostrService.isAuthenticated()) {
        setNotes([]);
        const session = await nostrService.restoreSession();
        if (!session) {
          setIsAuthenticated(false);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      setIsAuthenticated(true);
      const fetchedNotes = await nostrService.fetchNotes();
      setNotes(fetchedNotes);
    } catch (err) {
      setError('Notlar yüklenemedi');
      setNotes([]);
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!isAuthenticated && !loading) {
      Animated.parallel([
        Animated.timing(welcomeFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(welcomeSlideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isAuthenticated, loading]);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  useEffect(() => {
    if (error) {
      errorFadeAnim.setValue(0);
      Animated.timing(errorFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [error]);

  useEffect(() => {
    if (notes.length === 0 && !loading) {
      emptyFadeAnim.setValue(0);
      Animated.timing(emptyFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [notes.length, loading]);

  useEffect(() => {
    if (menuVisible) {
      menuFadeAnim.setValue(0);
      menuScaleAnim.setValue(0.9);
      Animated.parallel([
        Animated.timing(menuFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(menuScaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [menuVisible]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotes();
  }, [loadNotes]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('tr-TR', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (diffInHours < 168) {
      const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      return days[date.getDay()];
    } else {
      return date.toLocaleDateString('tr-TR', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const openMenu = (note: Note) => {
    setSelectedNote(note);
    setMenuVisible(true);
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setTimeout(() => setSelectedNote(null), 200);
  };

  const handleEdit = () => {
    if (selectedNote) {
      closeMenu();
      setTimeout(() => {
        router.push(`/edit/${selectedNote.id}`);
      }, 300);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote?.id) return;

    const confirmed = Platform.OS === 'web'
      ? confirm('Bu notu silmek istediğinizden emin misiniz?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Notu Sil',
            'Bu notu silmek istediğinizden emin misiniz?',
            [
              { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Sil', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) {
      closeMenu();
      return;
    }

    setDeleting(true);
    try {
      const success = await nostrService.deleteNote(selectedNote.id);
      if (success) {
        closeMenu();
        await loadNotes();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      if (Platform.OS === 'web') {
        alert('Not silinemedi');
      } else {
        Alert.alert('Hata', 'Not silinemedi');
      }
    } finally {
      setDeleting(false);
    }
  };

  const NoteItem = ({ item, index }: { item: Note; index: number }) => {
    const noteAnim = useRef(new Animated.Value(0)).current;
    const translateYAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(noteAnim, {
          toValue: 1,
          duration: 400,
          delay: index * 50,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          delay: index * 50,
          useNativeDriver: true,
        }),
      ]).start();
    }, []);

    return (
      <AnimatedTouchable
        style={[
          styles.noteCard,
          { opacity: noteAnim, transform: [{ translateY: translateYAnim }] },
        ]}
        onPress={() => router.push(`/note/${item.id}`)}
        onLongPress={() => openMenu(item)}
        activeOpacity={0.9}>
        <BlurView intensity={20} tint="dark" style={styles.noteBlur}>
          <View style={styles.noteHeader}>
            <Text style={styles.noteTitle} numberOfLines={1}>
              {item.title || 'Başlıksız Not'}
            </Text>
            <Text style={styles.noteDate}>{formatDate(item.updatedAt)}</Text>
          </View>
          <View style={styles.noteContentContainer}>
            <RichTextRenderer content={item.content} previewMode />
          </View>
        </BlurView>
      </AnimatedTouchable>
    );
  };

  const renderNote = ({ item, index }: { item: Note; index: number }) => (
    <NoteItem item={item} index={index} />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Notlar</Text>
        </Animated.View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.loadingText}>Notlarınız yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LinearGradient
          colors={['#000000', '#0A0A0A', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}>
          <Animated.View
            style={[
              styles.welcomeContent,
              {
                opacity: welcomeFadeAnim,
                transform: [{ translateY: welcomeSlideAnim }],
              },
            ]}>
            <View style={styles.lockIconContainer}>
              <Lock size={64} color="#0A84FF" strokeWidth={2.5} />
            </View>

            <Text style={styles.welcomeTitle}>Notlarınızı Görüntüleyin</Text>
            <Text style={styles.welcomeDescription}>
              Şifreli notlarınızı görüntülemek için giriş yapmalısınız
            </Text>

            <TouchableOpacity
              style={styles.welcomeButton}
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.8}>
              <BlurView intensity={30} tint="dark" style={styles.welcomeButtonBlur}>
                <Text style={styles.welcomeButtonText}>Giriş Yap</Text>
              </BlurView>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Notlar</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadNotes}
          activeOpacity={0.8}>
          <BlurView intensity={30} tint="dark" style={styles.refreshBlur}>
            <RefreshCw size={20} color="#0A84FF" strokeWidth={2.5} />
          </BlurView>
        </TouchableOpacity>
      </Animated.View>

      {error && (
        <Animated.View
          style={[styles.errorContainer, { opacity: errorFadeAnim }]}>
          <BlurView intensity={30} tint="dark" style={styles.errorBlur}>
            <Text style={styles.errorText}>{error}</Text>
          </BlurView>
        </Animated.View>
      )}

      {notes.length === 0 ? (
        <Animated.View
          style={[styles.emptyContainer, { opacity: emptyFadeAnim }]}>
          <Text style={styles.emptyTitle}>Henüz Not Yok</Text>
          <Text style={styles.emptySubtitle}>
            İlk şifreli notunuzu oluşturmak için + sekmesine dokunun
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={(item) => item.eventId || item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0A84FF"
            />
          }
        />
      )}

      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}>
        <Pressable style={styles.modalOverlay} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menuContainer,
              {
                opacity: menuFadeAnim,
                transform: [{ scale: menuScaleAnim }],
              },
            ]}>
            <BlurView intensity={80} tint="dark" style={styles.menuBlur}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle} numberOfLines={1}>
                  {selectedNote?.title || 'Başlıksız Not'}
                </Text>
                <TouchableOpacity
                  style={styles.menuCloseButton}
                  onPress={closeMenu}
                  activeOpacity={0.8}>
                  <X size={20} color="#8E8E93" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleEdit}
                activeOpacity={0.8}>
                <View style={styles.menuIconContainer}>
                  <Edit2 size={20} color="#0A84FF" strokeWidth={2.5} />
                </View>
                <Text style={styles.menuItemText}>Düzenle</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleDelete}
                disabled={deleting}
                activeOpacity={0.8}>
                <View style={styles.menuIconContainer}>
                  {deleting ? (
                    <ActivityIndicator size="small" color="#FF453A" />
                  ) : (
                    <Trash2 size={20} color="#FF453A" strokeWidth={2.5} />
                  )}
                </View>
                <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                  {deleting ? 'Siliniyor...' : 'Sil'}
                </Text>
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
  welcomeContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  lockIconContainer: {
    marginBottom: 40,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
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
  },
  welcomeButtonBlur: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.3)',
  },
  welcomeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A84FF',
    letterSpacing: -0.2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  refreshBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  errorBlur: {
    padding: 16,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
  },
  errorText: {
    fontSize: 14,
    color: '#FF453A',
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 17,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  noteCard: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  noteBlur: {
    padding: 20,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 12,
  },
  noteDate: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  noteContentContainer: {
    maxHeight: 44,
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    overflow: 'hidden',
  },
  menuBlur: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 12,
    letterSpacing: -0.2,
  },
  menuCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  menuItemDanger: {
    color: '#FF453A',
  },
});
