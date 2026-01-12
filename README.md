# Çetele

**Privacy is a right. Encryption is freedom. Your thoughts, encrypted and uncensorable.**

A decentralized note-taking application built on the Nostr protocol with military-grade NIP-44 encryption. No servers. No surveillance. No compromise.

```
"Privacy is necessary for an open society in the electronic age."
- A Cypherpunk's Manifesto, Eric Hughes, 1993
```

## Manifesto

We believe:
- Your thoughts belong to you, and you alone
- No corporation should read your private notes
- No government should access your encrypted data
- Centralized services are single points of failure and censorship
- End-to-end encryption should be the default, not an option
- Decentralization is not a feature, it's a necessity

Cypherpunks write code. This is our code.

## What Makes Çetele Different

### True End-to-End Encryption
- **NIP-44 Encryption**: XChaCha20-Poly1305 authenticated encryption
- **No Server Access**: Your notes are encrypted on-device before transmission
- **Zero-Knowledge Architecture**: Relays only see encrypted blobs
- **Perfect Forward Secrecy**: Each note uses ephemeral keys via gift wrapping (NIP-59)

### Decentralized by Design
- **Nostr Protocol**: No single point of failure or censorship
- **Multiple Relays**: Your data is distributed across relay networks
- **Censorship Resistant**: Blocking all relays is practically impossible
- **Self-Sovereign Identity**: You own your cryptographic keys

### Client-Side Security
- **Biometric Lock**: Hardware-backed authentication (Secure Enclave/Keystore)
- **NIP-07 Support**: Browser extension integration for web (no key exposure)
- **Secure Key Storage**: Private keys never leave secure hardware
- **Open Source**: Audit the code yourself

## Technical Architecture

```
┌─────────────────┐
│   Your Device   │
│  (Encryption)   │
└────────┬────────┘
         │ NIP-44 Encrypted
         │ Gift Wrapped (NIP-59)
         │
    ┌────▼────┐
    │  Relay  │──────┐
    └─────────┘      │
                     │ Redundancy
    ┌─────────┐      │ Censorship
    │  Relay  │◄─────┤ Resistance
    └─────────┘      │
                     │
    ┌─────────┐      │
    │  Relay  │◄─────┘
    └─────────┘
```

### Encryption Flow

1. **Key Generation**: secp256k1 elliptic curve cryptography (same as Bitcoin)
2. **ECDH**: Elliptic Curve Diffie-Hellman for shared secret
3. **NIP-44**: XChaCha20 stream cipher + Poly1305 MAC
4. **Gift Wrap**: Additional layer with ephemeral keys for metadata privacy
5. **Relay Distribution**: Encrypted events published to multiple relays

### Why This Matters

Traditional note apps:
- Store plaintext on corporate servers
- Can read all your data
- Single point of failure
- Subject to government subpoenas
- Can be shut down

Çetele:
- Encrypted before leaving your device
- Relays cannot decrypt content
- Distributed across multiple relays
- Cryptographically protected
- Unstoppable

## Features

### Core Functionality
- **Rich Text Editor**: Format notes with markdown, lists, headings, links
- **Instant Sync**: Real-time synchronization across devices via Nostr relays
- **Offline Support**: Local cache with eventual consistency
- **Cross-Platform**: iOS, Android, Web (with NIP-07)
- **Relay Management**: Configure your own relay list

### Security Features
- **NIP-44 Encryption**: Industry-standard authenticated encryption
- **NIP-59 Gift Wrapping**: Metadata privacy layer
- **Biometric Lock**: Face ID, Touch ID, Fingerprint
- **Hardware Security**: Secure Enclave (iOS), Keystore (Android)
- **NIP-07 Extension**: Secure key management on web

### Privacy Features
- **Zero Metadata Leakage**: Timestamps obfuscated, sender/receiver hidden
- **No Tracking**: No analytics, no telemetry
- **No Registration**: Just generate keys and start using
- **No Email Required**: Cryptographic identity only
- **No Phone Number**: Complete anonymity possible

## Releases

### Version 1.0.1 (Latest)

**Release Date**: January 2026

First stable release of Çetele - Privacy-first encrypted note-taking on Nostr.

