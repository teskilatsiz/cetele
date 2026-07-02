export type WebClientKind =
  | 'unknown'
  | 'desktop'
  | 'android'
  | 'ios-safari'
  | 'ios-browser'
  | 'mobile';

export interface WebClientInfo {
  kind: WebClientKind;
  isMobile: boolean;
  isAndroid: boolean;
  isIos: boolean;
  isSafari: boolean;
  hasNip07: boolean;
}

export const UNKNOWN_WEB_CLIENT: WebClientInfo = {
  kind: 'unknown',
  isMobile: false,
  isAndroid: false,
  isIos: false,
  isSafari: false,
  hasNip07: false,
};

interface NavigatorWithClientHints extends Navigator {
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
}

/**
 * Platform hints only tailor labels and option ordering. Signer support is
 * always checked separately by capability (for example window.nostr).
 */
export function detectWebClient(): WebClientInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return UNKNOWN_WEB_CLIENT;
  }

  const nav = navigator as NavigatorWithClientHints;
  const userAgent = nav.userAgent || '';
  const platform = nav.userAgentData?.platform || nav.platform || '';
  const hasTouchScreen = (nav.maxTouchPoints || 0) > 1;

  const isAndroid = /android/i.test(platform) || /android/i.test(userAgent);
  const isIpadDesktopMode = /mac/i.test(platform) && hasTouchScreen;
  const isIos = /iphone|ipad|ipod/i.test(userAgent) || isIpadDesktopMode;
  const isMobile =
    Boolean(nav.userAgentData?.mobile) ||
    isAndroid ||
    isIos ||
    /mobile/i.test(userAgent);
  const isSafari =
    isIos &&
    /safari/i.test(userAgent) &&
    !/crios|fxios|edgios|opios|duckduckgo/i.test(userAgent);
  const nostr = (window as typeof window & {
    nostr?: { getPublicKey?: unknown; signEvent?: unknown };
  }).nostr;
  const hasNip07 =
    typeof nostr?.getPublicKey === 'function' &&
    typeof nostr?.signEvent === 'function';

  const kind: WebClientKind = isAndroid
    ? 'android'
    : isSafari
      ? 'ios-safari'
      : isIos
        ? 'ios-browser'
        : isMobile
          ? 'mobile'
          : 'desktop';

  return {
    kind,
    isMobile,
    isAndroid,
    isIos,
    isSafari,
    hasNip07,
  };
}

export function isAndroidWebClient(): boolean {
  return detectWebClient().isAndroid;
}
