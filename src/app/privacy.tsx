import { useEffect } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaBox } from '@/components/SafeAreaBox';
import { router } from 'expo-router';
import { ScrollShadowOverlay, useScrollShadow } from '@/components/ScrollShadowOverlay';
import { useAppTheme } from '@/lib/theme';

const sections = [
  {
    title: 'Verileriniz nasıl korunur?',
    body: 'Çetele, notlarınızı cihazınızda şifreler ve hiçbir zaman düz metin olarak bir sunucuya göndermez. Notlarınız yalnızca sizin gizli anahtarınızla açılabilir.',
  },
  {
    title: 'Kimliğiniz ve anahtarlarınız',
    body: 'Kimliğiniz bir anahtar çiftiyle temsil edilir. Gizli anahtarınız mobilde cihazınızın güvenli deposunda saklanır. Web sürümünde NIP-46 Nostr Connect, Android’de NIP-55 signer veya NIP-07 tarayıcı imzalayıcısı kullanılabilir; bu yöntemlerde gizli anahtarınız Çetele’ye verilmez.',
  },
  {
    title: 'Röle sunucuları',
    body: 'Röle sunucuları, şifrelenmiş notlarınızın iletildiği ve saklandığı ara istasyonlardır. Röle işletmecileri notlarınızın içeriğini göremez ve çözemez.',
  },
  {
    title: 'Biyometrik doğrulama',
    body: 'Yüz tanıma veya parmak izi gibi biyometrik doğrulama yalnızca cihazınızın kendi güvenlik sistemi tarafından yürütülür. Çetele, biyometrik verilerinizi hiçbir şekilde toplamaz veya saklamaz.',
  },
  {
    title: 'Web kullanımı',
    body: 'Web ve mobil web sürümünde gizli anahtarınızı doğrudan girmek yerine Nostr Connect veya desteklenen bir signer kullanmanız önerilir. Çetele yalnızca genel anahtarınızı ve signer tarafından onaylanmış imzaları alır. Signer uygulamasının güvenlik ve saklama davranışı ilgili uygulamanın sorumluluğundadır.',
  },
  {
    title: 'Bize ulaşın',
    body: 'Gizlilik veya güvenlik ile ilgili sorularınız için proje deposu üzerinden bizimle iletişime geçebilirsiniz.',
  },
];

export default function PrivacyPolicyScreen() {
  const { width } = useWindowDimensions();
  const { shadows, onScroll } = useScrollShadow({ offset: 8 });
  const { colors } = useAppTheme();
  const contentWidth = Math.min(width - 32, 760);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/');
    }
  }, []);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { width: contentWidth }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        <View style={styles.header}>
          <Text style={[styles.kicker, { color: colors.accent }]}>ÇETELE</Text>
          <Text style={[styles.title, { color: colors.text }]}>Gizlilik Politikası</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Çetele, notlarınızı cihazınızda şifreleyen ve merkeziyetsiz röle ağı
            üzerinden güvenle saklayan, gizliliğe öncelik veren bir not
            uygulamasıdır.
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.divider }]} />

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{section.body}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: colors.iconBackground, borderColor: colors.border }]}
          onPress={() => Linking.openURL('https://github.com/teskilatsiz/cetele')}
          activeOpacity={0.8}
        >
          <Text style={[styles.linkButtonText, { color: colors.accent }]}>Proje deposu</Text>
        </TouchableOpacity>

        <Text style={[styles.footer, { color: colors.textTertiary }]}>Son güncelleme: 13 Haziran 2026</Text>
      </ScrollView>

      <ScrollShadowOverlay top={shadows.top} bottom={shadows.bottom} />
    </SafeAreaBox>
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
  content: {
    alignSelf: 'center',
    paddingTop: 72,
    paddingBottom: 72,
  },
  header: {
    gap: 14,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 52,
  },
  description: {
    fontSize: 18,
    lineHeight: 29,
    maxWidth: 620,
  },
  divider: {
    height: 1,
    marginVertical: 36,
  },
  section: {
    marginBottom: 28,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  sectionBody: {
    fontSize: 16,
    lineHeight: 27,
  },
  linkButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 12,
  },
  linkButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    fontSize: 13,
    marginTop: 36,
  },
});
