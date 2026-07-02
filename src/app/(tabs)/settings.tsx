import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Copy, Key, LogOut, Info, Eye, EyeOff, Lock,
  Download, Upload, Chrome, User, Radio, Plus, Trash2,
  BookOpen, ChevronRight, Github, ScanFace, Palette, MonitorSmartphone, Sun, Moon,
  ShieldCheck, Smartphone,
} from 'lucide-react-native';
import {
  nostrService,
  AuthMethod,
  type Nip46LoginRequest,
  type UserRelay,
} from '@/lib/nostr';
import type { NostrKeys } from '@/types/note';
import { biometricAuthService } from '@/lib/biometric-auth';
import { router } from 'expo-router';

import CustomSwitch from '@/components/CustomSwitch';
import { SwipeableBottomSheet } from '@/components/SwipeableBottomSheet';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path } from 'react-native-svg';
import { useI18n } from '@/lib/i18n';
import { ActionBottomSheet, type ActionBottomSheetRef, type ActionItem } from '@/components/ActionBottomSheet';
import { Globe } from 'lucide-react-native';
import { useAppTheme } from '@/lib/theme';
import { useSession } from '@/providers/SessionProvider';
import {
  detectWebClient,
  UNKNOWN_WEB_CLIENT,
  type WebClientInfo,
} from '@/lib/web-client';

const NosBottleIcon = ({ size = 24, color = "currentColor", strokeWidth = 2, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M9 2 L15 2" />
    <Path d="M12 2 L12 4" />
    <Path d="M10 4 L14 4 L14 6 L10 6 Z" />
    <Path d="M14 6 C17 6 18 8 18 11 L18 19 C18 21.2 16.2 23 14 23 L10 23 C7.8 23 6 21.2 6 19 L6 11 C6 8 7 6 10 6 Z" />
    <Path d="M9 12 L15 12" />
    <Path d="M9 16 L15 16" />
    <Path d="M14 4 L16 4 L16 6 L14 6" />
  </Svg>
);

const FlamingoIcon = ({ size = 24, color = "currentColor", strokeWidth = 2, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M8 5 L5 8 L6 9 C7 9, 8 7, 8 7" />
    <Path d="M8 5 C10 3, 12 4, 11 7 C10 10, 8 12, 9 15" />
    <Path d="M9 15 C9 19, 14 20, 18 17 C21 15, 20 12, 17 11 C14 10, 10 11, 9 15 Z" />
    <Path d="M12 14 C14 14, 17 13, 19 12" />
    <Path d="M12 19 L12 23" />
    <Path d="M15 18 L15 20 L17 23" />
  </Svg>
);

const IS_ANDROID = Platform.OS === 'android';
type WebLoginMethod = 'nip46' | 'nip55' | 'nip07' | 'app_store';

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const { language } = useI18n();
  const { colors } = useAppTheme();

  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {title.toLocaleUpperCase(language)}
      </Text>
      {right}
    </View>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  destructive,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.settingsIconBg, { backgroundColor: colors.iconBackground }, destructive && styles.settingsIconBgDestructive]}>
        {icon}
      </View>
      <View style={styles.settingsContent}>
        <Text
          style={[styles.settingsTitle, { color: colors.text }, destructive && { color: colors.destructive }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {right || (onPress && <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />)}
    </TouchableOpacity>
  );
}

