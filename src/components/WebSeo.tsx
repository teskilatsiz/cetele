import Head from 'expo-router/head';
import { usePathname } from 'expo-router';
import { Platform } from 'react-native';

const DEFAULT_SITE_URL = 'https://cetele.app';
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
const OG_IMAGE_URL = `${SITE_URL}/cetele-og.png`;

const PUBLIC_PAGES: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Çetele — Nostr Tabanlı Şifreli Not Uygulaması',
    description:
      'Notlarınızı cihazınızda şifreleyin; Nostr rölelerinde merkeziyetsiz ve sansüre dayanıklı biçimde saklayın. iOS, Android ve web için Çetele.',
  },
  '/privacy': {
    title: 'Gizlilik Politikası — Çetele',
    description:
      'Çetele’nin Nostr kimliğinizi, şifreli notlarınızı, röle bağlantılarını ve cihaz verilerinizi nasıl koruduğunu öğrenin.',
  },
  '/support': {
    title: 'Destek ve İletişim — Çetele',
    description:
      'Çetele hakkında yardım alın, geri bildirim gönderin veya açık kaynak proje kanallarından geliştiriciyle iletişime geçin.',
  },
  '/technical-documentation': {
    title: 'Teknik Dokümantasyon — Çetele',
    description:
      'Çetele’nin Nostr, NIP-44 şifreleme, röle senkronizasyonu ve anahtar güvenliği mimarisini inceleyin.',
  },
};

export function WebSeo() {
  const pathname = usePathname();
  if (Platform.OS !== 'web') return null;

  const normalizedPath = pathname === '/index' ? '/' : pathname;
  const page = PUBLIC_PAGES[normalizedPath];
  const isPublicPage = Boolean(page);
  const title = page?.title || 'Çetele — Şifreli Notlar';
  const description =
    page?.description || 'Çetele özel uygulama alanı. Bu sayfa arama motorları tarafından dizine eklenmez.';
  const canonicalUrl = `${SITE_URL}${normalizedPath === '/' ? '/' : normalizedPath}`;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="robots"
        content={isPublicPage ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive'}
      />
      <meta
        name="googlebot"
        content={isPublicPage ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive'}
      />
      {isPublicPage && <link rel="canonical" href={canonicalUrl} />}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Çetele" />
      <meta property="og:locale" content="tr_TR" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={OG_IMAGE_URL} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Çetele şifreli not uygulaması" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE_URL} />
      <meta name="twitter:image:alt" content="Çetele şifreli not uygulaması" />
    </Head>
  );
}
