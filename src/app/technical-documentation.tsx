import { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaBox } from '@/components/SafeAreaBox';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  FadeInDown,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { BlurTargetView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useI18n } from '@/lib/i18n';
import { getDocs } from '@/lib/docs-i18n';
import { useAppTheme } from '@/lib/theme';
import { ProgressiveBlurView } from '@/components/ProgressiveBlurView';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function TechnicalDocumentationScreen() {
  const { language } = useI18n();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View | null>(null);
  const d = getDocs(language);
  const scrollY = useSharedValue(0);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const headerHeight = insets.top + 52;
  const headerFadeHeight = headerHeight + 64;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 72], [0, 1], Extrapolation.CLAMP),
  }));

  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [24, 68], [0, 1], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(scrollY.value, [24, 68], [10, 0], Extrapolation.CLAMP),
    }],
  }));

  const themed = {
    headerTitle: [styles.headerTitle, { color: colors.text }],
    mainTitle: [styles.mainTitle, { color: colors.text }],
    abstract: [styles.abstract, { color: colors.textSecondary, borderLeftColor: colors.accent }],
    sectionNumber: [styles.sectionNumber, { color: colors.accent }],
    sectionTitle: [styles.sectionTitle, { color: colors.text }],
    subsectionTitle: [styles.subsectionTitle, { color: colors.text }],
    paragraph: [styles.paragraph, { color: colors.textSecondary }],
    listItem: [styles.listItem, { color: colors.textSecondary }],
    formula: [styles.formula, { backgroundColor: colors.iconBackground, borderColor: colors.border }],
    formulaText: [styles.formulaText, { color: colors.accent }],
    footer: [styles.footer, { borderTopColor: colors.divider }],
    footerTitle: [styles.footerTitle, { color: colors.text }],
    reference: [styles.reference, { color: colors.textSecondary }],
    endNote: [styles.endNote, { backgroundColor: colors.elevated, borderColor: colors.border }],
    endNoteText: [styles.endNoteText, { color: colors.textSecondary }],
  };

  return (
    <SafeAreaBox style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>

      <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
        <AnimatedScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight }, isTablet && { maxWidth: 1000, alignSelf: 'center' as const }]}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        onScroll={scrollHandler}
        scrollEventThrottle={16}>
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.content}>
          <Text style={themed.mainTitle}>
            {d.mainTitle}
          </Text>

          <Text style={themed.abstract}>
            {d.abstract}
          </Text>

          <View style={styles.section}>
            <Text style={themed.sectionNumber}>{d.s1.split(" ")[0]}</Text>
            <View style={styles.sectionContent}>
              <Text style={themed.sectionTitle}>{d.s1.split(" ").slice(1).join(" ")}</Text>
              <Text style={themed.paragraph}>
                {d.s1p1}
              </Text>
              <Text style={themed.paragraph}>
                {d.s1p2}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={themed.sectionNumber}>{d.s2.split(" ")[0]}</Text>
            <View style={styles.sectionContent}>
              <Text style={themed.sectionTitle}>{d.s2.split(" ").slice(1).join(" ")}</Text>
              <Text style={themed.paragraph}>
                {d.s2p1}
              </Text>
              <View style={styles.list}>
                <Text style={themed.listItem}>
                  {d.s2l1}
                </Text>
                <Text style={themed.listItem}>
                  {d.s2l2}
                </Text>
                <Text style={themed.listItem}>
                  {d.s2l3}
                </Text>
                <Text style={themed.listItem}>
                  {d.s2l4}
                </Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s2p2}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={themed.sectionNumber}>{d.s3.split(" ")[0]}</Text>
            <View style={styles.sectionContent}>
              <Text style={themed.sectionTitle}>{d.s3.split(" ").slice(1).join(" ")}</Text>
              <Text style={themed.subsectionTitle}>{d.s3_1}</Text>
              <Text style={themed.paragraph}>
                {d.s3_1p1}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>y² = x³ + 7 (mod p)</Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s3_1p2}
              </Text>

              <Text style={themed.subsectionTitle}>{d.s3_2}</Text>
              <Text style={themed.paragraph}>
                {d.s3_2p1}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>
                  sk ∈ [1, n-1]{'\n'}
                  n = FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
                </Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s3_2p2}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>pk = sk × G</Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s3_2p3}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={themed.sectionNumber}>{d.s4.split(" ")[0]}</Text>
            <View style={styles.sectionContent}>
              <Text style={themed.sectionTitle}>{d.s4.split(" ").slice(1).join(" ")}</Text>
              <Text style={themed.paragraph}>
                {d.s4p1}
              </Text>

              <Text style={themed.subsectionTitle}>{d.s4_1}</Text>
              <Text style={themed.paragraph}>
                {d.s4_1p1}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>
                  Paylaşılan Nokta = sk_gönderen × pk_alıcı = sk_alıcı × pk_gönderen
                </Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s4_1p2}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>conversation_key = SHA256(shared_x)</Text>
              </View>

              <Text style={themed.subsectionTitle}>{d.s4_2}</Text>
              <Text style={themed.paragraph}>
                {d.s4_2p1}
              </Text>
              <Text style={themed.paragraph}>
                {d.s4_2p2}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>
                  [constant constant constant constant]{'\n'}
                  [   key      key      key      key   ]{'\n'}
                  [   key      key      key      key   ]{'\n'}
                  [  nonce    nonce   counter  counter ]
                </Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s4_2p3}
              </Text>
              <View style={styles.list}>
                <Text style={themed.listItem}>
                  1. Quarter Round: a += b; d ^= a; d &lt;&lt;&lt;= 16
                </Text>
                <Text style={themed.listItem}>
                  2. Quarter Round: c += d; b ^= c; b &lt;&lt;&lt;= 12
                </Text>
                <Text style={themed.listItem}>
                  3. Quarter Round: a += b; d ^= a; d &lt;&lt;&lt;= 8
                </Text>
                <Text style={themed.listItem}>
                  4. Quarter Round: c += d; b ^= c; b &lt;&lt;&lt;= 7
                </Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s4_2p4}
              </Text>

              <Text style={themed.subsectionTitle}>{d.s4_3}</Text>
              <Text style={themed.paragraph}>
                {d.s4_3p1}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>
                  MAC = (c₁r¹ + c₂r² + ... + cᵢrⁱ + s) mod p
                </Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s4_3p2}
              </Text>

              <Text style={themed.subsectionTitle}>{d.s4_4}</Text>
              <Text style={themed.paragraph}>
                {d.s4_4p1}
              </Text>
              <View style={styles.list}>
                <Text style={themed.listItem}>
                  {d.s4_4l1}
                </Text>
                <Text style={themed.listItem}>
                  {d.s4_4l2}
                </Text>
                <Text style={themed.listItem}>
                  {d.s4_4l3}
                </Text>
                <Text style={themed.listItem}>
                  {d.s4_4l4}
                </Text>
                <Text style={themed.listItem}>
                  {d.s4_4l5}
                </Text>
                <Text style={themed.listItem}>
                  {d.s4_4l6}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={themed.sectionNumber}>{d.s5.split(" ")[0]}</Text>
            <View style={styles.sectionContent}>
              <Text style={themed.sectionTitle}>{d.s5.split(" ").slice(1).join(" ")}</Text>
              <Text style={themed.paragraph}>
                {d.s5p1}
              </Text>

              <Text style={themed.subsectionTitle}>{d.s5_1}</Text>
              <Text style={themed.paragraph}>
                {d.s5_1p1}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>
                  ephemeral_sk = random_256_bit(){'\n'}
                  ephemeral_pk = ephemeral_sk × G{'\n'}
                  sealed_event = sign(inner_event, ephemeral_sk)
                </Text>
              </View>

              <Text style={themed.subsectionTitle}>{d.s5_2}</Text>
              <Text style={themed.paragraph}>
                {d.s5_2p1}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>
                  encrypted_content = NIP44_encrypt(sealed_event, recipient_pk){'\n'}
                  gift_wrap = {'{'}{'\n'}
                  {'  '}kind: 1059,{'\n'}
                  {'  '}content: encrypted_content,{'\n'}
                  {'  '}pubkey: ephemeral_pk,{'\n'}
                  {'  '}created_at: obfuscated_timestamp{'\n'}
                  {'}'}
                </Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s5_2p2}
              </Text>

              <Text style={themed.subsectionTitle}>{d.s5_3}</Text>
              <View style={styles.list}>
                <Text style={themed.listItem}>
                  {d.s5_3l1}
                </Text>
                <Text style={themed.listItem}>
                  {d.s5_3l2}
                </Text>
                <Text style={themed.listItem}>
                  {d.s5_3l3}
                </Text>
                <Text style={themed.listItem}>
                  {d.s5_3l4}
                </Text>
                <Text style={themed.listItem}>
                  {d.s5_3l5}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={themed.sectionNumber}>{d.s6.split(" ")[0]}</Text>
            <View style={styles.sectionContent}>
              <Text style={themed.sectionTitle}>{d.s6.split(" ").slice(1).join(" ")}</Text>

              <Text style={themed.subsectionTitle}>{d.s6_1}</Text>
              <View style={styles.list}>
                <Text style={themed.listItem}>
                  {d.s6_1l1}
                </Text>
                <Text style={themed.listItem}>
                  {d.s6_1l2}
                </Text>
                <Text style={themed.listItem}>
                  {d.s6_1l3}
                </Text>
              </View>

              <Text style={themed.subsectionTitle}>{d.s6_2}</Text>
              <Text style={themed.paragraph}>
                {d.s6_2p1}
              </Text>

              <Text style={themed.subsectionTitle}>{d.s6_3}</Text>
              <Text style={themed.paragraph}>
                {d.s6_3p1}
              </Text>

              <Text style={themed.subsectionTitle}>{d.s6_4}</Text>
              <View style={styles.list}>
                <Text style={themed.listItem}>
                  {d.s6_4l1}
                </Text>
                <Text style={themed.listItem}>
                  {d.s6_4l2}
                </Text>
                <Text style={themed.listItem}>
                  {d.s6_4l3}
                </Text>
                <Text style={themed.listItem}>
                  {d.s6_4l4}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={themed.sectionNumber}>{d.s7.split(" ")[0]}</Text>
            <View style={styles.sectionContent}>
              <Text style={themed.sectionTitle}>{d.s7.split(" ").slice(1).join(" ")}</Text>

              <Text style={themed.subsectionTitle}>{d.s7_1}</Text>
              <Text style={themed.paragraph}>
                {d.s7_1p1}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>
                  a + b ≡ c (mod p){'\n'}
                  a × b ≡ c (mod p){'\n'}
                  a⁻¹ × a ≡ 1 (mod p)
                </Text>
              </View>

              <Text style={themed.subsectionTitle}>{d.s7_2}</Text>
              <Text style={themed.paragraph}>
                {d.s7_2p1}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>
                  λ = (y₂ - y₁) / (x₂ - x₁) mod p{'\n'}
                  x₃ = λ² - x₁ - x₂ mod p{'\n'}
                  y₃ = λ(x₁ - x₃) - y₁ mod p{'\n'}
                  R = P + Q = (x₃, y₃)
                </Text>
              </View>

              <Text style={themed.subsectionTitle}>{d.s7_3}</Text>
              <Text style={themed.paragraph}>
                {d.s7_3p1}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>
                  n × P = P + P + ... + P (n kere)
                </Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s7_3p2}
              </Text>

              <Text style={themed.subsectionTitle}>{d.s7_4}</Text>
              <Text style={themed.paragraph}>
                {d.s7_4p1}
              </Text>
              <View style={themed.formula}>
                <Text style={themed.formulaText}>
                  PRK = HMAC-SHA256(salt, IKM){'\n'}
                  OKM = HMAC-SHA256(PRK, info || 0x01)
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={themed.sectionNumber}>{d.s8.split(" ")[0]}</Text>
            <View style={styles.sectionContent}>
              <Text style={themed.sectionTitle}>{d.s8.split(" ").slice(1).join(" ")}</Text>

              <Text style={themed.subsectionTitle}>{d.s8_1}</Text>
              <Text style={themed.paragraph}>
                {d.s8_1p1}
              </Text>
              <Text style={themed.paragraph}>
                {d.s8_1p2}
              </Text>

              <Text style={themed.subsectionTitle}>{d.s8_2}</Text>
              <View style={styles.list}>
                <Text style={themed.listItem}>
                  {d.s8_2l1}
                </Text>
                <Text style={themed.listItem}>
                  {d.s8_2l2}
                </Text>
                <Text style={themed.listItem}>
                  {d.s8_2l3}
                </Text>
              </View>

              <Text style={themed.subsectionTitle}>{d.s8_3}</Text>
              <Text style={themed.paragraph}>
                {d.s8_3p1}
              </Text>
              <View style={styles.list}>
                <Text style={themed.listItem}>
                  {d.s8_3l1}
                </Text>
                <Text style={themed.listItem}>
                  {d.s8_3l2}
                </Text>
                <Text style={themed.listItem}>
                  {d.s8_3l3}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={themed.sectionNumber}>{d.s9.split(" ")[0]}</Text>
            <View style={styles.sectionContent}>
              <Text style={themed.sectionTitle}>{d.s9.split(" ").slice(1).join(" ")}</Text>
              <Text style={themed.paragraph}>
                {d.s9p1}
              </Text>
              <Text style={themed.paragraph}>
                {d.s9p2}
              </Text>
              <View style={styles.list}>
                <Text style={themed.listItem}>
                  {d.s9l1}
                </Text>
                <Text style={themed.listItem}>
                  {d.s9l2}
                </Text>
                <Text style={themed.listItem}>
                  {d.s9l3}
                </Text>
                <Text style={themed.listItem}>
                  {d.s9l4}
                </Text>
                <Text style={themed.listItem}>
                  {d.s9l5}
                </Text>
              </View>
              <Text style={themed.paragraph}>
                {d.s9p3}
              </Text>
            </View>
          </View>

          <View style={themed.footer}>
            <Text style={themed.footerTitle}>{d.references}</Text>
            <View style={styles.references}>
              <Text style={themed.reference}>
                [1] Nostr Protocol - Notes and Other Stuff Transmitted by Relays
              </Text>
              <Text style={themed.reference}>
                [2] NIP-44: Encrypted Direct Message (Versioned)
              </Text>
              <Text style={themed.reference}>
                [3] NIP-59: Gift Wrap
              </Text>
              <Text style={themed.reference}>
                [4] RFC 7539: ChaCha20 and Poly1305 for IETF Protocols
              </Text>
              <Text style={themed.reference}>
                [5] RFC 5869: HMAC-based Extract-and-Expand Key Derivation Function
              </Text>
              <Text style={themed.reference}>
                [6] SEC 2: Recommended Elliptic Curve Domain Parameters (secp256k1)
              </Text>
              <Text style={themed.reference}>
                [7] D.J. Bernstein: ChaCha, a variant of Salsa20
              </Text>
              <Text style={themed.reference}>
                [8] RFC 7748: Elliptic Curves for Security
              </Text>
            </View>
          </View>

          <View style={themed.endNote}>
            <Text style={themed.endNoteText}>
              {d.endnote}
            </Text>
          </View>
        </Animated.View>
        </AnimatedScrollView>
      </BlurTargetView>

      <Animated.View
        pointerEvents="none"
        style={[styles.headerBackdrop, { height: headerFadeHeight }, headerBlurStyle]}
      >
        <ProgressiveBlurView
          intensity={20}
          tint={colors.blurTint}
          blurTarget={blurTargetRef}
          fallbackColor={colors.header}
        />
      </Animated.View>

      <View style={[styles.header, { height: headerHeight, paddingTop: insets.top }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.iconBackground }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          activeOpacity={0.7}>
          <X size={22} color={colors.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
        <Animated.Text style={[themed.headerTitle, compactTitleStyle]}>{d.headerTitle}</Animated.Text>
        <View style={styles.headerSpacer} />
      </View>
    </SafeAreaBox>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 100,
  },
  headerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
  },
  blurTarget: {
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 24,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  abstract: {
    fontSize: 16,
    color: '#AEAEB2',
    lineHeight: 26,
    marginBottom: 40,
    fontStyle: 'italic',
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0A84FF',
  },
  section: {
    marginBottom: 32,
    flexDirection: 'row',
  },
  sectionNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A84FF',
    marginRight: 12,
    width: 32,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EEEEEE',
    marginTop: 20,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  paragraph: {
    fontSize: 16,
    color: '#EEEEEE',
    lineHeight: 28,
    marginBottom: 16,
    letterSpacing: -0.1,
  },
  list: {
    marginVertical: 12,
    paddingLeft: 8,
  },
  listItem: {
    fontSize: 15,
    color: '#EEEEEE',
    lineHeight: 26,
    marginBottom: 8,
    letterSpacing: -0.1,
  },
  formula: {
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.2)',
  },
  formulaText: {
    fontSize: 14,
    color: '#0A84FF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 24,
  },
  footer: {
    marginTop: 48,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  references: {
    paddingLeft: 8,
  },
  reference: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 22,
    marginBottom: 8,
    letterSpacing: -0.1,
  },
  endNote: {
    marginTop: 32,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  endNoteText: {
    fontSize: 14,
    color: '#AEAEB2',
    lineHeight: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