**Features:**
- NIP-44 Encryption with XChaCha20-Poly1305 authenticated encryption
- NIP-59 Gift Wrapping for metadata privacy
- Biometric authentication (Face ID, Touch ID, Fingerprint)
- Hardware-backed secure key storage (Secure Enclave/Keystore)
- Rich text editor with markdown support (bold, italic, headings, lists, links)
- Multi-relay support with custom relay configuration
- Offline caching with eventual consistency
- Cross-platform support (iOS, Android, Web)
- NIP-07 browser extension support for web
- Real-time note synchronization across devices
- Zero-knowledge architecture - relays cannot decrypt content
- No registration, email, or phone number required

**Security:**
- 128-bit security level via secp256k1
- Perfect Forward Secrecy with ephemeral keys
- Authenticated encryption prevents tampering
- Metadata privacy through gift wrapping
- All encryption happens client-side

**Download:**
- Android: APK available for direct installation
- iOS: Soon

**Technical Stack:**
- Expo SDK 54
- React Native 0.81
- TypeScript
- nostr-tools 2.19
- expo-local-authentication for biometric lock

---

## Getting Started

### Installation

```bash
git clone https://github.com/teskilatsiz/cetele.git
cd cetele
npm install
npm run dev
```

### First Launch

1. **Create Identity**: Generate a new cryptographic keypair, or
2. **Import Keys**: Use existing Nostr keys (nsec/hex), or
3. **Browser Extension**: Connect via NIP-07 extension (web only)

**CRITICAL**: Backup your private key immediately. Loss means permanent data loss. Write it down. Store it securely.

### Security Best Practices

- **Never share your private key** (nsec)
- **Use hardware security** (Secure Enclave/Keystore on mobile)
- **Use NIP-07 extensions** (Alby, nos2x) on web - never paste keys into websites
- **Enable biometric lock** for device protection
- **Use multiple relays** for redundancy

## Architecture

```
cetele/
├── app/                    # Routes (Expo Router)
├── components/            # UI Components
├── lib/
│   ├── nostr.ts          # Nostr protocol implementation
│   │                      # - NIP-44 encryption
│   │                      # - NIP-59 gift wrapping
│   │                      # - Relay management
│   │                      # - Key derivation (ECDH)
│   └── biometric-auth.ts # Hardware-backed authentication
├── types/                 # TypeScript definitions
└── hooks/                # React hooks
```

## Technical Stack

- **Protocol**: Nostr (NIPs: 01, 44, 59)
- **Encryption**: XChaCha20-Poly1305 (NIP-44)
- **Signatures**: secp256k1 ECDSA
- **Key Exchange**: ECDH (Elliptic Curve Diffie-Hellman)
- **Framework**: React Native + Expo
- **Language**: TypeScript
- **Crypto Library**: nostr-tools

## Cryptography Details

### NIP-44 Encryption Scheme

```
conversation_key = ECDH(sender_private_key, recipient_public_key)
encryption_key = HKDF(conversation_key, salt, info)
nonce = random_192_bits()
ciphertext = XChaCha20(plaintext, encryption_key, nonce)
mac = Poly1305(ciphertext, mac_key)
output = version || nonce || ciphertext || mac
```

### Gift Wrapping (NIP-59)

Adds an additional encryption layer with ephemeral keys to hide:
- Real sender identity
- Real recipient identity
- Actual timestamp (obfuscated ±2 days)
- Event kind and content

### Security Properties

- **128-bit security level** (via secp256k1)
- **Perfect Forward Secrecy** (ephemeral keys)
- **Authenticated Encryption** (Poly1305 MAC)
- **Metadata Privacy** (gift wrapping)
- **Replay Protection** (nonces)

## Development

### Building from Source

```bash
# Web
npm run build:web

# iOS (requires Mac + Xcode)
eas build --platform ios

# Android
eas build --platform android
```

### Running Tests

```bash
npm run typecheck
npm run lint
```

### Contributing

Cypherpunks write code. If you believe in privacy, encryption, and freedom:

1. Fork this repository
2. Write code that respects user privacy
3. Test thoroughly (security matters)
4. Submit a pull request
5. No license restrictions - code wants to be free

