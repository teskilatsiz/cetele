import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { 
  ChevronLeft, 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Strikethrough,
  Underline,
  Link,
  Pilcrow,
  Hand // El ikonu
} from 'lucide-react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { nostrService } from '@/lib/nostr';
import type { Note } from '@/types/note';
import { router } from 'expo-router';

const THEME_COLOR = '#0A84FF';

export default function NewNoteScreen() {
  const richText = useRef<RichEditor>(null);
  const titleInputRef = useRef<TextInput>(null);
  const linkUrlRef = useRef<TextInput>(null);

  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const handOpacity = useRef(new Animated.Value(0)).current;
  const handTranslateX = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      handOpacity.setValue(0);
      handTranslateX.setValue(0);

      const swipeAnimation = Animated.sequence([
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(handOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(handTranslateX, { toValue: 0, duration: 0, useNativeDriver: true })
        ]),
        Animated.timing(handTranslateX, {
          toValue: -60,
          duration: 1200,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true
        }),
        Animated.timing(handOpacity, { toValue: 0, duration: 500, useNativeDriver: true })
      ]);
      const animation = Animated.loop(swipeAnimation, { iterations: 2 });
      animation.start();

      return () => {
        animation.stop();
      };
    }, [])
  );

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

  const handleAddLink = () => {
    Keyboard.dismiss();
    setLinkUrl('');
    setLinkText('');
    setLinkModalVisible(true);
    
    setTimeout(() => {
        linkUrlRef.current?.focus();
    }, 100);
  };

  const saveLink = () => {
    if (!linkUrl.trim()) {
        Alert.alert('Eksik Bilgi', 'Lütfen bir bağlantı adresi (URL) girin.');
        return;
    }

    let finalUrl = linkUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
    }

    richText.current?.insertLink(linkText.trim(), finalUrl);
    closeLinkModal();
  };

  const closeLinkModal = () => {
    setLinkModalVisible(false);
    setTimeout(() => {
        richText.current?.focusContent();
    }, 300);
  };

  const handleSave = async () => {
    try {
      const strippedContent = contentHtml.replace(/<[^>]+>/g, '').trim();

      if ((!strippedContent || strippedContent === '') && (!title || title.trim() === '')) {
        router.back();
        return;
      }

      if (!nostrService.isAuthenticated()) {
        Alert.alert('Oturum Hatası', 'Lütfen giriş yapın.');
        return;
      }

      setSaving(true);
      const finalTitle = title.trim() || 'Yeni Not';

      const note: Note = {
        id: Date.now().toString(),
        title: finalTitle,
        content: contentHtml, 
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const eventId = await nostrService.publishNote(note);

      if (eventId) {
        setTitle('');
        setContentHtml('');
        router.back();
      } else {
        throw new Error('Yayınlama hatası');
      }
    } catch (error) {
      Alert.alert('Hata', 'Not kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{color:'white', fontSize: 16}}>Lütfen giriş yapınız.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerBtnLeft} 
          onPress={() => router.back()}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        >
          <ChevronLeft size={28} color={THEME_COLOR} />
        </TouchableOpacity>

        <View style={styles.headerToolbarContainer}>
            <RichToolbar
                editor={richText}
                selectedIconTint={THEME_COLOR}
                iconTint="#FFFFFF"
                style={styles.richToolbar} 
                flatContainerStyle={styles.flatToolbar}
                onPressAddLink={handleAddLink}
                actions={[
                    actions.setParagraph,
                    actions.heading1,
                    actions.heading2,
                    'divider1',
                    actions.setBold,
                    actions.setItalic,
                    actions.setUnderline,
                    actions.setStrikethrough,
                    'divider2',
                    actions.insertBulletsList,
                    actions.insertOrderedList,
                    actions.insertLink,
                ]}
                iconMap={{
                    [actions.setParagraph]: ({tintColor}) => <Pilcrow size={20} color={tintColor} />,
                    [actions.heading1]: () => <Heading1 size={20} color="#FFF" />,
                    [actions.heading2]: () => <Heading2 size={20} color="#FFF" />,
                    [actions.setBold]: ({tintColor}) => <Bold size={20} color={tintColor} />,
                    [actions.setItalic]: ({tintColor}) => <Italic size={20} color={tintColor} />,
                    [actions.setUnderline]: ({tintColor}) => <Underline size={20} color={tintColor} />,
                    [actions.setStrikethrough]: ({tintColor}) => <Strikethrough size={20} color={tintColor} />,
                    [actions.insertBulletsList]: ({tintColor}) => <List size={20} color={tintColor} />,
                    [actions.insertOrderedList]: ({tintColor}) => <ListOrdered size={20} color={tintColor} />,
                    [actions.insertLink]: ({tintColor}) => <Link size={20} color={tintColor} />,
                }}
            />

            <Animated.View 
              style={[
                styles.swipeHintContainer,
                { 
                  opacity: handOpacity,
                  transform: [{ translateX: handTranslateX }] 
                }
              ]}
              pointerEvents="none"
            >
              <Hand size={24} color={THEME_COLOR} strokeWidth={2} style={styles.handIcon} />
            </Animated.View>
        </View>

        <TouchableOpacity 
          style={styles.headerBtnRight} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={THEME_COLOR} />
          ) : (
            <Text style={styles.headerBtnTextAction}>Bitti</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.contentContainer}>
            <View style={styles.titleWrapper}>
                <TextInput
                    ref={titleInputRef}
                    style={styles.inputTitle}
                    placeholder="Başlık"
                    placeholderTextColor="#636366"
                    value={title}
                    onChangeText={setTitle}
                    returnKeyType="next"
                    onSubmitEditing={() => richText.current?.focusContent()} 
                />
            </View>

            <View style={styles.editorWrapper}>
                <RichEditor
                    ref={richText}
                    onChange={setContentHtml}
                    placeholder="Yazmaya başlayın..."
                    androidHardwareAccelerationDisabled={true}
                    style={styles.richEditor}
                    initialHeight={400} 
                    useContainer={true}
                    onFocus={() => titleInputRef.current?.blur()}
                    editorStyle={{
                        backgroundColor: '#000000',
                        color: '#FFFFFF',
                        placeholderColor: '#636366',
                        caretColor: THEME_COLOR,
                        contentCSSText: `
                            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu; 
                            font-size: 17px; 
                            line-height: 24px; 
                            background-color: #000000; 
                            color: #FFFFFF;
                            min-height: 100vh;
                            padding-left: 10px;
                            padding-right: 10px;
                            a { color: ${THEME_COLOR}; text-decoration: underline; }
                        `
                    }}
                />
            </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={linkModalVisible}
        onRequestClose={closeLinkModal}
      >
        <TouchableWithoutFeedback onPress={closeLinkModal}>
            <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Bağlantı Ekle</Text>
                        
                        <Text style={styles.label}>URL Adresi</Text>
                        <TextInput
                            ref={linkUrlRef}
                            style={styles.modalInput}
                            placeholder="https://ornek.com"
                            placeholderTextColor="#636366"
                            value={linkUrl}
                            onChangeText={setLinkUrl}
                            keyboardType="url"
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="next"
                        />
                        
                        <Text style={styles.label}>Görüntülenecek Metin</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Link Metni (İsteğe bağlı)"
                            placeholderTextColor="#636366"
                            value={linkText}
                            onChangeText={setLinkText}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={closeLinkModal}>
                                <Text style={styles.modalBtnTextCancel}>Vazgeç</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnAdd]} onPress={saveLink}>
                                <Text style={styles.modalBtnTextAdd}>Ekle</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </View>
        </TouchableWithoutFeedback>
      </Modal>

    </SafeAreaView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    height: 50,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1C1C1E',
    backgroundColor: '#000000',
    zIndex: 10,
  },
  headerBtnLeft: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  headerToolbarContainer: {
    flex: 1, 
    height: 40,
    justifyContent: 'center',
    marginHorizontal: 4,
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
  },
  richToolbar: {
    backgroundColor: '#000000',
    height: 40,
    borderBottomWidth: 0,
    borderTopWidth: 0,
  },
  flatToolbar: {
    paddingHorizontal: 10,
    gap: 12, 
  },

  swipeHintContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    zIndex: 999,
  },
  handIcon: {
    transform: [{ rotate: '-15deg' }],
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  headerBtnRight: {
    minWidth: 50,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerBtnTextAction: {
    fontSize: 17,
    fontWeight: '600',
    color: THEME_COLOR,
  },
  contentContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  titleWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#000000',
  },
  inputTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingTop: 10,
    lineHeight: 41,
  },
  editorWrapper: {
    flex: 1,
    backgroundColor: '#000000',
  },
  richEditor: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    color: '#8E8E93',
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 4,
  },
  modalInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalBtnAdd: {
    backgroundColor: THEME_COLOR,
  },
  modalBtnTextCancel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBtnTextAdd: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});