function LoginBadge({ label, ready = false }: { label: string; ready?: boolean }) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.loginBadge,
        {
          backgroundColor: ready ? 'rgba(10, 132, 255, 0.12)' : colors.iconBackground,
          borderColor: ready ? 'rgba(10, 132, 255, 0.28)' : colors.border,
        },
      ]}
    >
      <Text style={[styles.loginBadgeText, { color: ready ? '#0A84FF' : colors.accent }]}>
        {label}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { t, language, setLanguage } = useI18n();
  const { colors, scheme, preference, setPreference } = useAppTheme();
  const { setIsAuthenticated } = useSession();
  const [keys, setKeys] = useState<NostrKeys | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(AuthMethod.NOT_AUTHENTICATED);
  const [showImport, setShowImport] = useState(false);
  const [importKey, setImportKey] = useState('');
  const [relays, setRelays] = useState<UserRelay[]>([]);
  const [showAddRelay, setShowAddRelay] = useState(false);
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [loadingRelays, setLoadingRelays] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState(t('biometric.generic'));
  const [showBiometricOnboarding, setShowBiometricOnboarding] = useState(false);
  const [showNewIdentity, setShowNewIdentity] = useState(false);
  const [creatingIdentity, setCreatingIdentity] = useState(false);
  const [showNip07Modal, setShowNip07Modal] = useState(false);
  const [showNip46Modal, setShowNip46Modal] = useState(false);
  const [nip46Uri, setNip46Uri] = useState('');
  const [connectingNip46, setConnectingNip46] = useState(false);
  const [connectingAndroidSigner, setConnectingAndroidSigner] = useState(false);
  const [webClient, setWebClient] = useState<WebClientInfo>(UNKNOWN_WEB_CLIENT);
  const nip46RequestRef = useRef<Nip46LoginRequest | null>(null);
  const languageSheetRef = useRef<ActionBottomSheetRef>(null);
  const themeSheetRef = useRef<ActionBottomSheetRef>(null);

  const insets = useSafeAreaInsets();
  const isAndroidWeb = Platform.OS === 'web' && webClient.isAndroid;

  const isMobileWeb = webClient.isAndroid || webClient.isIos || webClient.isMobile;
  const webLoginMethods: WebLoginMethod[] = webClient.kind === 'unknown'
    ? ['nip46']
    : isMobileWeb
      ? ['app_store', ...(webClient.hasNip07 ? ['nip07' as const] : [])]
      : ['nip07', 'nip46'];
  const recommendedWebLogin: WebLoginMethod = webClient.kind === 'unknown'
    ? 'nip46'
    : isMobileWeb
      ? 'app_store'
      : 'nip07';
  const languageLabel =
    language === 'tr' ? 'Türkçe' :
    language === 'en' ? 'English' :
    language === 'ru' ? 'Русский' :
    language === 'hi' ? 'हिन्दी' :
    language === 'pt' ? 'Português' : 'Türkçe';
  const sheetTitleStyle = [styles.sheetTitle, { color: colors.text }];
  const sheetDescStyle = [styles.sheetDesc, { color: colors.textSecondary }];
  const biometricTitleStyle = [styles.biometricTitle, { color: colors.text }];
  const biometricDescStyle = [styles.biometricDesc, { color: colors.textSecondary }];
  const sheetInputStyle = [
    styles.sheetInput,
    {
      color: colors.text,
      backgroundColor: colors.inputBackground,
      borderColor: colors.border,
    },
    Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
  ];
  const sheetCancelStyle = [styles.sheetBtnCancel, { backgroundColor: colors.elevatedMuted }];
  const biometricCancelStyle = [styles.biometricBtnCancel, { backgroundColor: colors.elevatedMuted }];
  const cancelTextStyle = [styles.sheetBtnCancelText, { color: colors.textSecondary }];
  const biometricCancelTextStyle = [styles.biometricBtnCancelText, { color: colors.textSecondary }];
  const compactIconInnerStyle = [styles.compactIconInner, { backgroundColor: colors.iconBackground }];
  const biometricIconInnerStyle = [styles.biometricIconInner, { backgroundColor: colors.iconBackground }];
  const extensionRowStyle = [
    styles.settingsRow,
    {
      backgroundColor: colors.elevatedMuted,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
    },
  ];
  const identityFieldStyle = {
    color: scheme === 'dark' ? '#C7C7CC' : colors.textSecondary,
    backgroundColor: scheme === 'dark' ? '#111113' : colors.elevatedMuted,
    borderColor: scheme === 'dark' ? '#343438' : colors.border,
    borderWidth: 1,
  };
  const identityControlStyle = {
    backgroundColor: scheme === 'dark' ? '#242426' : colors.elevatedMuted,
    borderColor: scheme === 'dark' ? '#3A3A3C' : colors.border,
    borderWidth: 1,
  };

  const loadKeys = useCallback(async () => {
    try {
      const session = await nostrService.restoreSession();
      if (session) {
        setKeys(session);
        setAuthMethod(nostrService.getAuthMethod());
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error loading keys:', error);
    }
  }, [setIsAuthenticated]);

  const loadRelays = useCallback(async () => {
    setLoadingRelays(true);
    try {
      const userRelays = await nostrService.getUserRelays();
      setRelays(userRelays);
    } catch (error) {
      console.error('Error loading relays:', error);
    } finally {
      setLoadingRelays(false);
    }
  }, []);

  const loadBiometricSettings = useCallback(async () => {
    if (Platform.OS === 'web') return;
    const [enabled, status] = await Promise.all([
      biometricAuthService.isBiometricAuthEnabled(),
      biometricAuthService.getBiometricStatus(),
    ]);
    setBiometricEnabled(enabled);
    setBiometricAvailable(status.available && status.enrolled);
    setBiometricLabel(status.label);
  }, []);

  useEffect(() => {
    // Session restoration synchronizes component state with encrypted storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadKeys();
  }, [loadKeys]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const refreshWebClient = () => setWebClient(detectWebClient());
    refreshWebClient();
    window.addEventListener('focus', refreshWebClient);
    const delayedDetection = window.setTimeout(refreshWebClient, 500);
    return () => {
      window.removeEventListener('focus', refreshWebClient);
      window.clearTimeout(delayedDetection);
    };
  }, []);

  useEffect(() => {
    if (keys) {
      // Relay and biometric state come from external native/storage systems.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadRelays();
      void loadBiometricSettings();
    }
  }, [keys, loadBiometricSettings, loadRelays]);

  const handleToggleBiometricAuth = async (value: boolean) => {
    if (Platform.OS === 'web') return;

    const status = await biometricAuthService.getBiometricStatus();
    if (!status.available || !status.enrolled) {
      Alert.alert(
        t('biometric.unavailable'),
        t('settings.biometricSetupDesc')
      );
      return;
    }

    if (value) {
      setShowBiometricOnboarding(true);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await biometricAuthService.setBiometricAuthEnabled(false);
    setBiometricEnabled(false);
  };

  const confirmEnableBiometric = async () => {
    const result = await biometricAuthService.authenticate(t('biometric.prompt'));
    if (!result.success) {
      setShowBiometricOnboarding(false);
      Alert.alert(t('biometric.failed'), result.error || t('biometric.failed'));
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await biometricAuthService.setBiometricAuthEnabled(true);
    setBiometricEnabled(true);
    setShowBiometricOnboarding(false);
  };

  const handleCreateNewIdentity = () => {
    setShowNewIdentity(true);
  };

  const confirmCreateNewIdentity = async () => {
    setCreatingIdentity(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newKeys = await nostrService.createNewIdentity();
      setKeys(newKeys);
      setIsAuthenticated(true);
      setAuthMethod(nostrService.getAuthMethod());
      setShowPrivateKey(false);
      setShowNewIdentity(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t('settings.keyCreatedTitle'),
        t('settings.keyCreatedMessage')
      );
      await loadRelays();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      Alert.alert(t('settings.keyCreateFailed'), errorMessage);
    } finally {
      setCreatingIdentity(false);
    }
  };

  const handleImportKey = async () => {
    if (!importKey.trim()) {
      Alert.alert(t('common.error'), t('settings.keyImportMissing'));
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const importedKeys = await nostrService.loginWithPrivateKey(importKey.trim());
      setKeys(importedKeys);
      setIsAuthenticated(true);
      setAuthMethod(nostrService.getAuthMethod());
      setImportKey('');
      setShowImport(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('alerts.copied'), t('settings.keyImported'));
      await loadRelays();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid key';
      Alert.alert(t('common.error'), t('settings.keyImportFailed', { message: errorMessage }));
    }
  };

  const handleConnectExtension = async () => {
    if (Platform.OS !== 'web') return;
    try {
      const extensionKeys = await nostrService.loginWithExtension();
      setKeys(extensionKeys);
      setIsAuthenticated(true);
      setAuthMethod(nostrService.getAuthMethod());
      Alert.alert(t('alerts.copied'), t('settings.extensionConnected'));
      await loadRelays();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Extension not found';
      if (errorMessage.includes('No NIP-07')) {
        setShowNip07Modal(true);
      } else {
        Alert.alert(t('common.error'), t('settings.extensionFailed', { message: errorMessage }));
      }
    }
  };

  const applySignerLogin = async (signerKeys: NostrKeys, successMessage: string) => {
    setKeys(signerKeys);
    setIsAuthenticated(true);
    setAuthMethod(nostrService.getAuthMethod());
    Alert.alert(t('settings.signerConnectedTitle'), successMessage);
    await loadRelays();
  };

  const copyNip46Uri = () => {
    if (!nip46Uri) return;
    copyToClipboard(nip46Uri, t('settings.connectLinkLabel'));
  };

  const handleConnectNip46 = () => {
    if (Platform.OS !== 'web' || connectingNip46) return;
    setConnectingNip46(true);
    setShowNip46Modal(true);

    try {
      const request = nostrService.beginNip46Login((url) => {
        Linking.openURL(url).catch(() => undefined);
      });
      nip46RequestRef.current = request;
      setNip46Uri(request.uri);


      void request.connection
        .then(async (signerKeys) => {
          nip46RequestRef.current = null;
          setConnectingNip46(false);
          setShowNip46Modal(false);
          setNip46Uri('');
          await applySignerLogin(signerKeys, t('settings.nip46Connected'));
        })
        .catch((error) => {
          nip46RequestRef.current = null;
          setConnectingNip46(false);
          const message = error instanceof Error ? error.message : String(error);
          if (!message.toLowerCase().includes('cancel')) {
            Alert.alert(t('common.error'), t('settings.nip46Failed', { message }));
          }
        });
    } catch (error) {
      setConnectingNip46(false);
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(t('common.error'), t('settings.nip46Failed', { message }));
    }
  };

  const closeNip46Modal = () => {
    nip46RequestRef.current?.cancel();
    nip46RequestRef.current = null;
    setConnectingNip46(false);
    setShowNip46Modal(false);
    setNip46Uri('');
  };

  const handleConnectAndroidSigner = async () => {
    if (!isAndroidWeb || connectingAndroidSigner) return;
    setConnectingAndroidSigner(true);
    try {
      const signerKeys = await nostrService.loginWithAndroidSigner();
      await applySignerLogin(signerKeys, t('settings.nip55Connected'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(t('common.error'), t('settings.nip55Failed', { message }));
    } finally {
      setConnectingAndroidSigner(false);
    }
  };

  const handleExportKey = async () => {
    try {
      const nsec = await nostrService.exportPrivateKey();
      await copyToClipboard(nsec, t('settings.copyPrivateKey'));
      Alert.alert(t('settings.copyTitle'), t('settings.copyMessage', { label: t('settings.copyPrivateKey') }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('common.error');
      Alert.alert(t('common.error'), errorMessage);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
        Alert.alert(t('settings.copyTitle'), t('settings.copyMessage', { label }));
      } else {
        await Clipboard.setStringAsync(text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('settings.copyTitle'), t('settings.copyMessage', { label }));
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleClearCache = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(t('settings.cacheClearTitle'), t('settings.cacheClearMessage'), [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('common.delete'), onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;
    try {
      await nostrService.clearCache();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('settings.cacheClearedTitle'), t('settings.cacheClearedMessage'));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const handleLogout = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(t('settings.logoutTitle'), t('settings.logoutMessage'), [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('settings.logout'), style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await nostrService.logout();
      setKeys(null);
      setIsAuthenticated(false);
      setAuthMethod(AuthMethod.NOT_AUTHENTICATED);
      setShowPrivateKey(false);
      setRelays([]);
      Alert.alert(t('settings.loggedOutTitle'), t('settings.loggedOutMessage'));
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleAddRelay = async () => {
    if (!newRelayUrl.trim().startsWith('wss://')) {
      Alert.alert(t('settings.invalidRelayTitle'), t('settings.invalidRelayMessage'));
      return;
    }
    try {
      const success = await nostrService.addRelay(newRelayUrl.trim());
      if (success) {
        setNewRelayUrl('');
        setShowAddRelay(false);
        await loadRelays();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('settings.relayAddedTitle'), t('settings.relayAddedMessage'));
      } else {
        Alert.alert(t('settings.relayAddFailedTitle'), t('settings.relayAddFailedMessage'));
      }
    } catch {
      Alert.alert(t('settings.relayAddFailedTitle'), t('settings.relayAddFailedMessage'));
    }
  };

  const handleToggleRelay = async (relayId: string, currentState: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const success = await nostrService.toggleRelay(relayId, !currentState);
      if (success) await loadRelays();
    } catch (error) {
      console.error('Error toggling relay:', error);
    }
  };

  const handleDeleteRelay = async (relayId: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(t('settings.deleteRelayTitle'), t('settings.deleteRelayMessage'), [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('common.delete'), style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const success = await nostrService.deleteRelay(relayId);
      if (success) {
        await loadRelays();
        Alert.alert(t('settings.relayDeletedTitle'), t('settings.relayDeletedMessage'));
      }
    } catch (error) {
      console.error('Error deleting relay:', error);
    }
  };

  const formatKey = (key: string, show: boolean = true) =>
    show ? key : '••••••••••••••••••••••••••••••••';

  const renderWebLoginRow = (method: WebLoginMethod) => {
    const isRecommended = method === recommendedWebLogin;

    if (method === 'nip55') {
      return (
        <SettingsRow
          icon={<Smartphone size={20} color="#34C759" strokeWidth={2} />}
          title={t('settings.connectNip55')}
          subtitle={t('settings.connectNip55Desc')}
          onPress={handleConnectAndroidSigner}
          right={
            connectingAndroidSigner
              ? <ActivityIndicator size="small" color={colors.accent} />
              : isRecommended
                ? <LoginBadge label={t('settings.recommended')} />
                : undefined
          }
        />
      );
    }
    if (method === 'app_store') {
      const handleAppStoreRedirect = () => {
        if (typeof window !== 'undefined') {
          const url = webClient.isAndroid 
            ? 'https://play.google.com/store/apps/details?id=com.teskilatsiz.cetele' 
            : 'https://apps.apple.com/tr/app/%C3%A7etele-%C5%9Fifreli-notlar/id6780082788';
          window.open(url, '_blank');
        }
      };
      
      return (
        <SettingsRow
          icon={<Smartphone size={20} color="#0A84FF" strokeWidth={2} />}
          title={t('settings.downloadApp')}
          subtitle={t('settings.downloadAppDesc')}
          onPress={handleAppStoreRedirect}
          right={isRecommended ? <LoginBadge label={t('settings.recommended')} /> : undefined}
        />
      );
    }
    if (method === 'nip07') {
      return (
        <SettingsRow
          icon={<Chrome size={20} color={'#0A84FF'} strokeWidth={2} />}
          title={t('settings.connectExtension')}
          subtitle={t(webClient.hasNip07 ? 'settings.extensionDetectedDesc' : 'settings.connectExtensionDesc')}
          onPress={handleConnectExtension}
          right={
            webClient.hasNip07
              ? <LoginBadge label={t('settings.ready')} ready />
              : isRecommended
                ? <LoginBadge label={t('settings.recommended')} />
                : undefined
          }
        />
      );
    }

    const isDesktopWeb = webClient.kind === 'desktop';
    return (
      <SettingsRow
        icon={<ShieldCheck size={20} color="#8E8E93" strokeWidth={2} />}
        title={t(isDesktopWeb ? 'settings.connectNip46Desktop' : 'settings.connectNip46')}
        subtitle={t(isDesktopWeb ? 'settings.connectNip46DesktopDesc' : 'settings.connectNip46Desc')}
        onPress={handleConnectNip46}
        right={
          connectingNip46
            ? <ActivityIndicator size="small" color={colors.accent} />
            : isRecommended
              ? <LoginBadge label={t('settings.recommended')} />
              : undefined
        }
      />
    );
  };

  const selectedThemeLabel =
    preference === 'light'
      ? t('settings.themeLight')
      : preference === 'dark'
        ? t('settings.themeDark')
        : t('settings.themeSystem');

  const themeActions: ActionItem[] = [
    {
      id: 'system',
      label: t('settings.themeSystem'),
      icon: <MonitorSmartphone size={22} color={preference === 'system' ? colors.accent : colors.text} strokeWidth={2.4} />,
      color: preference === 'system' ? colors.accent : undefined,
      immediate: true,
      onPress: () => setPreference('system'),
    },
    {
      id: 'light',
      label: t('settings.themeLight'),
      icon: <Sun size={22} color={preference === 'light' ? colors.accent : colors.text} strokeWidth={2.4} />,
      color: preference === 'light' ? colors.accent : undefined,
      immediate: true,
      onPress: () => setPreference('light'),
    },
    {
      id: 'dark',
      label: t('settings.themeDark'),
      icon: <Moon size={22} color={preference === 'dark' ? colors.accent : colors.text} strokeWidth={2.4} />,
      color: preference === 'dark' ? colors.accent : undefined,
      immediate: true,
      onPress: () => setPreference('dark'),
    },
  ];



  const RelayRow = ({ relay }: { relay: UserRelay }) => (
    <View style={styles.relayRow}>
      <View style={[styles.relayIconBg, { backgroundColor: colors.iconBackground }]}>
        <Radio size={18} color={relay.is_enabled ? colors.accent : colors.textTertiary} strokeWidth={2.5} />
      </View>
      <View style={styles.relayContent}>
        <View style={styles.relayLine}>
          <Text
            style={[styles.relayUrl, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {relay.relay_url}
          </Text>
          {relay.is_default && (
        <View style={styles.relayBadge}>
              <Text style={styles.relayBadgeText} numberOfLines={1}>
                {t('settings.default')}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.relayActions}>
        <CustomSwitch
          value={relay.is_enabled}
          onValueChange={() => handleToggleRelay(relay.id, relay.is_enabled)}
        />
        {!relay.is_default && (
          <TouchableOpacity
            style={styles.relayDeleteBtn}
            onPress={() => handleDeleteRelay(relay.id)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('settings.deleteRelayTitle')}
          >
            <Trash2 size={16} color="#FF453A" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background, zIndex: 101 }} />

      <ScrollView
        style={[
          styles.scrollView,
          { backgroundColor: colors.background },
        ]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Platform.OS === 'web' ? 120 : 100, // Ensure content isn't cut off by absolute tab bar
            backgroundColor: colors.background,
          },
          Platform.OS === 'web' && styles.desktopContent,
        ]}
        fadingEdgeLength={IS_ANDROID ? { start: 32, end: 72 } : undefined}
        overScrollMode={IS_ANDROID ? 'never' : undefined}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : undefined}
      >

        <View style={styles.largeTitleContainer}>
          <Text style={[styles.largeTitle, { color: colors.text }]}>{t('settings.title')}</Text>
        </View>

        {!keys && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <SectionHeader title={t('settings.loginSection')} />

            <View style={[styles.sectionCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
              {Platform.OS === 'web' ? (
                <>
                  {webLoginMethods.map((method, index) => (
                    <Fragment key={method}>
                      {index > 0 && (
                        <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
                      )}
                      {renderWebLoginRow(method)}
                    </Fragment>
                  ))}
                </>
              ) : (
                <>
                  <SettingsRow
                    icon={<User size={20} color="#0A84FF" strokeWidth={2} />}
                    title={t('settings.createIdentity')}
                    subtitle={t('settings.createIdentityDesc')}
                    onPress={handleCreateNewIdentity}
                  />
                  <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
                  <SettingsRow
                    icon={<Upload size={20} color="#8E8E93" strokeWidth={2} />}
                    title={t('settings.importKey')}
                    subtitle={t('settings.importKeyDesc')}
                    onPress={() => setShowImport(true)}
                  />
                </>
              )}
            </View>
          </Animated.View>
        )}

        {!keys && (
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <SectionHeader title={t('settings.appearance')} />
            <View style={[styles.sectionCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
              <SettingsRow
                icon={<Palette size={18} color={colors.accent} strokeWidth={2} />}
                title={t('settings.theme')}
                subtitle={selectedThemeLabel}
                onPress={() => themeSheetRef.current?.open()}
              />
              <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
              <SettingsRow
                icon={<Globe size={18} color="#8E8E93" strokeWidth={2} />}
                title={t('settings.language')}
                subtitle={languageLabel}
                onPress={() => languageSheetRef.current?.open()}
              />
            </View>
          </Animated.View>
        )}

        {keys && (
          <View style={Platform.OS === 'web' ? styles.desktopGrid : undefined}>

            <View style={Platform.OS === 'web' ? styles.desktopColumn : undefined}>

            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <SectionHeader title={t('settings.identityInfo')} />
              <View style={[styles.sectionCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                <View style={styles.keySection}>
                  <View style={styles.keyHeader}>
                    <View style={[styles.keyIconBg, { backgroundColor: colors.iconBackground }]}>
                      <Key size={16} color={colors.accent} strokeWidth={2.5} />
                    </View>
                    <Text style={[styles.keyLabel, { color: colors.text }]}>{t('settings.publicKey')}</Text>
                  </View>
                  <Text style={[styles.keyValue, identityFieldStyle]} numberOfLines={1}>{keys.publicKey}</Text>
                  <TouchableOpacity
                    style={[styles.copyBtn, identityControlStyle]}
                    onPress={() => copyToClipboard(keys.publicKey, t('settings.copyPublicKey'))}
                    activeOpacity={0.7}
                  >
                    <Copy size={14} color="#0A84FF" strokeWidth={2.5} />
                    <Text style={styles.copyBtnText}>{t('common.copy')}</Text>
                  </TouchableOpacity>
                </View>

                {authMethod === AuthMethod.MOBILE_SECURE && keys.privateKey !== 'MANAGED_BY_EXTENSION' && (
                  <>
                    <View style={[styles.sectionDivider, { backgroundColor: colors.divider }]} />
                    <View style={styles.keySection}>
                      <View style={styles.keyHeader}>
                        <View style={[styles.keyIconBg, { backgroundColor: colors.iconBackground }]}>
                          <Lock size={16} color="#8E8E93" strokeWidth={2.5} />
                        </View>
                        <Text style={[styles.keyLabel, { color: colors.text }]}>{t('settings.privateKey')}</Text>
                      </View>
                      <Text style={[styles.keyValue, identityFieldStyle]} numberOfLines={1}>
                        {formatKey(keys.privateKey, showPrivateKey)}
                      </Text>
                      <View style={styles.keyActions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, identityControlStyle]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowPrivateKey(!showPrivateKey);
                          }}
                          activeOpacity={0.7}
                        >
                          {showPrivateKey
                            ? <EyeOff size={14} color="#8E8E93" strokeWidth={2.5} />
                            : <Eye size={14} color="#8E8E93" strokeWidth={2.5} />
                          }
                          <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
                            {showPrivateKey ? t('settings.hide') : t('settings.show')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.copyBtn, identityControlStyle]}
                          onPress={() => copyToClipboard(keys.privateKey, t('settings.copyPrivateKey'))}
                          activeOpacity={0.7}
                        >
                          <Copy size={14} color="#0A84FF" strokeWidth={2.5} />
                          <Text style={styles.copyBtnText}>{t('common.copy')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </View>

              {authMethod === AuthMethod.MOBILE_SECURE && (
                <TouchableOpacity style={styles.exportBtn} onPress={handleExportKey} activeOpacity={0.7}>
                  <Download size={16} color="#0A84FF" strokeWidth={2.5} />
                  <Text style={styles.exportBtnText}>{t('settings.exportPrivateKey')}</Text>
                </TouchableOpacity>
              )}

              <View style={[styles.warningCard, { backgroundColor: colors.elevatedMuted, borderColor: colors.border }]}>
                <Info size={18} color="#0A84FF" strokeWidth={2.5} />
                <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                  {t('settings.privateKeyWarning')}
                </Text>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
              <SectionHeader
                title={t('settings.relayManagement')}
                right={
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setShowAddRelay(true)}
                    activeOpacity={0.7}
                  >
                    <Plus size={18} color="#0A84FF" strokeWidth={2.5} />
                  </TouchableOpacity>
                }
              />
              <View style={[styles.sectionCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                {loadingRelays ? (
                  <View style={styles.relayLoading}>
                    <ActivityIndicator size="small" color="#0A84FF" />
                    <Text style={[styles.relayLoadingText, { color: colors.textSecondary }]}>{t('settings.relaysLoading')}</Text>
                  </View>
                ) : (
                  relays.map((relay, index) => (
                    <View key={relay.id}>
                      {index > 0 && <View style={[styles.relayDivider, { backgroundColor: colors.divider }]} />}
                      <RelayRow relay={relay} />
                    </View>
                  ))
                )}
              </View>
            </Animated.View>
          </View>

          <View style={Platform.OS === 'web' ? styles.desktopColumn : undefined}>

            <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
              <SectionHeader title={t('settings.security')} />
              <View style={[styles.sectionCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                <SettingsRow
                  icon={<ScanFace size={20} color="#0A84FF" strokeWidth={2} />}
                  title={biometricLabel}
                  subtitle={
                    Platform.OS === 'web'
                      ? t('settings.biometricWebUnavailable')
                      : biometricAvailable
                        ? t('settings.biometricEnabledDesc')
                        : t('settings.biometricSetupDesc')
                  }
                  right={
                    <CustomSwitch
                      value={biometricEnabled}
                      onValueChange={handleToggleBiometricAuth}
                      disabled={Platform.OS === 'web' || !biometricAvailable}
                    />
                  }
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
              <SectionHeader title={t('settings.technicalInfo')} />
              <View style={[styles.sectionCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                <SettingsRow
                  icon={<BookOpen size={20} color="#0A84FF" strokeWidth={2} />}
                  title={t('settings.technicalDocs')}
                  subtitle={t('settings.technicalDocsDesc')}
                  onPress={() => router.push('/technical-documentation')}
                />
                <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
                <SettingsRow
                  icon={<Github size={20} color="#8E8E93" strokeWidth={2} />}
                  title={t('settings.sourceCode')}
                  subtitle={t('settings.sourceCodeDesc')}
                  onPress={() => {
                    void Linking.openURL('https://github.com/teskilatsiz/cetele').catch(() => undefined);
                  }}
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(450)} style={styles.section}>
              <SectionHeader title={t('settings.appearance')} />
              <View style={[styles.sectionCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                <SettingsRow
                  icon={<Palette size={18} color={colors.accent} strokeWidth={2} />}
                  title={t('settings.theme')}
                  subtitle={selectedThemeLabel}
                  onPress={() => themeSheetRef.current?.open()}
                />
                <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
                <SettingsRow
                  icon={<Globe size={18} color="#8E8E93" strokeWidth={2} />}
                  title={t('settings.language')}
                  subtitle={languageLabel}
                  onPress={() => languageSheetRef.current?.open()}
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(500)} style={styles.section}>
              <SectionHeader title={t('settings.sessionManagement')} />
              <View style={[styles.sectionCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                <SettingsRow
                  icon={<Trash2 size={18} color="#8E8E93" strokeWidth={2} />}
                  title={t('settings.clearCache')}
                  onPress={handleClearCache}
                />
                <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
                <SettingsRow
                  icon={<LogOut size={18} color="#FF453A" strokeWidth={2} />}
                  title={t('settings.logout')}
                  onPress={handleLogout}
                  destructive
                />
              </View>
            </Animated.View>
          </View>
        </View>
        )}
      </ScrollView>

      <ActionBottomSheet
        ref={themeSheetRef}
        title={t('settings.theme')}
        actions={themeActions}
      />

      <ActionBottomSheet
        ref={languageSheetRef}
        title={t('settings.languageDesc')}
        actions={[
          {
            id: 'tr',
            label: 'Türkçe',
            icon: <Globe size={22} color="#8E8E93" />,
            onPress: () => setLanguage('tr'),
          },
          {
            id: 'en',
            label: 'English',
            icon: <Globe size={22} color="#8E8E93" />,
            onPress: () => setLanguage('en'),
          },
          {
            id: 'ru',
            label: 'Русский',
            icon: <Globe size={22} color="#8E8E93" />,
            onPress: () => setLanguage('ru'),
          },
          {
            id: 'hi',
            label: 'हिन्दी',
            icon: <Globe size={22} color="#8E8E93" />,
            onPress: () => setLanguage('hi'),
          },
          {
            id: 'pt',
            label: 'Português',
            icon: <Globe size={22} color="#8E8E93" />,
            onPress: () => setLanguage('pt'),
          },
        ]}
      />

      <SwipeableBottomSheet
        visible={showNewIdentity}
        onClose={() => setShowNewIdentity(false)}
      >
        <Animated.View
          entering={FadeInDown.duration(500).delay(200)}
          style={styles.biometricIllustration}
        >
          <View style={styles.biometricIconOuter}>
            <View style={styles.biometricIconMiddle}>
              <View style={biometricIconInnerStyle}>
                <User size={48} color="#0A84FF" strokeWidth={1.5} />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350)}>
          <Text style={biometricTitleStyle}>
            {t('settings.newIdentityTitle')}
          </Text>
          <Text style={biometricDescStyle}>
            {t('settings.newIdentityDesc')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(500)} style={styles.biometricActions}>
          <TouchableOpacity
            style={[styles.biometricBtnPrimary, { backgroundColor: colors.accent }]}
            onPress={confirmCreateNewIdentity}
            activeOpacity={0.8}
            disabled={creatingIdentity}
          >
            {creatingIdentity ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <User size={20} color="#FFFFFF" strokeWidth={2} />
            )}
            <Text style={styles.biometricBtnPrimaryText}>
              {creatingIdentity ? t('settings.creatingIdentity') : t('settings.createIdentityButton')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={biometricCancelStyle}
            onPress={() => setShowNewIdentity(false)}
            activeOpacity={0.8}
          >
            <Text style={biometricCancelTextStyle}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </SwipeableBottomSheet>

      <SwipeableBottomSheet
        visible={showAddRelay}
        onClose={() => setShowAddRelay(false)}
        keyboardAware
      >

        <Animated.View
          entering={FadeInDown.duration(500).delay(200)}
          style={styles.compactIllustration}
        >
          <View style={styles.compactIconOuter}>
            <View style={styles.compactIconMiddle}>
              <View style={compactIconInnerStyle}>
                <Radio size={28} color="#0A84FF" strokeWidth={1.5} />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350)}>
          <Text style={sheetTitleStyle}>{t('settings.addRelayTitle')}</Text>
          <Text style={sheetDescStyle}>
            {t('settings.addRelayDesc')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(450)}>
          <View style={styles.inputContainer}>
            <TextInput
              style={sheetInputStyle}
              placeholder="wss://relay.example.com"
              placeholderTextColor={colors.placeholder}
              value={newRelayUrl}
              onChangeText={setNewRelayUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              selectionColor={colors.accent}
              keyboardAppearance={scheme}
              autoFocus
            />
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.sheetBtnPrimary, { backgroundColor: colors.accent }]} onPress={handleAddRelay} activeOpacity={0.8}>
              <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.sheetBtnPrimaryText}>{t('settings.add')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={sheetCancelStyle}
              onPress={() => { setShowAddRelay(false); setNewRelayUrl(''); }}
              activeOpacity={0.8}
            >
              <Text style={cancelTextStyle}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SwipeableBottomSheet>

      <SwipeableBottomSheet
        visible={showImport}
        onClose={() => { setShowImport(false); setImportKey(''); }}
        keyboardAware
      >

        <Animated.View
          entering={FadeInDown.duration(500).delay(200)}
          style={styles.compactIllustration}
        >
          <View style={styles.compactIconOuter}>
            <View style={styles.compactIconMiddle}>
              <View style={compactIconInnerStyle}>
                <Key size={26} color="#0A84FF" strokeWidth={1.5} />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350)}>
          <Text style={sheetTitleStyle}>{t('settings.importKeyTitle')}</Text>
          <Text style={sheetDescStyle}>
            {t('settings.importKeyDesc')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(450)}>
          <View style={styles.inputContainer}>
            <TextInput
              style={sheetInputStyle}
              placeholder={t('settings.importKeyPlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={importKey}
              onChangeText={setImportKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              selectionColor={colors.accent}
              keyboardAppearance={scheme}
              autoFocus
            />
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.sheetBtnPrimary, { backgroundColor: colors.accent }]} onPress={handleImportKey} activeOpacity={0.8}>
              <Upload size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.sheetBtnPrimaryText}>{t('settings.import')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={sheetCancelStyle}
              onPress={() => { setShowImport(false); setImportKey(''); }}
              activeOpacity={0.8}
            >
              <Text style={cancelTextStyle}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SwipeableBottomSheet>

      <SwipeableBottomSheet
        visible={showBiometricOnboarding}
        onClose={() => setShowBiometricOnboarding(false)}
      >

        <Animated.View
          entering={FadeInDown.duration(500).delay(200)}
          style={styles.biometricIllustration}
        >
          <View style={styles.biometricIconOuter}>
            <View style={styles.biometricIconMiddle}>
              <View style={biometricIconInnerStyle}>
                <ScanFace size={48} color="#0A84FF" strokeWidth={1.5} />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350)}>
          <Text style={biometricTitleStyle}>
            {t('biometric.keepPrivateTitle')}
          </Text>
          <Text style={biometricDescStyle}>
            {t('biometric.keepPrivateDesc', { label: biometricLabel })}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(500)} style={styles.biometricActions}>
          <TouchableOpacity
            style={[styles.biometricBtnPrimary, { backgroundColor: colors.accent }]}
            onPress={confirmEnableBiometric}
            activeOpacity={0.8}
          >
            <ScanFace size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.biometricBtnPrimaryText}>{t('biometric.enable')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={biometricCancelStyle}
            onPress={() => setShowBiometricOnboarding(false)}
            activeOpacity={0.8}
          >
            <Text style={biometricCancelTextStyle}>{t('biometric.notNow')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </SwipeableBottomSheet>

      <SwipeableBottomSheet
        visible={showNip46Modal}
        onClose={closeNip46Modal}
      >
        <Animated.View
          entering={FadeInDown.duration(500).delay(150)}
          style={styles.compactIllustration}
        >
          <View style={styles.compactIconOuter}>
            <View style={styles.compactIconMiddle}>
              <View style={compactIconInnerStyle}>
                <ShieldCheck size={30} color="#0A84FF" strokeWidth={1.7} />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(250)}>
          <Text style={sheetTitleStyle}>{t('settings.nip46Title')}</Text>
          <Text style={sheetDescStyle}>
            {t('settings.nip46Desc', {
              apps: Platform.OS === 'android' || webClient.isAndroid
                ? 'Amber, nsec.app, Nowser'
                : 'nsec.app, Nowser'
            })}
          </Text>
          {nip46Uri ? (
            <Text
              selectable
              numberOfLines={3}
              style={[styles.signerUri, identityFieldStyle]}
            >
              {nip46Uri}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.sheetActions}>
          {(isAndroidWeb || Platform.OS === 'android') && (
            <TouchableOpacity
              style={[styles.sheetBtnPrimary, { backgroundColor: colors.accent, marginBottom: 12 }]}
              onPress={() => {
                closeNip46Modal();
                handleConnectAndroidSigner();
              }}
              activeOpacity={0.8}
            >
              {connectingAndroidSigner ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ShieldCheck size={18} color="#FFFFFF" strokeWidth={2.5} />
              )}
              <Text style={styles.sheetBtnPrimaryText}>{t('settings.connectNip55')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.sheetBtnPrimary, { backgroundColor: (isAndroidWeb || Platform.OS === 'android') ? colors.iconBackground : colors.accent }]}
            onPress={copyNip46Uri}
            activeOpacity={0.8}
          >
            {connectingNip46 ? (
              <ActivityIndicator size="small" color={(isAndroidWeb || Platform.OS === 'android') ? colors.accent : "#FFFFFF"} />
            ) : (
              <Copy size={18} color={(isAndroidWeb || Platform.OS === 'android') ? colors.accent : "#FFFFFF"} strokeWidth={2.5} />
            )}
            <Text style={[styles.sheetBtnPrimaryText, (isAndroidWeb || Platform.OS === 'android') && { color: colors.accent }]}>
              {t('settings.copyConnectLink')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={sheetCancelStyle}
            onPress={closeNip46Modal}
            activeOpacity={0.8}
          >
            <Text style={cancelTextStyle}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </SwipeableBottomSheet>

      <SwipeableBottomSheet
        visible={showNip07Modal}
        onClose={() => setShowNip07Modal(false)}
      >
        <Animated.View
          entering={FadeInDown.duration(500).delay(200)}
          style={styles.biometricIllustration}
        >
          <View style={styles.biometricIconOuter}>
            <View style={styles.biometricIconMiddle}>
              <View style={biometricIconInnerStyle}>
                <Chrome size={48} color="#0A84FF" strokeWidth={1.5} />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350)}>
          <Text style={biometricTitleStyle}>
            {t('settings.nip07Title')}
          </Text>
          <Text style={biometricDescStyle}>
            {t('settings.nip07Desc')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(450)} style={{ marginTop: 20, width: '100%', gap: 12 }}>
          <TouchableOpacity
             style={extensionRowStyle}
            onPress={() => Linking.openURL('https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp')}
            activeOpacity={0.7}
          >
            <View style={[styles.settingsIconBg, { backgroundColor: colors.iconBackground }]}>
              <NosBottleIcon size={20} color="#0A84FF" strokeWidth={2} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>nos2x</Text>
              <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]}>{t('settings.nos2xDesc')}</Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
             style={extensionRowStyle}
            onPress={() => Linking.openURL('https://getflamingo.org/')}
            activeOpacity={0.7}
          >
            <View style={[styles.settingsIconBg, { backgroundColor: colors.iconBackground }]}>
              <FlamingoIcon size={20} color="#FF453A" strokeWidth={2} />
            </View>
            <View style={styles.settingsContent}>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>Flamingo</Text>
              <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]}>{t('settings.flamingoDesc')}</Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(550)} style={[styles.biometricActions, { marginTop: 24 }]}>
          <TouchableOpacity
            style={biometricCancelStyle}
            onPress={() => setShowNip07Modal(false)}
            activeOpacity={0.8}
          >
            <Text style={biometricCancelTextStyle}>{t('common.close')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </SwipeableBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  desktopContent: {
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
    width: '100%',
    gap: 20,
  },
  desktopColumn: {
    flex: 1,
    minWidth: 320,
  },

  largeTitleContainer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  largeTitle: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 },

  section: { 
    marginTop: 32, 
    paddingHorizontal: 20,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.5 },
  webLoginContext: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  webLoginContextIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  webLoginContextContent: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  webLoginContextTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  webLoginContextDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  loginBadge: {
    minHeight: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  loginBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(28, 28, 30, 0.9)',
    borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.06)',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },

  settingsRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14, width: '100%', minWidth: 0 },
  settingsIconBg: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  settingsIconBgDestructive: { backgroundColor: 'rgba(255, 69, 58, 0.1)' },
  settingsContent: { flex: 1, gap: 2, minWidth: 0 },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    flexShrink: 1,
    ...(Platform.OS === 'web' ? ({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as any) : null),
  },
  settingsSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    letterSpacing: -0.1,
    flexShrink: 1,
    ...(Platform.OS === 'web' ? ({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as any) : null),
  },
  settingsDestructiveText: { color: '#FF453A' },
  rowDivider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 64 },
  themeBlock: {
    padding: 14,
    gap: 14,
  },
  themeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },
  themeSegmented: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  themeSegment: {
    flex: 1,
    minWidth: 0,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 6,
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  themeSegmentText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0,
  },

  keySection: { padding: 16, gap: 12 },
  keyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  keyIconBg: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  keyLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  keyValue: {
    fontSize: 12, color: '#8E8E93', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  keyActions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  copyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  copyBtnText: { fontSize: 13, fontWeight: '600', color: '#0A84FF' },
  sectionDivider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: 14,
    backgroundColor: 'rgba(10, 132, 255, 0.08)', borderWidth: 0.5,
    borderColor: 'rgba(10, 132, 255, 0.2)',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  exportBtnText: { fontSize: 14, fontWeight: '600', color: '#0A84FF' },
  warningCard: {
    flexDirection: 'row', gap: 12, marginTop: 12, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)', alignItems: 'flex-start',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  warningText: { flex: 1, fontSize: 13, color: '#AEAEB2', lineHeight: 20, fontWeight: '500' },

  addBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(10,132,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  relayLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20 },
  relayLoadingText: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  relayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
    minHeight: 56,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    gap: 10,
  },
  relayDivider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 56 },
  relayIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  relayContent: { flex: 1, minWidth: 0 },
  relayLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 6,
  },
  relayUrl: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0,
    ...(Platform.OS === 'web'
      ? ({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as any)
      : null),
  },
  relayBadge: {
    flexShrink: 0,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(10,132,255,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(10,132,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  relayBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#0A84FF',
    letterSpacing: 0,
  },
  relayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 0,
    marginLeft: 6,
  },
  relayDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,69,58,0.1)',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },

  techCardsScroll: { marginTop: 16 },
  techCardsContainer: { gap: 12, paddingRight: 20 },
  techCard: {
    width: 240, padding: 20, borderRadius: 18, backgroundColor: 'rgba(28,28,30,0.85)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', gap: 12,
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  techCardIconBg: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(10,132,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  techCardTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  techCardDesc: { fontSize: 13, color: '#AEAEB2', lineHeight: 20 },

  footer: { marginTop: 40, marginBottom: 24, paddingHorizontal: 20 },

  modalKeyboardView: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  sheetIconHeader: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  sheetIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0,
    marginBottom: 8,
  },
  sheetDesc: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  inputContainer: {
    marginBottom: 20,
  },
  sheetInput: {
    width: '100%',
    minWidth: 0,
    height: 52,
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  sheetActions: {
    gap: 10,
  },
  signerUri: {
    width: '100%',
    minHeight: 72,
    padding: 12,
    borderRadius: 12,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    overflow: 'hidden',
    marginBottom: 20,
  },
  sheetBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0A84FF',
    paddingVertical: 16,
    borderRadius: 14,
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  sheetBtnPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetBtnCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  sheetBtnCancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#8E8E93',
  },

  biometricIllustration: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 28,
  },

  compactIllustration: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  compactIconOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(10, 132, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactIconMiddle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactIconInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(10, 132, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricIconOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(10, 132, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricIconMiddle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricIconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(10, 132, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0,
    marginBottom: 10,
  },
  biometricDesc: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  biometricActions: {
    gap: 10,
  },
  biometricBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0A84FF',
    paddingVertical: 16,
    borderRadius: 14,
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  biometricBtnPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  biometricBtnCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    ...Platform.select({ ios: { borderCurve: 'continuous' as any } }),
  },
  biometricBtnCancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#8E8E93',
  },
});
