import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const FACE_LOCK_ENABLED_KEY = 'face_lock_enabled';
const PIN_LOCK_ENABLED_KEY = 'pin_lock_enabled';
const FINGERPRINT_LOCK_ENABLED_KEY = 'fingerprint_lock_enabled';

export type AuthType = 'face' | 'pin' | 'fingerprint';

export interface AuthenticationResult {
  success: boolean;
  authType?: AuthType;
  error?: string;
}

export class BiometricAuthService {
  async hasFaceRecognition(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return false;

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    } catch (error) {
      console.error('Error checking face recognition:', error);
      return false;
    }
  }

  async hasFingerprint(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return false;

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    } catch (error) {
      console.error('Error checking fingerprint:', error);
      return false;
    }
  }

  async authenticate(promptMessage: string = 'Kimliğinizi Doğrulayın'): Promise<AuthenticationResult> {
    try {
      if (Platform.OS === 'web') {
        return { success: false, error: 'Web platformunda desteklenmiyor' };
      }

      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        return { success: false, error: 'Cihaz desteklemiyor' };
      }

      const faceEnabled = await this.isFaceLockEnabled();
      const pinEnabled = await this.isPinLockEnabled();
      const fingerprintEnabled = await this.isFingerprintLockEnabled();

      if (!faceEnabled && !pinEnabled && !fingerprintEnabled) {
        return { success: false, error: 'Kilit etkin değil' };
      }

      const hasFace = await this.hasFaceRecognition();
      const hasFingerprint = await this.hasFingerprint();

      let authType: AuthType = 'pin';
      if (faceEnabled && hasFace) {
        authType = 'face';
      } else if (fingerprintEnabled && hasFingerprint) {
        authType = 'fingerprint';
      } else if (pinEnabled) {
        authType = 'pin';
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'PIN Kullan',
        cancelLabel: 'İptal',
        disableDeviceFallback: false,
        requireConfirmation: false,
      });

      if (result.success) {
        return { success: true, authType };
      } else {
        return { success: false, error: 'Kimlik doğrulama başarısız' };
      }
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: 'Doğrulama hatası' };
    }
  }

  async isFaceLockEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(FACE_LOCK_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking face lock enabled status:', error);
      return false;
    }
  }

  async setFaceLockEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(FACE_LOCK_ENABLED_KEY, enabled.toString());
    } catch (error) {
      console.error('Error setting face lock enabled status:', error);
    }
  }

  async isPinLockEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(PIN_LOCK_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking pin lock enabled status:', error);
      return false;
    }
  }

  async setPinLockEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(PIN_LOCK_ENABLED_KEY, enabled.toString());
    } catch (error) {
      console.error('Error setting pin lock enabled status:', error);
    }
  }

  async isFingerprintLockEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(FINGERPRINT_LOCK_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking fingerprint lock enabled status:', error);
      return false;
    }
  }

  async setFingerprintLockEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(FINGERPRINT_LOCK_ENABLED_KEY, enabled.toString());
    } catch (error) {
      console.error('Error setting fingerprint lock enabled status:', error);
    }
  }

  async shouldShowLockScreen(): Promise<boolean> {
    const faceEnabled = await this.isFaceLockEnabled();
    const pinEnabled = await this.isPinLockEnabled();
    const fingerprintEnabled = await this.isFingerprintLockEnabled();
    return faceEnabled || pinEnabled || fingerprintEnabled;
  }
}

export const biometricAuthService = new BiometricAuthService();
