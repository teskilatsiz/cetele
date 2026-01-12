import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

export default function TechnicalDocumentationScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}>
          <BlurView intensity={30} tint="dark" style={styles.backButtonBlur}>
            <ArrowLeft size={22} color="#FFFFFF" strokeWidth={2.5} />
          </BlurView>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Teknik Dokümantasyon</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}>
          <Text style={styles.mainTitle}>
            Çetele: Merkeziyetsiz Şifreli Not Uygulaması
          </Text>

          <Text style={styles.abstract}>
            Çetele, Nostr protokolü üzerine inşa edilmiş, kriptografik olarak güvenli
            bir not alma ve paylaşma sistemidir. Bu dokümantasyon, sistemin matematiksel
            temellerini, şifreleme mekanizmalarını ve güvenlik modelini detaylıca açıklar.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionNumber}>1.</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Giriş</Text>
              <Text style={styles.paragraph}>
                Geleneksel not alma uygulamaları, kullanıcı verilerini merkezi sunucularda
                depolar ve bu veriler üzerinde tam kontrol sahibi olmayı sağlamaz. Çetele,
                Nostr (Notes and Other Stuff Transmitted by Relays) protokolünü kullanarak
                merkeziyetsiz bir mimari sunar ve NIP-44 şifreleme standardı ile verilerinizi
                kriptografik olarak korur.
              </Text>
              <Text style={styles.paragraph}>
                Bu sistemde, notlarınız birden fazla relay'e dağıtılır ve hiçbir tek nokta
                verilerinize erişemez. Tüm şifreleme ve şifre çözme işlemleri istemci tarafında
                gerçekleşir, bu da verilerinizin her zaman kontrolünüzde kalmasını sağlar.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionNumber}>2.</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Nostr Protokolü Temelleri</Text>
              <Text style={styles.paragraph}>
                Nostr, basit ve esnek bir protokoldür. Temel yapı taşları:
              </Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  • Olaylar (Events): JSON formatında mesajlar
                </Text>
                <Text style={styles.listItem}>
                  • İstemciler (Clients): Olay üreten ve tüketen uygulamalar
                </Text>
                <Text style={styles.listItem}>
                  • Relay'ler: Olayları ileten sunucular
                </Text>
                <Text style={styles.listItem}>
                  • Anahtarlar: secp256k1 eliptik eğri kriptografisi
                </Text>
              </View>
              <Text style={styles.paragraph}>
                Her kullanıcı bir anahtar çifti oluşturur. Gizli anahtar (private key) 256 bitlik
                rastgele bir sayıdır ve tüm işlemleri imzalamak için kullanılır. Genel anahtar
                (public key) bu gizli anahtardan türetilir ve kullanıcının kimliğini temsil eder.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionNumber}>3.</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Kriptografik Temeller</Text>
              <Text style={styles.subsectionTitle}>3.1 Eliptik Eğri Kriptografisi</Text>
              <Text style={styles.paragraph}>
                Sistem, secp256k1 eliptik eğrisini kullanır. Bu eğri şu denklemi sağlar:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>y² = x³ + 7 (mod p)</Text>
              </View>
              <Text style={styles.paragraph}>
                Burada p = 2²⁵⁶ - 2³² - 2⁹ - 2⁸ - 2⁷ - 2⁶ - 2⁴ - 1, yaklaşık 2²⁵⁶ büyüklüğünde
                bir asal sayıdır.
              </Text>

              <Text style={styles.subsectionTitle}>3.2 Anahtar Çifti Oluşturma</Text>
              <Text style={styles.paragraph}>
                Gizli anahtar sk, 1 ile n-1 arasında rastgele seçilen bir tam sayıdır, burada
                n eğrinin mertebesidir:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  sk ∈ [1, n-1]{'\n'}
                  n = FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
                </Text>
              </View>
              <Text style={styles.paragraph}>
                Genel anahtar pk, gizli anahtarın generator noktası G ile skaler çarpımıdır:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>pk = sk × G</Text>
              </View>
              <Text style={styles.paragraph}>
                Bu işlem eliptik eğri üzerinde tekrarlı nokta toplama ile gerçekleşir ve
                tek yönlü bir fonksiyondur (hesaplaması kolay, tersini almak hesaplama açısından
                imkansızdır - Ayrık Logaritma Problemi).
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionNumber}>4.</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>NIP-44 Şifreleme Standardı</Text>
              <Text style={styles.paragraph}>
                NIP-44, XChaCha20-Poly1305 algoritmasını kullanan bir şifreleme standardıdır.
                Bu hibrit şifreleme sistemi hem simetrik hem de asimetrik kriptografiyi birleştirir.
              </Text>

              <Text style={styles.subsectionTitle}>4.1 ECDH (Elliptic Curve Diffie-Hellman)</Text>
              <Text style={styles.paragraph}>
                İki taraf arasında paylaşılan bir sır oluşturmak için ECDH kullanılır:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  Paylaşılan Nokta = sk_gönderen × pk_alıcı = sk_alıcı × pk_gönderen
                </Text>
              </View>
              <Text style={styles.paragraph}>
                Bu işlem değişme özelliği sayesinde her iki tarafta da aynı noktayı üretir.
                Paylaşılan noktanın x koordinatı conversation key olarak kullanılır:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>conversation_key = SHA256(shared_x)</Text>
              </View>

              <Text style={styles.subsectionTitle}>4.2 XChaCha20 Stream Cipher</Text>
              <Text style={styles.paragraph}>
                XChaCha20, ChaCha20'nin genişletilmiş nonce versiyonudur. 192-bit nonce
                kullanır, bu da collision riskini pratikte sıfırlar.
              </Text>
              <Text style={styles.paragraph}>
                ChaCha20'nin temel yapısı 4x4'lük bir state matrisdir:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  [constant constant constant constant]{'\n'}
                  [   key      key      key      key   ]{'\n'}
                  [   key      key      key      key   ]{'\n'}
                  [  nonce    nonce   counter  counter ]
                </Text>
              </View>
              <Text style={styles.paragraph}>
                Bu matris üzerinde 20 çift round (toplam 20 round) çalıştırılır. Her round:
              </Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  1. Quarter Round: a += b; d ^= a; d &lt;&lt;&lt;= 16
                </Text>
                <Text style={styles.listItem}>
                  2. Quarter Round: c += d; b ^= c; b &lt;&lt;&lt;= 12
                </Text>
                <Text style={styles.listItem}>
                  3. Quarter Round: a += b; d ^= a; d &lt;&lt;&lt;= 8
                </Text>
                <Text style={styles.listItem}>
                  4. Quarter Round: c += d; b ^= c; b &lt;&lt;&lt;= 7
                </Text>
              </View>
              <Text style={styles.paragraph}>
                Bu işlemler column rounds ve diagonal rounds olarak uygulanır, ardından
                orijinal state ile toplanır. Çıktı keystream, plaintext ile XOR'lanarak
                ciphertext üretir.
              </Text>

              <Text style={styles.subsectionTitle}>4.3 Poly1305 MAC</Text>
              <Text style={styles.paragraph}>
                Poly1305, 130-bit anahtar ve 16-byte mesaj için bir MAC hesaplar.
                Asal sayı p = 2¹³⁰ - 5 üzerinde çalışır:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  MAC = (c₁r¹ + c₂r² + ... + cᵢrⁱ + s) mod p
                </Text>
              </View>
              <Text style={styles.paragraph}>
                Burada r anahtar, c₁...cᵢ mesaj blokları ve s bir nonce değeridir.
                Bu, mesajın bütünlüğünü ve orijinalliğini garanti eder.
              </Text>

              <Text style={styles.subsectionTitle}>4.4 Şifreleme Süreci</Text>
              <Text style={styles.paragraph}>
                Tam şifreleme işlemi:
              </Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  1. 192-bit rastgele nonce üret
                </Text>
                <Text style={styles.listItem}>
                  2. ECDH ile conversation_key hesapla
                </Text>
                <Text style={styles.listItem}>
                  3. HKDF ile encryption_key ve mac_key türet
                </Text>
                <Text style={styles.listItem}>
                  4. Plaintext'i XChaCha20 ile şifrele
                </Text>
                <Text style={styles.listItem}>
                  5. Poly1305 ile MAC hesapla
                </Text>
                <Text style={styles.listItem}>
                  6. version || nonce || ciphertext || mac birleştir
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionNumber}>5.</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Gift Wrapping (NIP-59)</Text>
              <Text style={styles.paragraph}>
                Gift wrapping, metadata gizliliğini sağlamak için ek bir şifreleme katmanıdır.
                Gerçek event, rastgele bir geçici anahtar çifti ile şifrelenir ve kind 1059
                event'ine sarılır.
              </Text>

              <Text style={styles.subsectionTitle}>5.1 Sealed Event (İç Katman)</Text>
              <Text style={styles.paragraph}>
                Gerçek event, rastgele bir keypair (ephemeral key) ile imzalanır:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  ephemeral_sk = random_256_bit(){'\n'}
                  ephemeral_pk = ephemeral_sk × G{'\n'}
                  sealed_event = sign(inner_event, ephemeral_sk)
                </Text>
              </View>

              <Text style={styles.subsectionTitle}>5.2 Gift Wrap (Dış Katman)</Text>
              <Text style={styles.paragraph}>
                Sealed event, alıcının public key'i ile NIP-44 şifrelenir:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  encrypted_content = NIP44_encrypt(sealed_event, recipient_pk){'\n'}
                  gift_wrap = {'{'}{'\n'}
                  {'  '}kind: 1059,{'\n'}
                  {'  '}content: encrypted_content,{'\n'}
                  {'  '}pubkey: ephemeral_pk,{'\n'}
                  {'  '}created_at: obfuscated_timestamp{'\n'}
                  {'}'}
                </Text>
              </View>
              <Text style={styles.paragraph}>
                Obfuscated timestamp, gerçek zaman ± 2 gün rastgele değer ile gizlenir.
                Bu, timing analizini engeller.
              </Text>

              <Text style={styles.subsectionTitle}>5.3 Açma Süreci</Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  1. Gift wrap event'ini al
                </Text>
                <Text style={styles.listItem}>
                  2. ECDH ile ephemeral_pk ve recipient_sk kullanarak conversation_key hesapla
                </Text>
                <Text style={styles.listItem}>
                  3. Encrypted content'i NIP-44 ile çöz
                </Text>
                <Text style={styles.listItem}>
                  4. Sealed event'i elde et
                </Text>
                <Text style={styles.listItem}>
                  5. İmzayı doğrula ve inner event'i al
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionNumber}>6.</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Güvenlik Analizi</Text>

              <Text style={styles.subsectionTitle}>6.1 Şifreleme Gücü</Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  • secp256k1: 2²⁵⁶ brute-force karmaşıklığı (128-bit güvenlik seviyesi)
                </Text>
                <Text style={styles.listItem}>
                  • XChaCha20: 256-bit anahtar, 192-bit nonce (teoride kırılamaz)
                </Text>
                <Text style={styles.listItem}>
                  • Poly1305: 128-bit güvenlik seviyesi (forgery probability 2⁻¹²⁸)
                </Text>
              </View>

              <Text style={styles.subsectionTitle}>6.2 Forward Secrecy</Text>
              <Text style={styles.paragraph}>
                Gift wrapping mekanizması, her mesaj için yeni bir ephemeral key çifti
                oluşturduğundan, uzun dönemli anahtarların ele geçirilmesi geçmiş mesajların
                şifresini çözmez. Bu perfect forward secrecy sağlar.
              </Text>

              <Text style={styles.subsectionTitle}>6.3 Metadata Gizliliği</Text>
              <Text style={styles.paragraph}>
                Relay'ler sadece şifreli blob'ları görür. Gönderen, alıcı ve içerik bilgileri
                gizlidir. Timestamp obfuscation ile timing analizi de engellenir.
              </Text>

              <Text style={styles.subsectionTitle}>6.4 Saldırı Senaryoları</Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  • Passive Eavesdropping: Relay'ler sadece şifreli veri görür
                </Text>
                <Text style={styles.listItem}>
                  • Man-in-the-Middle: Public key doğrulaması ile engellenir
                </Text>
                <Text style={styles.listItem}>
                  • Replay Attacks: Nonce ve timestamp ile engellenir
                </Text>
                <Text style={styles.listItem}>
                  • Brute Force: 2²⁵⁶ işlem gerektirir (evrenin yaşından uzun)
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionNumber}>7.</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Matematiksel İşlemler</Text>

              <Text style={styles.subsectionTitle}>7.1 Modüler Aritmetik</Text>
              <Text style={styles.paragraph}>
                Tüm işlemler sonlu alan üzerinde gerçekleşir:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  a + b ≡ c (mod p){'\n'}
                  a × b ≡ c (mod p){'\n'}
                  a⁻¹ × a ≡ 1 (mod p)
                </Text>
              </View>

              <Text style={styles.subsectionTitle}>7.2 Eliptik Eğri Nokta Toplama</Text>
              <Text style={styles.paragraph}>
                İki nokta P(x₁, y₁) ve Q(x₂, y₂) için:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  λ = (y₂ - y₁) / (x₂ - x₁) mod p{'\n'}
                  x₃ = λ² - x₁ - x₂ mod p{'\n'}
                  y₃ = λ(x₁ - x₃) - y₁ mod p{'\n'}
                  R = P + Q = (x₃, y₃)
                </Text>
              </View>

              <Text style={styles.subsectionTitle}>7.3 Skaler Çarpma</Text>
              <Text style={styles.paragraph}>
                n × P işlemi double-and-add algoritması ile optimize edilir:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  n × P = P + P + ... + P (n kere)
                </Text>
              </View>
              <Text style={styles.paragraph}>
                Binary representation kullanılarak O(log n) karmaşıklığa indirilir.
              </Text>

              <Text style={styles.subsectionTitle}>7.4 HKDF (Key Derivation)</Text>
              <Text style={styles.paragraph}>
                HMAC-based Key Derivation Function, master key'den alt anahtarlar türetir:
              </Text>
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  PRK = HMAC-SHA256(salt, IKM){'\n'}
                  OKM = HMAC-SHA256(PRK, info || 0x01)
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionNumber}>8.</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Uygulama Detayları</Text>

              <Text style={styles.subsectionTitle}>8.1 Anahtar Yönetimi</Text>
              <Text style={styles.paragraph}>
                Mobil: iOS ve Android'de Secure Enclave/Keystore kullanılır. Gizli anahtarlar
                hardware-backed encryption ile korunur.
              </Text>
              <Text style={styles.paragraph}>
                Web: NIP-07 browser extension kullanılır. Gizli anahtar tarayıcı eklentisinde
                saklanır ve asla web sayfasına aktarılmaz.
              </Text>

              <Text style={styles.subsectionTitle}>8.2 Performans Optimizasyonları</Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  • Precomputed tables: Sık kullanılan nokta çarpımları önceden hesaplanır
                </Text>
                <Text style={styles.listItem}>
                  • Batch verification: Çoklu imza doğrulamaları toplu yapılır
                </Text>
                <Text style={styles.listItem}>
                  • Local caching: Şifresi çözülmüş notlar yerel olarak önbelleğe alınır
                </Text>
              </View>

              <Text style={styles.subsectionTitle}>8.3 Relay Stratejisi</Text>
              <Text style={styles.paragraph}>
                Notlar minimum 3 relay'e gönderilir. Bu:
              </Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  • Availability: Tek bir relay çökse bile erişilebilirlik devam eder
                </Text>
                <Text style={styles.listItem}>
                  • Censorship resistance: Tüm relay'leri engellemek pratik olarak imkansızdır
                </Text>
                <Text style={styles.listItem}>
                  • Data redundancy: Veri kaybı riski minimize edilir
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionNumber}>9.</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>Sonuç</Text>
              <Text style={styles.paragraph}>
                Çetele, modern kriptografik ilkeleri Nostr'un merkeziyetsiz mimarisi ile
                birleştirerek güvenli, özel ve sansüre dayanıklı bir not alma sistemi sunar.
              </Text>
              <Text style={styles.paragraph}>
                Sistem, matematiksel olarak kanıtlanmış güvenlik özellikleri sağlar:
              </Text>
              <View style={styles.list}>
                <Text style={styles.listItem}>
                  • Şifreleme: XChaCha20-Poly1305 (256-bit güvenlik)
                </Text>
                <Text style={styles.listItem}>
                  • Kimlik: secp256k1 ECDSA (128-bit güvenlik)
                </Text>
                <Text style={styles.listItem}>
                  • Forward Secrecy: Ephemeral keys
                </Text>
                <Text style={styles.listItem}>
                  • Metadata Privacy: Gift wrapping
                </Text>
                <Text style={styles.listItem}>
                  • Decentralization: Multiple relay architecture
                </Text>
              </View>
              <Text style={styles.paragraph}>
                Bu dokümanda açıklanan protokol, akademik standartlara uygun, peer-reviewed
                kriptografik ilkelere dayanır ve pratik güvenlik tehditlerine karşı dirençlidir.
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerTitle}>Referanslar</Text>
            <View style={styles.references}>
              <Text style={styles.reference}>
                [1] Nostr Protocol - Notes and Other Stuff Transmitted by Relays
              </Text>
              <Text style={styles.reference}>
                [2] NIP-44: Encrypted Direct Message (Versioned)
              </Text>
              <Text style={styles.reference}>
                [3] NIP-59: Gift Wrap
              </Text>
              <Text style={styles.reference}>
                [4] RFC 7539: ChaCha20 and Poly1305 for IETF Protocols
              </Text>
              <Text style={styles.reference}>
                [5] RFC 5869: HMAC-based Extract-and-Expand Key Derivation Function
              </Text>
              <Text style={styles.reference}>
                [6] SEC 2: Recommended Elliptic Curve Domain Parameters (secp256k1)
              </Text>
              <Text style={styles.reference}>
                [7] D.J. Bernstein: ChaCha, a variant of Salsa20
              </Text>
              <Text style={styles.reference}>
                [8] RFC 7748: Elliptic Curves for Security
              </Text>
            </View>
          </View>

          <View style={styles.endNote}>
            <Text style={styles.endNoteText}>
              Bu dokümantasyon, Çetele projesinin teknik detaylarını açıklar ve
              akademik inceleme için hazırlanmıştır. Tüm kriptografik işlemler
              endüstri standardı kütüphaneler kullanılarak gerçekleştirilir.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  backButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#00D9FF',
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
