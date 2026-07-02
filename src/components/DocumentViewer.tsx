import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Platform, Share, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from './WebView';
import { X, Share as ShareIcon } from 'lucide-react-native';

interface DocumentViewerProps {
  visible: boolean;
  url: string | null;
  onClose: () => void;
  title?: string;
  isPdf?: boolean;
}

export function DocumentViewer({ visible, url, onClose, title, isPdf: propIsPdf }: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  if (!visible || !url) return null;

  const isPdf = propIsPdf ?? url.toLowerCase().includes('.pdf');
  const isLocalUri = /^(file|content|blob):/i.test(url);
  const viewerUrl = (Platform.OS === 'android' && isPdf && !isLocalUri)
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
    : url;

  const handleShare = async () => {
    try {
      await Share.share({ url });
    } catch (error) {
      console.error('Error sharing document:', error);
    }
  };

  const paddingTop = Math.max(insets.top, Platform.OS === 'ios' ? 47 : StatusBar.currentHeight || 24);
  const paddingBottom = Math.max(insets.bottom, 24);

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop, paddingBottom }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconButton} onPress={onClose}>
              <X color="#FFFFFF" size={24} />
            </TouchableOpacity>

            <Text style={styles.title} numberOfLines={1}>
              {title || (isPdf ? 'PDF belgesi' : 'Belge')}
            </Text>

            <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
              <ShareIcon color="#FFFFFF" size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {loading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#0A84FF" />
              </View>
            )}
            <WebView
              source={{ uri: viewerUrl }}
              style={styles.webview}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => setLoading(false)}
              scalesPageToFit={true}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              bounces={false}
              cacheEnabled={true}
              originWhitelist={['*']}
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              allowFileAccessFromFileURLs={true}
              allowingReadAccessToURL="file://"
            />
          </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0A0A0C',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
