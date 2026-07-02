import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { PenLine, Play, Table2, FileText } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { RichTextRenderer } from './RichTextRenderer';
import type { Note } from '@/types/note';
import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

interface NoteCardProps {
  note: Note;
  index: number;
  onPress: (note: Note) => void;
  onLongPress: (note: Note) => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type PreviewAsset =
  | { type: 'image'; uri: string }
  | { type: 'drawing'; uri?: string }
  | { type: 'video'; uri?: string }
  | { type: 'table' }
  | { type: 'file'; uri?: string; title?: string };

export function NoteCard({ note, index, onPress, onLongPress }: NoteCardProps) {
  const { t, language } = useI18n();
  const { colors } = useAppTheme();
  const scale = useSharedValue(1);
  const { width } = useWindowDimensions();

  const entryDelay = Math.min(index * 60, 300);
  const previewAsset = useMemo(() => getFirstPreviewAsset(note.content), [note.content]);
  const compact = width < 380;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(note);
  }, [note, onPress]);

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress(note);
  }, [note, onLongPress]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const mins = Math.floor(diffInMs / (1000 * 60));
      if (mins < 1) {
        return t('common.justNow');
      }
      return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-Math.max(mins, 1), 'minute');
    }
    if (diffInHours < 24) {
      return date.toLocaleTimeString(language, {
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    if (diffInHours < 168) {
      return date.toLocaleDateString(language, { weekday: 'short' });
    }
    return date.toLocaleDateString(language, {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Animated.View entering={FadeInDown.delay(entryDelay).springify().damping(20).stiffness(200)}>
      <AnimatedTouchable
        style={[styles.card, { borderColor: colors.border }, cardStyle]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={1}
        onPressIn={() => {
          scale.set(withSpring(0.97, { damping: 15, stiffness: 400 }));
        }}
        onPressOut={() => {
          scale.set(withSpring(1, { damping: 15, stiffness: 400 }));
        }}
        delayLongPress={400}
      >
      <BlurView
        intensity={20}
        tint={colors.blurTint}
        style={[styles.blur, { backgroundColor: colors.elevated }]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {note.title || t('common.untitledNote')}
          </Text>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(note.updatedAt)}</Text>
        </View>

        <View style={styles.bodyRow}>
          <View style={styles.previewColumn}>
            <View style={styles.contentPreview}>
              <RichTextRenderer content={note.content} previewMode />
            </View>
          </View>

          {previewAsset && (
            <ContentThumbnail asset={previewAsset} compact={compact} />
          )}
        </View>

        <View style={styles.fadeOverlay} />
      </BlurView>
      </AnimatedTouchable>
    </Animated.View>
  );
}

function ContentThumbnail({ asset, compact }: { asset: PreviewAsset; compact: boolean }) {
  const { colors, scheme } = useAppTheme();
  const frameStyle = [styles.thumbnail, compact && styles.thumbnailCompact];
  const themedFrame = [
    frameStyle,
    { backgroundColor: colors.iconBackground, borderColor: colors.border },
  ];

  if (asset.type === 'drawing' && asset.uri) {
    return (
      <View style={[themedFrame, styles.drawingThumbnail]}>
        <Image source={{ uri: asset.uri }} style={[styles.thumbnailImage, { backgroundColor: scheme === 'light' ? '#FFFFFF' : '#111113' }]} resizeMode="cover" />
      </View>
    );
  }

  if (asset.type === 'image' && asset.uri) {
    return (
      <View style={frameStyle}>
        <Image source={{ uri: asset.uri }} style={styles.thumbnailImage} resizeMode="cover" />
      </View>
    );
  }

  if (asset.type === 'video' && asset.uri) {
    return <VideoThumbnail uri={asset.uri} frameStyle={frameStyle} />;
  }

  if (asset.type === 'video') {
    return (
      <View style={[frameStyle, styles.videoThumbnail]}>
        <View style={styles.playCircle}>
          <Play size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.4} />
        </View>
      </View>
    );
  }

  if (asset.type === 'table') {
    return (
      <View style={[themedFrame, styles.tableThumbnail]}>
        <Table2 size={16} color="#0A84FF" strokeWidth={2.3} />
        <View style={styles.tableGrid}>
          {Array.from({ length: 3 }).map((_, row) => (
            <View key={row} style={styles.tableGridRow}>
              {Array.from({ length: 3 }).map((__, col) => (
                <View key={col} style={styles.tableGridCell} />
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (asset.type === 'file') {
    return (
      <View style={[themedFrame, styles.fileThumbnail]}>
        <FileText size={18} color="#0A84FF" strokeWidth={2.4} />
      </View>
    );
  }

  return (
    <View style={[themedFrame, styles.drawingThumbnail]}>
      <PenLine size={20} color="#0A84FF" strokeWidth={2.4} />
    </View>
  );
}

function getFirstPreviewAsset(content: string): PreviewAsset | null {
  const candidates: { index: number; asset: PreviewAsset }[] = [];

  const pushMatch = (match: RegExpExecArray | null, asset: PreviewAsset | null) => {
    if (!match || !asset || match.index < 0) return;
    candidates.push({ index: match.index, asset });
  };

  const drawingImage = /<figure[^>]*(?:data-media-type=["']drawing["']|class=["'][^"']*drawing-card[^"']*["'])[\s\S]*?<img[^>]*class=["'][^"']*drawing-image[^"']*["'][^>]*src=["']([^"']+)["']/i.exec(content);
  pushMatch(drawingImage, drawingImage?.[1] ? { type: 'drawing', uri: decodeHtmlAttr(drawingImage[1]) } : null);

  const drawingCard = /<figure[^>]*(?:data-media-type=["']drawing["']|class=["'][^"']*drawing-card[^"']*["'])/i.exec(content);
  pushMatch(drawingCard, { type: 'drawing' });

  const image = /<figure[^>]*data-media-type=["']image["'][\s\S]*?<img[^>]*src=["']([^"']+)["']|<img[^>]*src=["']([^"']+)["']/i.exec(content);
  const imageUri = image?.[1] || image?.[2];
  pushMatch(image, imageUri ? { type: 'image', uri: decodeHtmlAttr(imageUri) } : null);

  const video = /<figure[^>]*data-media-type=["']video["'][\s\S]*?<video[^>]*src=["']([^"']+)["']|<video[^>]*src=["']([^"']+)["']|<a[^>]*href=["']([^"']+\.(?:mp4|mov|webm))["'][^>]*>/i.exec(content);
  pushMatch(video, { type: 'video', uri: video?.[1] || video?.[2] || video?.[3] });

  const table = /<div[^>]*class=["'][^"']*note-table-shell[^"']*["']|<table[^>]*class=["'][^"']*note-table[^"']*["']|<table[\s>]/i.exec(content);
  pushMatch(table, { type: 'table' });

  const file = /<figure[^>]*data-media-type=["']pdf["']|<a[^>]*class=["'][^"']*file-card[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i.exec(content);
  pushMatch(file, { type: 'file', uri: file?.[1] });

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.index - b.index)[0].asset;
}

function VideoThumbnail({ uri, frameStyle }: { uri: string; frameStyle: any }) {
  const player = useVideoPlayer(uri, (p) => {
    p.pause();
    p.muted = true;
  });

  return (
    <View style={frameStyle}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls={false} contentFit="cover" />
    </View>
  );
}

function decodeHtmlAttr(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        borderCurve: 'continuous' as any,
      },
    }),
  },
  blur: {
    padding: 18,
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderRadius: 19,
    ...Platform.select({
      ios: {
        borderCurve: 'continuous' as any,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 12,
    letterSpacing: -0.2,
  },
  date: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 80,
  },
  previewColumn: {
    flex: 1,
    minWidth: 0,
  },
  contentPreview: {
    maxHeight: 64,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    ...Platform.select({
      ios: {
        borderCurve: 'continuous' as any,
      },
    }),
  },
  fileThumbnail: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.2)',
  },
  thumbnailCompact: {
    width: 64,
    height: 64,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#050505',
  },
  thumbnailBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,132,255,0.88)',
  },
  videoThumbnail: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111113',
  },
  playCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,132,255,0.9)',
  },
  tableThumbnail: {
    padding: 7,
    gap: 5,
    backgroundColor: 'rgba(10,132,255,0.09)',
  },
  tableGrid: {
    flex: 1,
    gap: 2,
  },
  tableGridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  tableGridCell: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: 'rgba(10,132,255,0.24)',
  },
  drawingThumbnail: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  fadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,

  },
});
