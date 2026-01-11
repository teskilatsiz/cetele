import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Edit, Trash2, Clock, Calendar } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { nostrService } from '@/lib/nostr';
import type { Note } from '@/types/note';
import { RichTextRenderer } from '@/components/RichTextRenderer';

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadNote();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [id]);

  const loadNote = async () => {
    try {
      const notes = await nostrService.fetchNotes();
      const foundNote = notes.find((n) => n.id === id);
      if (foundNote) {
        setNote(foundNote);
      }
    } catch (error) {
      console.error('Error loading note:', error);
      if (Platform.OS === 'web') {
        alert('Not yüklenemedi');
      } else {
        Alert.alert('Hata', 'Not yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!note?.id) return;

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

    if (!confirmed) return;

    setDeleting(true);
    try {
      const success = await nostrService.deleteNote(note.id);
      if (success) {
        router.back();
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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('tr-TR', {
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

    if (diffInMinutes < 1) return 'Az önce';
    if (diffInMinutes < 60) return `${diffInMinutes} dakika önce`;
    if (diffInHours < 24) return `${diffInHours} saat önce`;
    if (diffInDays < 7) return `${diffInDays} gün önce`;
    return formatDate(timestamp);
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.loadingText}>Not yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!note) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Not bulunamadı</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}>
            <Text style={styles.backButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.8}>
          <BlurView intensity={30} tint="dark" style={styles.headerButtonBlur}>
            <ArrowLeft size={22} color="#FFFFFF" strokeWidth={2.5} />
          </BlurView>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push(`/edit/${id}`)}
            activeOpacity={0.8}>
            <BlurView intensity={30} tint="dark" style={styles.headerButtonBlur}>
              <Edit size={20} color="#0A84FF" strokeWidth={2.5} />
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.8}>
            <BlurView intensity={30} tint="dark" style={styles.headerButtonBlur}>
              {deleting ? (
                <ActivityIndicator size="small" color="#FF453A" />
              ) : (
                <Trash2 size={20} color="#FF453A" strokeWidth={2.5} />
              )}
            </BlurView>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}>
          <View style={styles.contentSection}>
            <Text style={styles.title}>{note.title || 'Başlıksız Not'}</Text>

            <View style={styles.metaContainer}>
              <View style={styles.metaItem}>
                <Calendar size={14} color="#8E8E93" strokeWidth={2.5} />
                <Text style={styles.metaText}>
                  {formatDate(note.createdAt)}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Clock size={14} color="#8E8E93" strokeWidth={2.5} />
                <Text style={styles.metaText}>
                  {formatRelativeTime(note.updatedAt)}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <RichTextRenderer content={note.content} />
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  headerButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
  },
});
