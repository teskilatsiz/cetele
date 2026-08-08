import { useWindowDimensions, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { FileText, Settings } from 'lucide-react-native';
import { useI18n } from '@/lib/i18n';
import { useAppTheme } from '@/lib/theme';

export function AppTabs() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: isDesktop
          ? { display: 'none' }
          : {
              ...(Platform.OS === 'web' 
                ? { minHeight: 60, paddingBottom: 8, paddingTop: 8 } 
                : { height: 64, paddingBottom: 7, paddingTop: 7 }),
              backgroundColor: colors.tabBackground,
              borderTopColor: colors.divider,
              borderTopWidth: 1,
            },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('common.notes'),
          tabBarIcon: ({ color, size }) => (
            <FileText color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('common.settings'),
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
