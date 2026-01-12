import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Clipboard,
  TextInput,
  Animated,
  ActivityIndicator,
  Switch,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Copy,
  Key,
  LogOut,
  Shield,
  Info,
  Eye,
  EyeOff,
  Lock,
  Zap,
  Download,
  Upload,
  Chrome,
  User,
  Radio,
  Plus,
  Trash2,
  X,
  BookOpen,
  ChevronRight,
  Github,
} from 'lucide-react-native';
import { Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { nostrService, AuthMethod, type UserRelay } from '@/lib/nostr';
import type { NostrKeys } from '@/types/note';
import { biometricAuthService } from '@/lib/biometric-auth';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const [keys, setKeys] = useState<NostrKeys | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(AuthMethod.NOT_AUTHENTICATED);
  const [showImport, setShowImport] = useState(false);
  const [importKey, setImportKey] = useState('');
  const [relays, setRelays] = useState<UserRelay[]>([]);
  const [showAddRelay, setShowAddRelay] = useState(false);
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [loadingRelays, setLoadingRelays] = useState(false);
  const [faceLockEnabled, setFaceLockEnabled] = useState(false);
  const [pinLockEnabled, setPinLockEnabled] = useState(false);
  const [fingerprintLockEnabled, setFingerprintLockEnabled] = useState(false);
  const [hasFaceRecognition, setHasFaceRecognition] = useState(false);
  const [hasFingerprint, setHasFingerprint] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sectionFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadKeys();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(sectionFadeAnim, {
        toValue: 1,
        duration: 300,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);


  useEffect(() => {
    if (keys) {
      loadRelays();
      loadBiometricSettings();
    }
  }, [keys]);

  const loadKeys = async () => {
    try {
      const session = await nostrService.restoreSession();
      if (session) {
        setKeys(session);
        setAuthMethod(nostrService.getAuthMethod());
      }
    } catch (error) {
      console.error('Error loading keys:', error);
    }
  };

  const loadRelays = async () => {
    setLoadingRelays(true);
    try {
      const userRelays = await nostrService.getUserRelays();
      setRelays(userRelays);
    } catch (error) {
      console.error('Error loading relays:', error);
    } finally {
      setLoadingRelays(false);
    }
  };

  const loadBiometricSettings = async () => {
    if (Platform.OS === 'web') return;

    const [faceEnabled, pinEnabled, fingerprintEnabled, hasFace, hasPin] = await Promise.all([
      biometricAuthService.isFaceLockEnabled(),
      biometricAuthService.isPinLockEnabled(),
      biometricAuthService.isFingerprintLockEnabled(),
      biometricAuthService.hasFaceRecognition(),
      biometricAuthService.hasFingerprint(),
    ]);

    setFaceLockEnabled(faceEnabled);
    setPinLockEnabled(pinEnabled);
    setFingerprintLockEnabled(fingerprintEnabled);
    setHasFaceRecognition(hasFace);
    setHasFingerprint(hasPin);
  };

  const handleToggleFaceLock = async (value: boolean) => {
    if (Platform.OS === 'web') return;

    if (!hasFaceRecognition) {
      Alert.alert('Desteklenmiyor', 'Cihazınız yüz tanıma özelliğini desteklemiyor');
      return;
    }

    if (value) {
      const result = await biometricAuthService.authenticate('Yüz kilidini etkinleştir');
      if (!result.success) {
        Alert.alert('Hata', result.error || 'Kimlik doğrulama başarısız');
        return;
      }
    }

    await biometricAuthService.setFaceLockEnabled(value);
    setFaceLockEnabled(value);
  };

  const handleTogglePinLock = async (value: boolean) => {
    if (Platform.OS === 'web') return;

    if (value) {
      const result = await biometricAuthService.authenticate('PIN kilidini etkinleştir');
      if (!result.success) {
        Alert.alert('Hata', result.error || 'Kimlik doğrulama başarısız');
        return;
      }
    }

    await biometricAuthService.setPinLockEnabled(value);
    setPinLockEnabled(value);
  };

  const handleToggleFingerprintLock = async (value: boolean) => {
    if (Platform.OS === 'web') return;

    if (!hasFingerprint) {
      Alert.alert('Desteklenmiyor', 'Cihazınız parmak izi özelliğini desteklemiyor');
      return;
    }

    if (value) {
      const result = await biometricAuthService.authenticate('Parmak izi kilidini etkinleştir');
      if (!result.success) {
        Alert.alert('Hata', result.error || 'Kimlik doğrulama başarısız');
        return;
      }
    }

    await biometricAuthService.setFingerprintLockEnabled(value);
    setFingerprintLockEnabled(value);
  };

  const handleCreateNewIdentity = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Yeni Kimlik Oluştur',
        'Yeni bir kimlik oluşturulsun mu? Mevcut anahtarlarınız silinecek!',
        [
          { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Oluştur', onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    try {
      const newKeys = await nostrService.createNewIdentity();
      setKeys(newKeys);
      setAuthMethod(nostrService.getAuthMethod());
      setShowPrivateKey(false);
      Alert.alert('Başarılı', 'Yeni kimlik oluşturuldu! Lütfen gizli anahtarınızı yedekleyin.');
      await loadRelays();
    } catch (error) {
      console.error('Error creating identity:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      Alert.alert('Hata', `Kimlik oluşturulamadı: ${errorMessage}`);
    }
  };

  const handleImportKey = async () => {
    if (!importKey.trim()) {
      if (Platform.OS === 'web') {
        alert('Lütfen geçerli bir gizli anahtar girin');
      } else {
        Alert.alert('Hata', 'Lütfen geçerli bir gizli anahtar girin');
      }
      return;
    }

    try {
      const importedKeys = await nostrService.loginWithPrivateKey(importKey.trim());
      setKeys(importedKeys);
      setAuthMethod(nostrService.getAuthMethod());
      setImportKey('');
      setShowImport(false);

      if (Platform.OS === 'web') {
        alert('Anahtar başarıyla içe aktarıldı!');
      } else {
        Alert.alert('Başarılı', 'Anahtar başarıyla içe aktarıldı!');
      }
      await loadRelays();
    } catch (error) {
      console.error('Error importing key:', error);
      const errorMessage = error instanceof Error ? error.message : 'Geçersiz anahtar';
      if (Platform.OS === 'web') {
        alert(`İçe aktarma başarısız: ${errorMessage}`);
      } else {
        Alert.alert('Hata', `İçe aktarma başarısız: ${errorMessage}`);
      }
    }
  };

  const handleConnectExtension = async () => {
    if (Platform.OS !== 'web') {
      alert('Eklenti sadece web tarayıcısında kullanılabilir');
      return;
    }

    try {
      const extensionKeys = await nostrService.loginWithExtension();
      setKeys(extensionKeys);
      setAuthMethod(nostrService.getAuthMethod());

      alert('Eklenti bağlantısı başarılı!');
      await loadRelays();
    } catch (error) {
      console.error('Error connecting extension:', error);
      const errorMessage = error instanceof Error ? error.message : 'Eklenti bulunamadı';
      alert(`Eklenti bağlantısı başarısız: ${errorMessage}\n\nLütfen Alby, nos2x veya benzer bir Nostr eklentisi yükleyin.`);
    }
  };

  const handleExportKey = async () => {
    try {
      const nsec = await nostrService.exportPrivateKey();
      await copyToClipboard(nsec, 'Gizli anahtar');

      if (Platform.OS === 'web') {
        alert('ÖNEMLİ: Gizli anahtarınız kopyalandı. Bu anahtarı güvenli bir yerde saklayın!');
      } else {
        Alert.alert('ÖNEMLİ', 'Gizli anahtarınız kopyalandı. Bu anahtarı güvenli bir yerde saklayın!');
      }
    } catch (error) {
      console.error('Error exporting key:', error);
      const errorMessage = error instanceof Error ? error.message : 'Dışa aktarılamadı';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Hata', errorMessage);
      }
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
        alert(`${label} kopyalandı!`);
      } else {
        Clipboard.setString(text);
        Alert.alert('Kopyalandı', `${label} panoya kopyalandı`);
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleClearCache = async () => {
    const confirmed = Platform.OS === 'web'
      ? confirm('Yerel önbelliğiniz silinsin mi? Notlarınız relay\'lerden yeniden indirilecek.')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Önbelleği Sil',
            'Önbelleğiniz silinsin mi? Notlarınız relay\'lerden yeniden indirilecek.',
            [
              { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Sil', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      await nostrService.clearCache();
      if (Platform.OS === 'web') {
        alert('Cache temizlendi');
      } else {
        Alert.alert('Başarılı', 'Önbelleğiniz silindi');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const handleLogout = async () => {
    const confirmed = Platform.OS === 'web'
      ? confirm('Çıkış yapmak istediğinizden emin misiniz?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Çıkış Yap',
            'Çıkış yapmak istediğinizden emin misiniz?',
            [
              { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Çıkış', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      await nostrService.logout();
      setKeys(null);
      setAuthMethod(AuthMethod.NOT_AUTHENTICATED);
      setShowPrivateKey(false);
      setRelays([]);

      if (Platform.OS === 'web') {
        alert('Başarıyla çıkış yapıldı');
      } else {
        Alert.alert('Başarılı', 'Başarıyla çıkış yapıldı');
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleAddRelay = async () => {
    if (!newRelayUrl.trim().startsWith('wss://')) {
      alert('Relay URL wss:// ile başlamalıdır');
      return;
    }

    try {
      const success = await nostrService.addRelay(newRelayUrl.trim());
      if (success) {
        setNewRelayUrl('');
        setShowAddRelay(false);
        await loadRelays();
        if (Platform.OS === 'web') {
          alert('Relay eklendi!');
        } else {
          Alert.alert('Başarılı', 'Relay eklendi!');
        }
      } else {
        alert('Relay eklenemedi');
      }
    } catch (error) {
      console.error('Error adding relay:', error);
      alert('Relay eklenemedi');
    }
  };

  const handleToggleRelay = async (relayId: string, currentState: boolean) => {
    try {
      const success = await nostrService.toggleRelay(relayId, !currentState);
      if (success) {
        await loadRelays();
      }
    } catch (error) {
      console.error('Error toggling relay:', error);
    }
  };

  const handleDeleteRelay = async (relayId: string) => {
    const confirmed = Platform.OS === 'web'
      ? confirm('Bu relay\'i silmek istediğinizden emin misiniz?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Relay Sil',
            'Bu relay\'i silmek istediğinizden emin misiniz?',
            [
              { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Sil', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      const success = await nostrService.deleteRelay(relayId);
      if (success) {
        await loadRelays();
        if (Platform.OS === 'web') {
          alert('Relay silindi');
        } else {
          Alert.alert('Başarılı', 'Relay silindi');
        }
      }
    } catch (error) {
      console.error('Error deleting relay:', error);
    }
  };

  const formatKey = (key: string, show: boolean = true) => {
    if (!show) {
      return '••••••••••••••••••••••••••••••••';
    }
    return key;
  };

  const handleGithubPress = async () => {
    try {
      const url = 'https://github.com/teskilatsiz';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening GitHub link:', error);
    }
  };


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Ayarlar</Text>
        </Animated.View>

        {!keys && (
          <Animated.View style={[styles.section, { opacity: sectionFadeAnim }]}>
            <Text style={styles.sectionTitle}>Giriş Yap</Text>

            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={styles.actionCard}
                onPress={handleConnectExtension}
                activeOpacity={0.8}>
                <BlurView intensity={30} tint="dark" style={styles.actionBlur}>
                  <View style={styles.actionIconContainer}>
                    <Chrome size={22} color="#0A84FF" strokeWidth={2.5} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Eklenti ile Bağlan</Text>
                    <Text style={styles.actionDescription}>
                      Alby, nos2x veya benzeri NIP-07 eklentisi kullanın
                    </Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            )}

            {Platform.OS !== 'web' && (
              <>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handleCreateNewIdentity}
                  activeOpacity={0.8}>
                  <BlurView intensity={30} tint="dark" style={styles.actionBlur}>
                    <View style={styles.actionIconContainer}>
                      <User size={22} color="#0A84FF" strokeWidth={2.5} />
                    </View>
                    <View style={styles.actionContent}>
                      <Text style={styles.actionTitle}>Yeni Kimlik Oluştur</Text>
                      <Text style={styles.actionDescription}>
                        Yeni bir Nostr kimliği oluştur
                      </Text>
                    </View>
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => setShowImport(true)}
                  activeOpacity={0.8}>
                  <BlurView intensity={30} tint="dark" style={styles.actionBlur}>
                    <View style={styles.actionIconContainer}>
                      <Upload size={22} color="#8E8E93" strokeWidth={2.5} />
                    </View>
                    <View style={styles.actionContent}>
                      <Text style={styles.actionTitle}>Anahtarınızı İçeri Aktarın</Text>
                      <Text style={styles.actionDescription}>
                        Mevcut gizli anahtarınızı içeri aktarın
                      </Text>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        )}

        {keys && (
          <>
            <Animated.View style={[styles.section, { opacity: sectionFadeAnim }]}>
              <Text style={styles.sectionTitle}>Kimlik Bilgileri</Text>

              <View style={styles.card}>
                <BlurView intensity={30} tint="dark" style={styles.cardBlur}>
                  <View style={styles.keyRow}>
                    <View style={styles.keyHeader}>
                      <View style={styles.keyIconContainer}>
                        <Key size={18} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                      <Text style={styles.keyLabel}>Genel Anahtar</Text>
                    </View>
                    <Text style={styles.keyValue} numberOfLines={1}>
                      {keys.publicKey}
                    </Text>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={() => copyToClipboard(keys.publicKey, 'Genel anahtar')}
                      activeOpacity={0.8}>
                      <BlurView intensity={30} tint="dark" style={styles.buttonBlur}>
                        <Copy size={16} color="#0A84FF" strokeWidth={2.5} />
                        <Text style={styles.copyButtonText}>Kopyala</Text>
                      </BlurView>
                    </TouchableOpacity>
                  </View>

                  {authMethod === AuthMethod.MOBILE_SECURE && keys.privateKey !== 'MANAGED_BY_EXTENSION' && (
                    <>
                      <View style={styles.divider} />

                      <View style={styles.keyRow}>
                        <View style={styles.keyHeader}>
                          <View style={styles.keyIconContainer}>
                            <Lock size={18} color="#FFFFFF" strokeWidth={2.5} />
                          </View>
                          <Text style={styles.keyLabel}>Gizli Anahtar</Text>
                        </View>
                        <Text style={styles.keyValue} numberOfLines={1}>
                          {formatKey(keys.privateKey, showPrivateKey)}
                        </Text>
                        <View style={styles.keyActions}>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => setShowPrivateKey(!showPrivateKey)}
                            activeOpacity={0.8}>
                            <BlurView intensity={30} tint="dark" style={styles.buttonBlur}>
                              {showPrivateKey ? (
                                <EyeOff size={16} color="#8E8E93" strokeWidth={2.5} />
                              ) : (
                                <Eye size={16} color="#8E8E93" strokeWidth={2.5} />
                              )}
                              <Text style={styles.actionButtonText}>
                                {showPrivateKey ? 'Gizle' : 'Göster'}
                              </Text>
                            </BlurView>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.copyButton}
                            onPress={() => copyToClipboard(keys.privateKey, 'Özel anahtar')}
                            activeOpacity={0.8}>
                            <BlurView intensity={30} tint="dark" style={styles.buttonBlur}>
                              <Copy size={16} color="#0A84FF" strokeWidth={2.5} />
                              <Text style={styles.copyButtonText}>Kopyala</Text>
                            </BlurView>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}
                </BlurView>
              </View>

              {authMethod === AuthMethod.MOBILE_SECURE && (
                <TouchableOpacity
                  style={styles.exportCard}
                  onPress={handleExportKey}
                  activeOpacity={0.8}>
                  <BlurView intensity={30} tint="dark" style={styles.exportBlur}>
                    <Download size={18} color="#0A84FF" strokeWidth={2.5} />
                    <Text style={styles.exportText}>Gizli Anahtarı Dışa Aktar</Text>
                  </BlurView>
                </TouchableOpacity>
              )}

              <Animated.View style={styles.warningCard}>
                <BlurView intensity={30} tint="dark" style={styles.warningBlur}>
                  <View style={styles.warningIconContainer}>
                    <Info size={20} color="#0A84FF" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.warningText}>
                    Gizli anahtarınızı asla kimseyle paylaşmayın. Gizli anahtarınıza
                    sahip olan herkes tüm notlarınızı okuyabilir.
                  </Text>
                </BlurView>
              </Animated.View>
            </Animated.View>

            <Animated.View style={styles.section}>
              <Text style={styles.sectionTitle}>Güvenlik</Text>

              <View style={styles.securityCard}>
                <BlurView intensity={30} tint="dark" style={styles.securityBlur}>
                  <View style={styles.securityRow}>
                    <View style={styles.securityHeader}>
                      <View style={styles.securityIconContainer}>
                        <MaterialCommunityIcons
                          name="face-recognition"
                          size={22}
                          color="#0A84FF"
                        />
                      </View>
                      <View style={styles.securityContent}>
                        <Text style={styles.securityTitle}>Yüz Kilidi</Text>
                        <Text style={styles.securityDescription}>
                          Yüz tanıma ile uygulamayı kilitle
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={faceLockEnabled}
                      onValueChange={handleToggleFaceLock}
                      trackColor={{ false: '#3A3A3C', true: '#0A84FF' }}
                      thumbColor="#FFFFFF"
                      disabled={Platform.OS === 'web' || !hasFaceRecognition}
                    />
                  </View>
                </BlurView>
              </View>

              <View style={styles.securitySpacer} />

              <View style={styles.securityCard}>
                <BlurView intensity={30} tint="dark" style={styles.securityBlur}>
                  <View style={styles.securityRow}>
                    <View style={styles.securityHeader}>
                      <View style={styles.securityIconContainer}>
                        <Lock size={20} color="#0A84FF" strokeWidth={2.5} />
                      </View>
                      <View style={styles.securityContent}>
                        <Text style={styles.securityTitle}>PIN Kilidi</Text>
                        <Text style={styles.securityDescription}>
                          PIN kodu ile uygulamayı kilitle
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={pinLockEnabled}
                      onValueChange={handleTogglePinLock}
                      trackColor={{ false: '#3A3A3C', true: '#0A84FF' }}
                      thumbColor="#FFFFFF"
                      disabled={Platform.OS === 'web'}
                    />
                  </View>
                </BlurView>
              </View>

              <View style={styles.securitySpacer} />

              <View style={styles.securityCard}>
                <BlurView intensity={30} tint="dark" style={styles.securityBlur}>
                  <View style={styles.securityRow}>
                    <View style={styles.securityHeader}>
                      <View style={styles.securityIconContainer}>
                        <MaterialCommunityIcons
                          name="fingerprint"
                          size={22}
                          color="#0A84FF"
                        />
                      </View>
                      <View style={styles.securityContent}>
                        <Text style={styles.securityTitle}>Parmak İzi Kilidi</Text>
                        <Text style={styles.securityDescription}>
                          Parmak izi ile uygulamayı kilitle
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={fingerprintLockEnabled}
                      onValueChange={handleToggleFingerprintLock}
                      trackColor={{ false: '#3A3A3C', true: '#0A84FF' }}
                      thumbColor="#FFFFFF"
                      disabled={Platform.OS === 'web' || !hasFingerprint}
                    />
                  </View>
                </BlurView>
              </View>
            </Animated.View>

            <Animated.View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Relay Yönetimi</Text>
                <TouchableOpacity
                  style={styles.addRelayButton}
                  onPress={() => setShowAddRelay(true)}
                  activeOpacity={0.8}>
                  <BlurView intensity={30} tint="dark" style={styles.addRelayBlur}>
                    <Plus size={18} color="#0A84FF" strokeWidth={2.5} />
                  </BlurView>
                </TouchableOpacity>
              </View>

              {loadingRelays ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator size="small" color="#0A84FF" />
                  <Text style={styles.loadingText}>Relayler yükleniyor...</Text>
                </View>
              ) : (
                <View style={styles.relayList}>
                  {relays.map((relay) => (
                    <View key={relay.id} style={styles.relayCard}>
                      <BlurView intensity={30} tint="dark" style={styles.relayBlur}>
                        <View style={styles.relayHeader}>
                          <View style={styles.relayIconContainer}>
                            <Radio
                              size={18}
                              color={relay.is_enabled ? '#0A84FF' : '#636366'}
                              strokeWidth={2.5}
                            />
                          </View>
                          <View style={styles.relayInfo}>
                            <Text style={styles.relayUrl} numberOfLines={1}>
                              {relay.relay_url}
                            </Text>
                            {relay.is_default && (
                              <Text style={styles.relayBadge}>Varsayılan</Text>
                            )}
                          </View>
                          <View style={styles.relayActions}>
                            <Switch
                              value={relay.is_enabled}
                              onValueChange={() => handleToggleRelay(relay.id, relay.is_enabled)}
                              trackColor={{ false: '#3A3A3C', true: '#0A84FF' }}
                              thumbColor="#FFFFFF"
                            />
                            {!relay.is_default && (
                              <TouchableOpacity
                                onPress={() => handleDeleteRelay(relay.id)}
                                activeOpacity={0.8}>
                                <Trash2 size={18} color="#FF453A" strokeWidth={2.5} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </BlurView>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>

            <Animated.View style={styles.section}>
              <Text style={styles.sectionTitle}>Teknik Bilgiler</Text>

              <TouchableOpacity
                style={styles.documentationButton}
                onPress={() => router.push('/technical-documentation')}
                activeOpacity={0.8}>
                <BlurView intensity={30} tint="dark" style={styles.documentationBlur}>
                  <View style={styles.documentationIconContainer}>
                    <BookOpen size={22} color="#0A84FF" strokeWidth={2.5} />
                  </View>
                  <View style={styles.documentationContent}>
                    <Text style={styles.documentationTitle}>Teknik Dokümantasyon</Text>
                    <Text style={styles.documentationDescription}>
                      Şifreleme ve güvenlik detaylarını inceleyin
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#636366" strokeWidth={2.5} />
                </BlurView>
              </TouchableOpacity>

              <View style={{ height: 20 }} />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled={true}
                contentContainerStyle={styles.techCardsContainer}>
                <View style={styles.techCard}>
                  <BlurView intensity={30} tint="dark" style={styles.techBlur}>
                    <View style={styles.techIconContainer}>
                      <Zap size={24} color="#0A84FF" strokeWidth={2.5} />
                    </View>
                    <Text style={styles.techTitle}>Nostr Protokolü</Text>
                    <Text style={styles.techDescription}>
                      Notlar merkezi olmayan Nostr relay'leri üzerinden dağıtılır.
                    </Text>
                  </BlurView>
                </View>

                <View style={styles.techCard}>
                  <BlurView intensity={30} tint="dark" style={styles.techBlur}>
                    <View style={styles.techIconContainer}>
                      <Shield size={24} color="#0A84FF" strokeWidth={2.5} />
                    </View>
                    <Text style={styles.techTitle}>NIP-44 Şifreleme</Text>
                    <Text style={styles.techDescription}>
                      XChaCha20-Poly1305 algoritması ile uçtan uca şifreleme.
                    </Text>
                  </BlurView>
                </View>

                <View style={styles.techCard}>
                  <BlurView intensity={30} tint="dark" style={styles.techBlur}>
                    <View style={styles.techIconContainer}>
                      <Lock size={24} color="#0A84FF" strokeWidth={2.5} />
                    </View>
                    <Text style={styles.techTitle}>
                      {Platform.OS === 'web' ? 'NIP-07 Eklenti' : 'Güvenli Depolama'}
                    </Text>
                    <Text style={styles.techDescription}>
                      {Platform.OS === 'web'
                        ? 'Gizli anahtarınız tarayıcı eklentisi tarafından yönetilir.'
                        : 'Gizli anahtarınız cihazınızda Secure Enclave ile korunur.'}
                    </Text>
                  </BlurView>
                </View>
              </ScrollView>
            </Animated.View>

            <Animated.View style={styles.section}>
              <Text style={styles.sectionTitle}>Oturum Yönetimi</Text>

              <TouchableOpacity
                style={styles.dangerButton}
                onPress={handleClearCache}
                activeOpacity={0.8}>
                <BlurView intensity={30} tint="dark" style={styles.dangerBlur}>
                  <Trash2 size={18} color="#8E8E93" strokeWidth={2.5} />
                  <Text style={styles.dangerButtonText}>Önbelleği Sil</Text>
                </BlurView>
              </TouchableOpacity>

              <View style={{ height: 12 }} />

              <TouchableOpacity
                style={styles.dangerButton}
                onPress={handleLogout}
                activeOpacity={0.8}>
                <BlurView intensity={30} tint="dark" style={styles.dangerBlur}>
                  <LogOut size={18} color="#8E8E93" strokeWidth={2.5} />
                  <Text style={styles.dangerButtonText}>Çıkış Yap</Text>
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        <Animated.View style={styles.footer}>
          <TouchableOpacity
            style={styles.developerCard}
            onPress={handleGithubPress}
            activeOpacity={0.8}>
            <BlurView intensity={30} tint="dark" style={styles.developerBlur}>
              <View style={styles.developerIconContainer}>
                <Github size={20} color="#0A84FF" strokeWidth={2.5} />
              </View>
              <View style={styles.developerContent}>
                <Text style={styles.developerLabel}>Geliştirici</Text>
                <Text style={styles.developerName}>Teşkilatsız</Text>
              </View>
              <ChevronRight size={20} color="#636366" strokeWidth={2.5} />
            </BlurView>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showAddRelay}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddRelay(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddRelay(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={80} tint="dark" style={styles.modalBlur}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Yeni Relay Ekle</Text>
                <TouchableOpacity
                  onPress={() => setShowAddRelay(false)}
                  activeOpacity={0.8}>
                  <X size={24} color="#8E8E93" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.relayInput}
                placeholder="wss://relay.example.com"
                placeholderTextColor="#636366"
                value={newRelayUrl}
                onChangeText={setNewRelayUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleAddRelay}
                  activeOpacity={0.8}>
                  <Text style={styles.modalButtonText}>Ekle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddRelay(false);
                    setNewRelayUrl('');
                  }}
                  activeOpacity={0.8}>
                  <Text style={styles.modalCancelButtonText}>İptal</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showImport}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          setShowImport(false);
          setImportKey('');
        }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingContainer}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              setShowImport(false);
              setImportKey('');
            }}>
            <Pressable
              style={styles.importModalContent}
              onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={95} tint="dark" style={styles.importModalBlur}>
                <View style={styles.importModalHandle} />

                <View style={styles.importModalHeader}>
                  <Text style={styles.importModalTitle}>Anahtar İçe Aktar</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowImport(false);
                      setImportKey('');
                    }}
                    activeOpacity={0.8}>
                    <X size={24} color="#8E8E93" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.relayInput}
                  placeholder="Gizli anahtar girin (nsec veya hex format)"
                  placeholderTextColor="#636366"
                  value={importKey}
                  onChangeText={setImportKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />

                <View style={styles.importModalActions}>
                  <TouchableOpacity
                    style={styles.importModalButton}
                    onPress={handleImportKey}
                    activeOpacity={0.8}>
                    <Text style={styles.importModalButtonText}>Tamam</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.importModalCancelButton}
                    onPress={() => {
                      setShowImport(false);
                      setImportKey('');
                    }}
                    activeOpacity={0.8}>
                    <Text style={styles.importModalCancelButtonText}>İptal</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  section: {
    marginTop: 40,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  actionCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  actionBlur: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  actionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardBlur: {
    padding: 24,
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  keyRow: {
    gap: 16,
  },
  keyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  keyIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  authMethodText: {
    fontSize: 15,
    color: '#0A84FF',
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  keyValue: {
    fontSize: 13,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  keyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  copyButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: -0.1,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A84FF',
    letterSpacing: -0.1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 20,
  },
  exportCard: {
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  exportBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.2)',
  },
  exportText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A84FF',
    letterSpacing: -0.2,
  },
  warningCard: {
    marginTop: 20,
    borderRadius: 18,
    overflow: 'hidden',
  },
  warningBlur: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'flex-start',
    gap: 16,
  },
  warningIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#AEAEB2',
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  addRelayButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addRelayBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    backgroundColor: 'rgba(28, 28, 30, 0.5)',
    borderRadius: 18,
  },
  loadingText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
  },
  relayList: {
    gap: 12,
  },
  relayCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  relayBlur: {
    padding: 16,
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  relayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  relayIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  relayInfo: {
    flex: 1,
    gap: 4,
  },
  relayUrl: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  relayBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A84FF',
    letterSpacing: -0.1,
  },
  relayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  techCardsContainer: {
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  techCard: {
    width: 280,
    borderRadius: 24,
    overflow: 'hidden',
    height: 240,
  },
  techBlur: {
    flex: 1,
    padding: 24,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16,
    ...Platform.select({
      ios: {
        borderCurve: 'continuous' as any,
      },
      android: {
        borderRadius: 24,
      },
    }),
  },
  techIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        borderCurve: 'continuous' as any,
      },
    }),
  },
  techTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  techDescription: {
    fontSize: 14,
    color: '#AEAEB2',
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  dangerButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  dangerBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: -0.2,
  },
  footer: {
    marginTop: 48,
    marginBottom: 24,
    marginHorizontal: 24,
  },
  developerCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  developerBlur: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  developerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  developerContent: {
    flex: 1,
  },
  developerLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  developerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  documentationButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  documentationBlur: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  documentationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentationContent: {
    flex: 1,
  },
  documentationTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  documentationDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  securityCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  securityBlur: {
    padding: 24,
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  securityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  securityDescription: {
    fontSize: 14,
    color: '#8E8E93',
    letterSpacing: -0.1,
  },
  securitySpacer: {
    height: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalBlur: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  relayInput: {
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#0A84FF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: -0.2,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  importModalContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  importModalBlur: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  importModalHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  importModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  importModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  importModalActions: {
    gap: 12,
    marginTop: 24,
  },
  importModalButton: {
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.3)',
  },
  importModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A84FF',
    letterSpacing: -0.2,
  },
  importModalCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  importModalCancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: -0.2,
  },
});
