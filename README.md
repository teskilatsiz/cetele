<div align="center">
  <img src="./assets/images/cetele.png" alt="Çetele logo" width="150" />
  <h1>Çetele</h1>
  <p>Privacy-first, decentralized note-taking on Nostr.</p>

  <p>
    <img src="https://img.shields.io/badge/React_Native-0.86.2-blue.svg?style=flat-square" alt="React Native" />
    <img src="https://img.shields.io/badge/Expo-57.0.11-black.svg?style=flat-square" alt="Expo" />
    <img src="https://img.shields.io/badge/TypeScript-6.0.3-blue.svg?style=flat-square" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Nostr_Tools-2.23.9-purple.svg?style=flat-square" alt="Nostr Tools" />
  </p>

  <a href="https://apps.apple.com/tr/app/%C3%A7etele-%C5%9Fifreli-notlar/id6780082788">
    <img src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83" alt="Download on the App Store" width="150" />
  </a>
</div>

> “Privacy is necessary for an open society in the electronic age.” — Eric Hughes, *A Cypherpunk's Manifesto* (1993)

Çetele encrypts notes on the device and synchronizes them through Nostr relays. It uses versioned NIP-44 authenticated encryption and NIP-59 gift wrapping to reduce metadata exposure.

## Features

- End-to-end encrypted notes
- Decentralized synchronization through configurable Nostr relays
- Rich-text editing and local offline cache
- Biometric app lock on supported devices
- Secure local key storage on mobile and NIP-07 support on web
- iOS, Android, and web support
- No account, email, analytics, or telemetry

## Getting started

```bash
git clone https://github.com/teskilatsiz/cetele.git
cd cetele
npm install
npm run build:web
```

Native builds require the corresponding platform tools and Expo Application Services:

```bash
eas build --platform ios
eas build --platform android
```

On first launch, create a Nostr identity, import an existing key, or connect a NIP-07 extension on the web. Back up your private key securely: losing it can make encrypted notes unrecoverable.

## Security

Çetele uses NIP-44 v2 (secp256k1 ECDH, HKDF, ChaCha20, HMAC-SHA256, and padding) with NIP-59 gift wrapping. NIP-44 does not provide forward secrecy, post-compromise security, or post-quantum security. A compromised device or exposed private key can reveal note content.

See the [NIP-44 specification](https://github.com/nostr-protocol/nips/blob/master/44.md) and [NIP-59 specification](https://github.com/nostr-protocol/nips/blob/master/59.md) for protocol details and limitations.

## Architecture

```text
┌──────────────────┐
│   Your Device    │
│ Notes + Identity │
└────────┬─────────┘
         │ NIP-44 encrypted
         │ NIP-59 gift-wrapped
         ▼
┌──────────────────┐
│   Nostr Relays   │
│ ┌─────┐ ┌─────┐  │
│ │  A  │ │  B  │  │
│ └─────┘ └─────┘  │
└────────┬─────────┘
         │ encrypted synchronization
         ▼
┌──────────────────┐
│  Another Device  │
│ Decrypts locally │
└──────────────────┘
```

## Project structure

```text
cetele/
├── src/app/          # Expo Router routes and layouts
├── src/components/   # Shared and platform-specific UI
├── src/lib/          # Nostr, encryption, export, and theme services
├── src/locales/      # Localization files
├── assets/images/    # App icons and images
├── app.json          # Expo configuration
└── package.json      # Scripts and dependencies
```

## Sources and references

- [Nostr protocol](https://nostr.com/)
- [NIP-44: Encrypted Payloads](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-59: Gift Wrap](https://github.com/nostr-protocol/nips/blob/master/59.md)
- [A Cypherpunk's Manifesto — Eric Hughes](https://www.activism.net/cypherpunk/manifesto.html)
- [The Crypto Anarchist Manifesto — Timothy C. May](https://groups.csail.mit.edu/mac/classes/6.805/articles/crypto/cypherpunks/may-crypto-manifesto.html)

## License

[MIT](./LICENSE)
