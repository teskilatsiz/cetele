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
import { ScrollShadowOverlay, useScrollShadow } from '@/components/ScrollShadowOverlay';
import { useAppTheme } from '@/lib/theme';

export default function SupportScreen() {
  const { width } = useWindowDimensions();
  const { shadows, onScroll } = useScrollShadow({ offset: 8 });
  const { colors } = useAppTheme();
  const contentWidth = Math.min(width - 32, 760);

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

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
          <Text style={[styles.title, { color: colors.text }]}>Destek ve İletişim</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Çetele ile ilgili herhangi bir soru, öneri veya yardıma ihtiyacınız olduğunda 
            aşağıdaki kanallardan bizimle iletişime geçebilirsiniz.
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.divider }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Bize Ulaşın</Text>
          <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
            Proje hakkındaki geri bildirimleriniz ve hata bildirimleriniz bizim için çok değerli. En hızlı geri dönüş için e-posta gönderebilir veya GitHub üzerinden bir konu (issue) açabilirsiniz.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.linkButton, { backgroundColor: colors.iconBackground, borderColor: colors.border }]}
              onPress={() => openLink('mailto:teskilatsiz@gmail.com')}
              activeOpacity={0.8}
            >
              <Text style={[styles.linkButtonText, { color: colors.accent }]}>teskilatsiz@gmail.com</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkButton, { backgroundColor: colors.iconBackground, borderColor: colors.border }]}
              onPress={() => openLink('https://x.com/teskilatsiz')}
              activeOpacity={0.8}
            >
              <Text style={[styles.linkButtonText, { color: colors.accent }]}>x.com/teskilatsiz</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkButton, { backgroundColor: colors.iconBackground, borderColor: colors.border }]}
              onPress={() => openLink('https://github.com/teskilatsiz')}
              activeOpacity={0.8}
            >
              <Text style={[styles.linkButtonText, { color: colors.accent }]}>github.com/teskilatsiz</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.divider }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Sıkça Sorulan Sorular</Text>
          <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
            Şifrenizi veya gizli anahtarınızı kaybederseniz notlarınızı kurtarmanın bir yolu yoktur. 
            Çetele merkeziyetsizdir ve şifre sıfırlama hizmeti sunmaz. Anahtarlarınızı her zaman 
            güvenli bir yere yedeklediğinizden emin olun.
          </Text>
        </View>

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
    paddingTop: Platform.OS === 'web' ? 72 : 32,
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
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  linkButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  linkButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