**Rules:**
- Never compromise encryption
- Never add telemetry or tracking
- Never weaken security for "convenience"
- Peer review all cryptographic code
- Document security decisions

## FAQ

### Is this really secure?

The encryption scheme (NIP-44) uses:
- XChaCha20-Poly1305 (256-bit security)
- ECDH key exchange (128-bit security)
- Authenticated encryption (prevents tampering)
- Gift wrapping (metadata privacy)

Same cryptographic primitives used by Signal, WireGuard, and TLS 1.3.

### Can relays read my notes?

No. Relays only see:
- Encrypted blob (ciphertext)
- Random public key (from gift wrapping)
- Obfuscated timestamp
- Event kind (always 1059 for gift-wrapped events)

They cannot decrypt content without your private key.

### What if a relay goes down?

Your notes are distributed across multiple relays. Losing one relay doesn't mean data loss. You can:
- Configure 3+ relays for redundancy
- Add/remove relays at any time
- Run your own relay

### Can this be censored?

Technically possible but practically difficult:
- No central server to shut down
- Must block all relays individually
- Anyone can run a relay
- Tor-compatible for extra censorship resistance

### Is this anonymous?

Pseudonymous by default (cryptographic identity), anonymous with care:
- No email/phone required
- Use Tor for network anonymity
- Generate fresh keys for each identity
- Gift wrapping hides metadata

### Can I export my data?

Yes. You own:
- Your private key (backup securely)
- Your encrypted events (stored on relays)
- Full data portability

Any Nostr client can read your notes with your private key.

## Threat Model

**Protected Against:**
- Passive eavesdropping (encryption)
- Malicious relays (end-to-end encryption)
- Man-in-the-middle attacks (authenticated encryption + signatures)
- Metadata analysis (gift wrapping)
- Single point of failure (decentralization)
- Government subpoenas (zero-knowledge architecture)
- Data breaches (no plaintext storage)

**NOT Protected Against:**
- Device compromise (keyloggers, screen capture)
- Weak passphrases (use strong biometrics)
- User error (sharing private keys)
- Supply chain attacks (verify builds, use open source)
- Quantum computers (upgrade to post-quantum crypto when available)

## Philosophy

### Why Decentralization Matters

Centralized services are honeypots. When data is concentrated:
- One breach compromises everyone
- One subpoena reveals millions
- One decision shuts down everything
- Power corrupts absolutely

Decentralization distributes risk and resists censorship.

### Why Encryption Matters

Privacy is not about having something to hide. Privacy is about maintaining human dignity in the digital age. Your thoughts, your notes, your memories - these are yours.

### Why Nostr

Nostr is:
- Simple (easy to implement correctly)
- Extensible (NIPs add features)
- Censorship-resistant (no central authority)
- Cryptographically sound (secp256k1)
- Battle-tested (growing ecosystem)

## Resources

- **Nostr Protocol**: https://nostr.com
- **NIP-44 Spec**: https://github.com/nostr-protocol/nips/blob/master/44.md
- **NIP-59 Spec**: https://github.com/nostr-protocol/nips/blob/master/59.md
- **Cypherpunk Manifesto**: https://www.activism.net/cypherpunk/manifesto.html
- **Crypto Anarchist Manifesto**: https://groups.csail.mit.edu/mac/classes/6.805/articles/crypto/cypherpunks/may-crypto-manifesto.html

## Acknowledgments

- **Eric Hughes** - A Cypherpunk's Manifesto
- **Timothy C. May** - The Crypto Anarchist Manifesto
- **Satoshi Nakamoto** - Bitcoin (secp256k1)
- **Nostr Protocol** - Decentralized social protocol
- **Daniel J. Bernstein** - ChaCha20 cipher

## Support

No official support. Code is self-documenting. Read the source. Fix bugs yourself. Share improvements.

This is not a product. This is a tool for digital self-defense.

---

**Built by Teşkilatsız**

*"Privacy is not an option, and it shouldn't be the price we accept for just getting on the Internet."* - Gary Kovacs

*"Cypherpunks write code. We know that someone has to write software to defend privacy, and we're going to write it."* - Eric Hughes
