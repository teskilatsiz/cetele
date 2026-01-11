import { Platform, DynamicColorIOS } from 'react-native';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';
import { Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FileText, PlusCircle, Settings } from 'lucide-react-native';

export default function TabLayout() {
  if (Platform.OS === 'web') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#0A84FF',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarStyle: {
            backgroundColor: '#000000',
            borderTopColor: 'rgba(255, 255, 255, 0.1)',
            borderTopWidth: 1,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Notlar',
            tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="new"
          options={{
            title: 'Yeni',
            tabBarIcon: ({ color, size }) => <PlusCircle size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Ayarlar',
            tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
          }}
        />
      </Tabs>
    );
  }

  return (
    <NativeTabs
      tintColor="#0A84FF"
      minimizeBehavior="onScrollDown"
      barTintColor={Platform.OS === 'android' ? '#000000' : undefined}>
      <NativeTabs.Trigger name="index">
        {Platform.select({
          ios: <Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="description" />} />,
        })}
        <Label>Notlar</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="new">
        {Platform.select({
          ios: <Icon sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }} />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="add-circle" />} />,
        })}
        <Label>Yeni</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        {Platform.select({
          ios: <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />,
          android: <Icon src={<VectorIcon family={MaterialIcons} name="settings" />} />,
        })}
        <Label>Ayarlar</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
