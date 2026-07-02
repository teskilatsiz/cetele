import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { t } from '@/lib/i18n';

const BIOMETRIC_AUTH_ENABLED_KEY = 'biometric_auth_enabled';

export type AuthType = 'biometric';

export interface AuthenticationResult {
  success: boolean;
  authType?: AuthType;
  error?: string;
}

export interface BiometricStatus {
  available: boolean;
  enrolled: boolean;
  level: LocalAuthentication.SecurityLevel;
  types: LocalAuthentication.AuthenticationType[];
  label: string;
}

export class BiometricAuthService {
  async getBiometricStatus(): Promise<BiometricStatus> {
    if (Platform.OS === 'web') {
      return {
        available: false,
        enrolled: false,
        level: LocalAuthentication.SecurityLevel.NONE,
        types: [],
        label: t('biometric.unsupportedWeb'),
      };
    }

    try {
      const [hasHardware, enrolled, level, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.getEnrolledLevelAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      const isAvailable =
        hasHardware &&
        enrolled &&
        level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;

      return {
        available: isAvailable,
        enrolled,
        level,
        types,
        label: this.getBiometricLabel(types),
      };
    } catch (error) {
      console.error('Error checking biometric status:', error);
      return {
        available: false,
        enrolled: false,
        level: LocalAuthentication.SecurityLevel.NONE,
        types: [],
        label: t('biometric.unavailable'),
      };
    }
  }

  private getBiometricLabel(types: LocalAuthentication.AuthenticationType[]): string {
    if (Platform.OS === 'ios') {

      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'Face ID';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'Touch ID';
      }
      return t('biometric.generic');
    }

    if (Platform.OS === 'android') {

      const labels: string[] = [];
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        labels.push(t('biometric.faceAndroid'));
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        labels.push(t('biometric.fingerprint'));
      }
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        labels.push(t('biometric.iris'));
      }
      return labels.length > 0 ? labels.join(' / ') : t('biometric.generic');
    }

    return t('biometric.generic');
  }

  async authenticate(promptMessage: string = t('biometric.prompt')): Promise<AuthenticationResult> {
    try {
      if (Platform.OS === 'web') {
        return { success: false, error: t('biometric.unsupportedWeb') };
      }

      const status = await this.getBiometricStatus();
      if (!status.available || !status.enrolled) {
        return {
          success: false,
          error: t('biometric.notEnrolled'),
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: t('biometric.cancel'),
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true, authType: 'biometric' };
      }

      return {
        success: false,
        error: this.getAuthenticationErrorMessage(result.error),
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: t('biometric.error') };
    }
  }

  private getAuthenticationErrorMessage(error?: LocalAuthentication.LocalAuthenticationError): string {
    switch (error) {
      case 'not_enrolled':
        return t('biometric.notEnrolled');
      case 'passcode_not_set':
        return t('biometric.passcodeNotSet');
      case 'not_available':
        return t('biometric.notAvailable');
      case 'lockout':
        return t('biometric.lockout');
      case 'user_cancel':
      case 'system_cancel':
      case 'app_cancel':
        return t('biometric.authCancelled');
      case 'user_fallback':
        return t('biometric.fallback');
      default:
        return t('biometric.failed');
    }
  }

  async isBiometricAuthEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_AUTH_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric auth enabled status:', error);
      return false;
    }
  }

  async setBiometricAuthEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRIC_AUTH_ENABLED_KEY, enabled.toString());
    } catch (error) {
      console.error('Error setting biometric auth enabled status:', error);
    }
  }

  async shouldRequireBiometricAuth(): Promise<boolean> {
    return this.isBiometricAuthEnabled();
  }
}

export const biometricAuthService = new BiometricAuthService();
