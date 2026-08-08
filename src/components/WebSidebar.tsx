import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { FileText, Settings } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CeteleLogo } from './CeteleLogo';
import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

function SidebarBrand() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.set(withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    ));
  }, [pulse]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: 0.88 + pulse.get() * 0.12,
    transform: [{ scale: 1 + pulse.get() * 0.035 }],
  }));

  return (
    <View style={styles.brand}>
      <Animated.View
        style={[
          styles.logoMark,
          {
            backgroundColor: colors.iconBackground,
            borderColor: colors.border,
          },
          logoStyle,
        ]}
      >
        <CeteleLogo size={38} color={colors.accent} strokeWidth={3} />
      </Animated.View>
      <View style={styles.brandTextWrap}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Çetele</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('web.encryptedNotes')}</Text>
      </View>
    </View>
  );
}

function NavItem({ icon: Icon, label, path }: { icon: any; label: string; path: string }) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const selected = path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <TouchableOpacity
      style={[
        styles.navItem,
        selected && { backgroundColor: colors.iconBackground },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
      ]}
      onPress={() => router.push(path as any)}
      activeOpacity={0.7}
    >
      <Icon size={24} color={selected ? colors.accent : colors.textSecondary} strokeWidth={selected ? 2.5 : 2} />
      <Text style={[styles.navLabel, { color: selected ? colors.accent : colors.textSecondary }, selected && styles.navLabelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function WebSidebar() {
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();

  if (Platform.OS !== 'web') return null;

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: scheme === 'dark' ? '#000000' : colors.background,
          borderRightColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <SidebarBrand />
      </View>
      <View style={styles.navContainer}>
        <NavItem icon={FileText} label={t('common.notes')} path="/" />
        <NavItem icon={Settings} label={t('common.settings')} path="/settings" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 264,
    borderRightWidth: 1,
    height: '100%',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 34,
    paddingHorizontal: 8,
  },
  brand: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  brandTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: 0,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  navContainer: {
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  navLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  navLabelSelected: {
    fontWeight: '600',
  },
});
