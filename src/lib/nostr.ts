import 'react-native-get-random-values';
import { SimplePool } from 'nostr-tools/pool';
import {
  finalizeEvent,
  generateSecretKey,
  getEventHash,
  getPublicKey,
  verifyEvent,
  type Event as NostrEvent,
  type EventTemplate,
  type UnsignedEvent,
  type VerifiedEvent,
} from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import * as nip44 from 'nostr-tools/nip44';
import * as nip59 from 'nostr-tools/nip59';
import {
  BunkerSigner,
  createNostrConnectURI,
  type BunkerPointer,
} from 'nostr-tools/nip46';
import {
  decryptNip04Uri,
  decryptNip44Uri,
  encryptNip04Uri,
  encryptNip44Uri,
  getPublicKeyUri,
  signEventUri,
} from '@/lib/nip55';
import { EventDeletion, GiftWrap, LongFormArticle, Seal } from 'nostr-tools/kinds';
import type { Filter } from 'nostr-tools/filter';
import type { WindowNostr } from 'nostr-tools/nip07';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { fetch as expoFetch } from 'expo/fetch';
import type { NostrKeys, Note } from '@/types/note';
import { isAndroidWebClient } from '@/lib/web-client';

declare global {
  interface Window {
    nostr?: WindowNostr;
  }
}

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://nostr.wine',
];

const KEY_STORAGE_KEY = 'nostr_private_key_v2';
const CACHE_KEY_PREFIX = 'nostr_cache_';
const LAST_SYNC_KEY = 'nostr_last_sync';
const RELAYS_STORAGE_KEY = 'nostr_user_relays';
const BLOSSOM_SERVERS_STORAGE_KEY = 'nostr_blossom_servers';
const WEB_SIGNER_SESSION_KEY = 'nostr_web_signer_session_v1';
const NIP55_CALLBACK_RESULT_PREFIX = 'cetele:nip55:result:';
const NIP55_CALLBACK_PENDING_PREFIX = 'cetele:nip55:pending:';
const NIP55_LOGIN_FALLBACK_KEY = 'cetele:nip55:login';
const CLIENT_TAG = 'cetele';
const MAX_RELAY_RETRIES = 3;
const RELAY_MAX_WAIT_MS = 7000;
const QUERY_MAX_RELAY_RETRIES = 1;
const QUERY_RELAY_MAX_WAIT_MS = 2800;
const RELAY_RETRY_BASE_DELAY_MS = 600;
const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;
const BLOSSOM_SERVER_LIST_KIND = 10063;
const FILE_METADATA_KIND = 1063;
const BLOSSOM_AUTH_KIND = 24242;
const BLOSSOM_AUTH_EXPIRY_SECONDS = 10 * 60;
const BLOSSOM_UPLOAD_MAX_WAIT_MS = 30000;
const PRIVATE_NOTE_RELAY_PAYLOAD_MAX_BYTES = 64000;
const DEFAULT_BLOSSOM_SERVERS = [
  'https://blossom.primal.net',
  'https://cdn.hzrd149.com',
  'https://cdn.satellite.earth',
];
const DEFAULT_NIP46_RELAYS = [
  'wss://relay.nsec.app',
  'wss://nos.lol',
];

type NostrRumor = UnsignedEvent & { id: string };

export interface BlossomUploadInput {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  file?: any;
  signal?: AbortSignal | null;
}

export interface BlossomUploadResult {
  url: string;
  sha256: string;
  size: number;
  mimeType: string;
  uploadedAt?: number;
  server: string;
  name?: string | null;
  width?: number | null;
  height?: number | null;
  metadataEventId?: string | null;
}

interface BlossomDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded?: number;
}

interface EmbeddedDataMedia {
  dataUrl: string;
  mimeType: string;
  extension: string;
  width?: number;
  height?: number;
}

export interface UserRelay {
  id: string;
  relay_url: string;
  is_enabled: boolean;
  is_default: boolean;
  created_at: string;
}

export enum AuthMethod {
  EXTENSION = 'extension',
  REMOTE_SIGNER = 'nip46',
  ANDROID_SIGNER = 'nip55',
  MOBILE_SECURE = 'mobile_secure',
  NOT_AUTHENTICATED = 'not_authenticated',
}

interface Nip46StoredSession {
  method: AuthMethod.REMOTE_SIGNER;
  clientSecretKey: string;
  remoteSignerPubkey: string;
  userPubkey: string;
  relays: string[];
  secret: string | null;
}

interface Nip55StoredSession {
  method: AuthMethod.ANDROID_SIGNER;
  userPubkey: string;
}

type WebSignerStoredSession = Nip46StoredSession | Nip55StoredSession;

export interface Nip46LoginRequest {
  uri: string;
  connection: Promise<NostrKeys>;
  cancel: () => void;
}

export class NostrSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NostrSecurityError';
  }
}

export class NostrService {
  private pool: SimplePool;
  private privateKey: Uint8Array | null = null;
  private publicKey: string | null = null;
  private authMethod: AuthMethod = AuthMethod.NOT_AUTHENTICATED;
  private userRelays: string[] = [];
  private notesCache: Map<string, Note> = new Map();
  private lastSyncTimestamp: number = 0;
  private cacheReadyPromise: Promise<void>;
  private sessionPromise: Promise<NostrKeys | null> | null = null;
  private sessionGeneration: number = 0;
  private nip46Signer: BunkerSigner | null = null;

  constructor() {
    this.pool = new SimplePool({
      enablePing: true,
      enableReconnect: true,
    });
    this.cacheReadyPromise = this.loadCacheFromStorage();
  }

  private normalizeRelayUrl(relayUrl: string): string {
    try {
      const parsed = new URL(relayUrl.trim());
      if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') {
        throw new Error('Relay URL must start with ws:// or wss://');
      }
      return parsed.toString().replace(/\/$/, '');
    } catch (error) {
      throw new NostrSecurityError(
        `Invalid relay URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private uniqueRelayUrls(relays: string[]): string[] {
    const normalized = relays
      .map((relay) => {
        try {
          return this.normalizeRelayUrl(relay);
        } catch {
          return null;
        }
      })
      .filter((relay): relay is string => relay !== null);

    return Array.from(new Set(normalized));
  }

  private safeAddressIdentifier(note: Note): string {
    const rawIdentifier = `cetele-${note.id || note.eventId || this.nowInSeconds()}`;
    const normalized = rawIdentifier
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180);

    return normalized || `cetele-${this.nowInSeconds()}`;
  }

  private safeAddressRelays(relays: string[]): string[] {
    return relays
      .filter((relay) => {
        const bytes = utf8Bytes(relay);
        return bytes.length > 0 && bytes.length <= 255 && /^[\x21-\x7E]+$/.test(relay);
      })
      .slice(0, 3);
  }

  private normalizeHttpUrl(url: string): string {
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('URL must start with https:// or http://');
      }
      return parsed.toString().replace(/\/$/, '');
    } catch (error) {
      throw new NostrSecurityError(
        `Invalid HTTP URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private uniqueHttpUrls(urls: string[]): string[] {
    const normalized = urls
      .map((url) => {
        try {
          return this.normalizeHttpUrl(url);
        } catch {
          return null;
        }
      })
      .filter((url): url is string => url !== null);

    return Array.from(new Set(normalized));
  }

  private base64UrlEncode(value: string): string {
    const bytes = utf8Bytes(value);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';

    for (let i = 0; i < bytes.length; i += 3) {
      const first = bytes[i];
      const second = bytes[i + 1];
      const third = bytes[i + 2];
      const triple = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

      output += alphabet[(triple >> 18) & 63];
      output += alphabet[(triple >> 12) & 63];
      output += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '=';
      output += i + 2 < bytes.length ? alphabet[triple & 63] : '=';
    }

    return output.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private async getStoredBlossomServers(): Promise<string[]> {
    try {
      const storedServers = await AsyncStorage.getItem(BLOSSOM_SERVERS_STORAGE_KEY);
      if (!storedServers) {
        return [];
      }
      return this.uniqueHttpUrls(JSON.parse(storedServers));
    } catch (error) {
      console.error('Error loading Blossom servers:', error);
      return [];
    }
  }

  async setBlossomServers(servers: string[]): Promise<void> {
    const normalizedServers = this.uniqueHttpUrls(servers);
    await AsyncStorage.setItem(BLOSSOM_SERVERS_STORAGE_KEY, JSON.stringify(normalizedServers));
    if (normalizedServers.length > 0) {
      void this.publishBlossomServerList(normalizedServers).catch((error) => {
        console.warn('Blossom server list publish failed:', error);
      });
    }
  }

  async getBlossomServers(): Promise<string[]> {
    const storedServers = await this.getStoredBlossomServers();
    if (storedServers.length > 0) {
      return storedServers;
    }
    return this.fetchBlossomServerList();
  }

  private async loadUserRelays(): Promise<string[]> {
    try {
      const storedRelays = await AsyncStorage.getItem(RELAYS_STORAGE_KEY);

      if (!storedRelays) {
        await this.initializeDefaultRelays();
        return DEFAULT_RELAYS;
      }

      const relays: UserRelay[] = JSON.parse(storedRelays);
      const enabledRelays = this.uniqueRelayUrls(
        relays.filter(r => r.is_enabled).map(r => r.relay_url)
      );

      return enabledRelays.length > 0 ? enabledRelays : DEFAULT_RELAYS;
    } catch (error) {
      console.error('Error loading user relays:', error);
      return DEFAULT_RELAYS;
    }
  }

  private async initializeDefaultRelays(): Promise<void> {
    try {
      const defaultRelays: UserRelay[] = DEFAULT_RELAYS.map(url => ({
        id: `default_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        relay_url: url,
        is_enabled: true,
        is_default: true,
        created_at: new Date().toISOString(),
      }));

      await AsyncStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify(defaultRelays));
    } catch (error) {
      console.error('Error initializing default relays:', error);
    }
  }

  async getUserRelays(): Promise<UserRelay[]> {
    try {
      const storedRelays = await AsyncStorage.getItem(RELAYS_STORAGE_KEY);

      if (!storedRelays) {
        await this.initializeDefaultRelays();
        const newRelays = await AsyncStorage.getItem(RELAYS_STORAGE_KEY);
        return newRelays ? JSON.parse(newRelays) : [];
      }

      return JSON.parse(storedRelays);
    } catch (error) {
      console.error('Error fetching user relays:', error);
      return [];
    }
  }

  async addRelay(relayUrl: string): Promise<boolean> {
    try {
      const normalizedRelayUrl = this.normalizeRelayUrl(relayUrl);
      const relays = await this.getUserRelays();

      const exists = relays.some(r => this.normalizeRelayUrl(r.relay_url) === normalizedRelayUrl);
      if (exists) {
        return false;
      }

      const newRelay: UserRelay = {
        id: `relay_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        relay_url: normalizedRelayUrl,
        is_enabled: true,
        is_default: false,
        created_at: new Date().toISOString(),
      };

      relays.push(newRelay);
      await AsyncStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify(relays));

      this.userRelays = await this.loadUserRelays();
      return true;
    } catch (error) {
      console.error('Error adding relay:', error);
      return false;
    }
  }

  async toggleRelay(relayId: string, isEnabled: boolean): Promise<boolean> {
    try {
      const relays = await this.getUserRelays();
      const relay = relays.find(r => r.id === relayId);

      if (!relay) {
        return false;
      }

      relay.is_enabled = isEnabled;
      await AsyncStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify(relays));

      this.userRelays = await this.loadUserRelays();
      return true;
    } catch (error) {
      console.error('Error toggling relay:', error);
      return false;
    }
  }

  async deleteRelay(relayId: string): Promise<boolean> {
    try {
      const relays = await this.getUserRelays();
      const relay = relays.find(r => r.id === relayId);

      if (!relay || relay.is_default) {
        return false;
      }

      const updatedRelays = relays.filter(r => r.id !== relayId);
      await AsyncStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify(updatedRelays));

      this.userRelays = await this.loadUserRelays();
      return true;
    } catch (error) {
      console.error('Error deleting relay:', error);
      return false;
    }
  }

  private async getActiveRelays(): Promise<string[]> {
    if (this.userRelays.length === 0) {
      this.userRelays = await this.loadUserRelays();
    }
    const activeRelays = this.userRelays.length > 0 ? this.userRelays : DEFAULT_RELAYS;
    return this.uniqueRelayUrls(activeRelays);
  }

  private async loadCacheFromStorage(): Promise<void> {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    try {
      const cacheData = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}notes`);
      const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);

      if (cacheData) {
        const notes: Note[] = JSON.parse(cacheData);
        notes.forEach(note => this.notesCache.set(note.id, note));
      }

      if (lastSync) {
        this.lastSyncTimestamp = parseInt(lastSync, 10);
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
    }
  }

  private async saveCacheToStorage(): Promise<void> {
    try {
      const notes = Array.from(this.notesCache.values());
      await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}notes`, JSON.stringify(notes));
      await AsyncStorage.setItem(LAST_SYNC_KEY, this.lastSyncTimestamp.toString());
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  private async ensureCacheReady(): Promise<void> {
    await this.cacheReadyPromise;
  }

  private sortedNotes(notes: Iterable<Note>): Note[] {
    return Array.from(notes).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getCachedNotes(): Promise<Note[]> {
    await this.ensureCacheReady();
    return this.sortedNotes(this.notesCache.values());
  }

  getNoteFromCacheSync(id: string): Note | null {
    return this.notesCache.get(id) || null;
  }

  private generateRandomKeypair(): { privateKey: Uint8Array; publicKey: string } {
    const privateKey = generateSecretKey();
    const publicKey = getPublicKey(privateKey);
    return { privateKey, publicKey };
  }

  private nowInSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  private randomPastTimestamp(): number {
    return Math.round(this.nowInSeconds() - Math.random() * TWO_DAYS_SECONDS);
  }

  private getRumorId(eventTemplate: EventTemplate): string {
    if (!this.publicKey) {
      throw new NostrSecurityError('Public key not available');
    }

    return getEventHash({
      ...eventTemplate,
      pubkey: this.publicKey,
    });
  }

  private assertValidRumor(rumor: NostrRumor): boolean {
    try {
      return rumor.id === getEventHash(rumor);
    } catch {
      return false;
    }
  }

  private async createGiftWrap(
    eventTemplate: EventTemplate,
    recipientPubkey: string
  ): Promise<NostrEvent> {
    if (this.privateKey) {
      return nip59.wrapEvent(eventTemplate, this.privateKey, recipientPubkey);
    }

    if (!this.publicKey || this.authMethod === AuthMethod.NOT_AUTHENTICATED) {
      throw new NostrSecurityError('NIP-59 gift wrapping requires a private key or NIP-07 NIP-44 support');
    }

    const rumor: NostrRumor = {
      ...eventTemplate,
      pubkey: this.publicKey,
      id: this.getRumorId(eventTemplate),
    };

    const seal = await this.signEvent({
      kind: Seal,
      created_at: this.randomPastTimestamp(),
      tags: [],
      content: await this.externalNip44Encrypt(recipientPubkey, JSON.stringify(rumor)),
    });

    const randomKeypair = this.generateRandomKeypair();
    const conversationKey = nip44.v2.utils.getConversationKey(
      randomKeypair.privateKey,
      recipientPubkey
    );
    const encryptedSeal = nip44.v2.encrypt(JSON.stringify(seal), conversationKey);

    return finalizeEvent(
      {
        kind: GiftWrap,
        created_at: this.randomPastTimestamp(),
        tags: [['p', recipientPubkey]],
        content: encryptedSeal,
      },
      randomKeypair.privateKey
    );
  }

  private decryptWrappedEvent(event: NostrEvent, privateKey: Uint8Array): NostrEvent {
    const conversationKey = nip44.v2.utils.getConversationKey(privateKey, event.pubkey);
    return JSON.parse(nip44.v2.decrypt(event.content, conversationKey));
  }

  private async unwrapGiftWrap(giftWrapEvent: NostrEvent): Promise<NostrRumor | null> {
    if (!this.publicKey) {
      throw new NostrSecurityError('Public key not available for unwrapping');
    }

    if (giftWrapEvent.kind !== GiftWrap || !verifyEvent(giftWrapEvent)) {
      return null;
    }

    try {
      let sealedEvent: NostrEvent;
      let rumor: NostrRumor;

      if (this.privateKey) {
        sealedEvent = this.decryptWrappedEvent(giftWrapEvent, this.privateKey);

        if (sealedEvent.kind !== Seal || !verifyEvent(sealedEvent)) {
          return null;
        }

        rumor = this.decryptWrappedEvent(sealedEvent, this.privateKey) as NostrRumor;
      } else {
        if (this.authMethod === AuthMethod.NOT_AUTHENTICATED) {
          throw new NostrSecurityError('NIP-59 unwrapping requires a private key or NIP-44 signer support');
        }

        sealedEvent = JSON.parse(
          await this.externalNip44Decrypt(giftWrapEvent.pubkey, giftWrapEvent.content)
        );

        if (sealedEvent.kind !== Seal || !verifyEvent(sealedEvent)) {
          return null;
        }

        rumor = JSON.parse(
          await this.externalNip44Decrypt(sealedEvent.pubkey, sealedEvent.content)
        );
      }

      return this.assertValidRumor(rumor) ? rumor : null;
    } catch (error) {
      console.error('Failed to unwrap gift wrap:', error);
      return null;
    }
  }

  private async saveMobileKey(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      throw new NostrSecurityError(
        'CRITICAL: Refusing to store private key in web storage. Use NIP-07 extension.'
      );
    }
    await SecureStore.setItemAsync(KEY_STORAGE_KEY, key);
  }

  private async loadMobileKey(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return null;
    }
    return await SecureStore.getItemAsync(KEY_STORAGE_KEY);
  }

  private invalidateSessionRestore(): void {
    this.sessionGeneration += 1;
    this.sessionPromise = null;
  }

  private async saveWebSignerSession(session: WebSignerStoredSession): Promise<void> {
    await AsyncStorage.setItem(WEB_SIGNER_SESSION_KEY, JSON.stringify(session));
  }

  private async loadWebSignerSession(): Promise<WebSignerStoredSession | null> {
    const rawSession = await AsyncStorage.getItem(WEB_SIGNER_SESSION_KEY);
    if (!rawSession) return null;

    try {
      const session = JSON.parse(rawSession) as WebSignerStoredSession;
      if (
        session.method !== AuthMethod.REMOTE_SIGNER &&
        session.method !== AuthMethod.ANDROID_SIGNER
      ) {
        return null;
      }
      if (!/^[0-9a-f]{64}$/i.test(session.userPubkey)) return null;
      return session;
    } catch {
      await AsyncStorage.removeItem(WEB_SIGNER_SESSION_KEY);
      return null;
    }
  }

  beginNip46Login(onAuthUrl?: (url: string) => void): Nip46LoginRequest {
    if (Platform.OS !== 'web') {
      throw new NostrSecurityError('Nostr Connect is only available on the web platform');
    }

    this.invalidateSessionRestore();
    const clientSecretKey = generateSecretKey();
    const secret = bytesToHex(generateSecretKey()).slice(0, 32);
    const clientPubkey = getPublicKey(clientSecretKey);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cetele.app';
    const uri = createNostrConnectURI({
      clientPubkey,
      relays: DEFAULT_NIP46_RELAYS,
      secret,
      perms: ['sign_event', 'nip44_encrypt', 'nip44_decrypt'],
      name: 'Çetele',
      url: origin,
      image: `${origin}/icon-192.png`,
    });
    const abortController = new AbortController();

    const connection = (async () => {
      try {
        const signer = await BunkerSigner.fromURI(
          clientSecretKey,
          uri,
          {
            pool: this.pool,
            onauth: (url) => {
              if (onAuthUrl) {
                onAuthUrl(url);
                return;
              }
              window.open(url, '_blank', 'noopener,noreferrer');
            },
          },
          abortController.signal
        );
        const userPubkey = await signer.getPublicKey();
        if (!/^[0-9a-f]{64}$/i.test(userPubkey)) {
          await signer.close();
          throw new Error('Remote signer returned an invalid public key');
        }

        this.nip46Signer = signer;
        this.privateKey = null;
        this.publicKey = userPubkey;
        this.authMethod = AuthMethod.REMOTE_SIGNER;
        this.userRelays = await this.loadUserRelays();

        await this.saveWebSignerSession({
          method: AuthMethod.REMOTE_SIGNER,
          clientSecretKey: bytesToHex(clientSecretKey),
          remoteSignerPubkey: signer.bp.pubkey,
          userPubkey,
          relays: signer.bp.relays,
          secret: signer.bp.secret,
        });

        return {
          privateKey: 'MANAGED_BY_REMOTE_SIGNER',
          publicKey: userPubkey,
        };
      } catch (error) {
        if (abortController.signal.aborted) {
          throw new NostrSecurityError('Nostr Connect request was cancelled');
        }
        throw new NostrSecurityError(
          `Nostr Connect failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })();

    return {
      uri,
      connection,
      cancel: () => abortController.abort(),
    };
  }

  private isAndroidWebBrowser(): boolean {
    return Platform.OS === 'web' && isAndroidWebClient();
  }

  private async requestNip55Value(
    pendingType: 'login' | 'request',
    resultParameter: 'result' | 'event',
    createUri: (callbackUrl: string, requestId: string) => string
  ): Promise<string> {
    if (!this.isAndroidWebBrowser() || typeof window === 'undefined') {
      throw new NostrSecurityError('Android Signer requires an Android web browser');
    }

    const requestId = bytesToHex(generateSecretKey()).slice(0, 24);
    const resultKey = `${NIP55_CALLBACK_RESULT_PREFIX}${requestId}`;
    const pendingKey = `${NIP55_CALLBACK_PENDING_PREFIX}${requestId}`;
    const callbackUrl = new URL('/signer-callback', window.location.origin);
    callbackUrl.searchParams.set('requestId', requestId);
    callbackUrl.searchParams.set(resultParameter, '');
    window.localStorage.setItem(pendingKey, pendingType);
    window.localStorage.removeItem(resultKey);

    const waitForResult = new Promise<string>((resolve, reject) => {
      let settled = false;
      const startedAt = Date.now();

      const cleanup = () => {
        window.removeEventListener('storage', onStorage);
        window.clearInterval(pollTimer);
        window.clearTimeout(timeoutTimer);
        window.localStorage.removeItem(pendingKey);
      };
      const finish = () => {
        if (settled) return;
        const raw = window.localStorage.getItem(resultKey);
        if (!raw) return;
        settled = true;
        cleanup();
        window.localStorage.removeItem(resultKey);
        try {
          const payload = JSON.parse(raw) as { value?: string; error?: string };
          if (payload.error) {
            reject(new NostrSecurityError(payload.error));
          } else if (payload.value) {
            resolve(payload.value);
          } else {
            reject(new NostrSecurityError('Android Signer returned an empty result'));
          }
        } catch {
          resolve(raw);
        }
      };
      const onStorage = (event: StorageEvent) => {
        if (event.key === resultKey) finish();
      };
      const pollTimer = window.setInterval(finish, 400);
      const timeoutTimer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          new NostrSecurityError(
            `Android Signer did not return a result within ${Math.round((Date.now() - startedAt) / 1000)} seconds`
          )
        );
      }, 180_000);
      window.addEventListener('storage', onStorage);
    });

    window.location.href = createUri(callbackUrl.toString(), requestId);
    return waitForResult;
  }

  async loginWithAndroidSigner(): Promise<NostrKeys> {
    this.invalidateSessionRestore();
    const publicKey = await this.requestNip55Value(
      'login',
      'result',
      (callbackUrl) =>
        getPublicKeyUri({
          callbackUrl,
          permissions: [
            { type: 'sign_event' },
            { type: 'nip44_encrypt' },
            { type: 'nip44_decrypt' },
          ],
        })
    );
    return this.acceptAndroidSignerCallback(publicKey);
  }

  async acceptAndroidSignerCallback(publicKey: string): Promise<NostrKeys> {
    if (!/^[0-9a-f]{64}$/i.test(publicKey)) {
      throw new NostrSecurityError('Android Signer returned an invalid public key');
    }

    this.invalidateSessionRestore();
    this.privateKey = null;
    this.publicKey = publicKey;
    this.authMethod = AuthMethod.ANDROID_SIGNER;
    this.userRelays = await this.loadUserRelays();
    await this.saveWebSignerSession({
      method: AuthMethod.ANDROID_SIGNER,
      userPubkey: publicKey,
    });
    window.localStorage.removeItem(NIP55_LOGIN_FALLBACK_KEY);

    return {
      privateKey: 'MANAGED_BY_ANDROID_SIGNER',
      publicKey,
    };
  }

  async loginWithExtension(): Promise<NostrKeys> {
    if (Platform.OS !== 'web') {
      throw new NostrSecurityError(
        'Extension login is only available on web platform'
      );
    }

    if (!window.nostr) {
      throw new NostrSecurityError(
        'No NIP-07 extension detected. Please install Alby, nos2x, or similar Nostr extension.'
      );
    }

    try {
      this.invalidateSessionRestore();
      await AsyncStorage.removeItem(WEB_SIGNER_SESSION_KEY);
      window.localStorage.removeItem(NIP55_LOGIN_FALLBACK_KEY);
      this.publicKey = await window.nostr.getPublicKey();
      this.authMethod = AuthMethod.EXTENSION;

      return {
        privateKey: 'MANAGED_BY_EXTENSION',
        publicKey: this.publicKey,
      };
    } catch (error) {
      throw new NostrSecurityError(
        `Extension authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async loginWithPrivateKey(nsecOrHex: string): Promise<NostrKeys> {
    if (Platform.OS === 'web') {
      throw new NostrSecurityError(
        'Private key login is disabled on web. Use NIP-07 extension for security.'
      );
    }

    let privateKeyBytes: Uint8Array;

    try {
      this.invalidateSessionRestore();
      if (nsecOrHex.startsWith('nsec1')) {
        const decoded = nip19.decode(nsecOrHex);
        if (decoded.type !== 'nsec') {
          throw new Error('Invalid nsec format');
        }
        privateKeyBytes = decoded.data;
      } else {
        privateKeyBytes = hexToBytes(nsecOrHex);
      }

      if (privateKeyBytes.length !== 32) {
        throw new Error('Invalid key length');
      }

      this.privateKey = privateKeyBytes;
      this.publicKey = getPublicKey(privateKeyBytes);
      this.authMethod = AuthMethod.MOBILE_SECURE;

      const privateKeyHex = bytesToHex(privateKeyBytes);
      await this.saveMobileKey(privateKeyHex);

      return {
        privateKey: nip19.nsecEncode(privateKeyBytes),
        publicKey: this.publicKey,
      };
    } catch (error) {
      throw new NostrSecurityError(
        `Failed to import private key: ${error instanceof Error ? error.message : 'Invalid key format'}`
      );
    }
  }

  async createNewIdentity(): Promise<NostrKeys> {
    if (Platform.OS === 'web') {
      throw new NostrSecurityError(
        'Identity creation disabled on web. Use NIP-07 extension or create identity on mobile.'
      );
    }

    this.invalidateSessionRestore();
    this.privateKey = generateSecretKey();
    this.publicKey = getPublicKey(this.privateKey);
    this.authMethod = AuthMethod.MOBILE_SECURE;

    const privateKeyHex = bytesToHex(this.privateKey);
    await this.saveMobileKey(privateKeyHex);

    return {
      privateKey: nip19.nsecEncode(this.privateKey),
      publicKey: this.publicKey,
    };
  }

  async restoreSession(): Promise<NostrKeys | null> {
    if (this.sessionPromise) {
      return this.sessionPromise;
    }
    const generation = this.sessionGeneration;
    this.sessionPromise = this._restoreSession(generation);
    return this.sessionPromise;
  }

  private isStaleSessionGeneration(generation: number): boolean {
    return generation !== this.sessionGeneration;
  }

  private async _restoreSession(generation: number): Promise<NostrKeys | null> {
    if (Platform.OS === 'web') {
      let storedSigner = await this.loadWebSignerSession();
      if (!storedSigner && typeof window !== 'undefined') {
        const fallbackPubkey = window.localStorage.getItem(NIP55_LOGIN_FALLBACK_KEY);
        if (fallbackPubkey && /^[0-9a-f]{64}$/i.test(fallbackPubkey)) {
          storedSigner = {
            method: AuthMethod.ANDROID_SIGNER,
            userPubkey: fallbackPubkey,
          };
          await this.saveWebSignerSession(storedSigner);
          window.localStorage.removeItem(NIP55_LOGIN_FALLBACK_KEY);
        }
      }

      if (storedSigner?.method === AuthMethod.REMOTE_SIGNER) {
        try {
          if (
            !/^[0-9a-f]{64}$/i.test(storedSigner.clientSecretKey) ||
            !/^[0-9a-f]{64}$/i.test(storedSigner.remoteSignerPubkey) ||
            storedSigner.relays.length === 0
          ) {
            throw new Error('Invalid saved Nostr Connect session');
          }
          const bunkerPointer: BunkerPointer = {
            pubkey: storedSigner.remoteSignerPubkey,
            relays: storedSigner.relays,
            secret: storedSigner.secret,
          };
          this.nip46Signer = BunkerSigner.fromBunker(
            hexToBytes(storedSigner.clientSecretKey),
            bunkerPointer,
            {
              pool: this.pool,
              onauth: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
            }
          );
          if (this.isStaleSessionGeneration(generation)) return null;
          this.privateKey = null;
          this.publicKey = storedSigner.userPubkey;
          this.authMethod = AuthMethod.REMOTE_SIGNER;
          this.userRelays = await this.loadUserRelays();
          if (this.isStaleSessionGeneration(generation)) return null;
          return {
            privateKey: 'MANAGED_BY_REMOTE_SIGNER',
            publicKey: storedSigner.userPubkey,
          };
        } catch (error) {
          console.error('Failed to restore Nostr Connect session:', error);
          await AsyncStorage.removeItem(WEB_SIGNER_SESSION_KEY);
          this.nip46Signer = null;
        }
      }

      if (storedSigner?.method === AuthMethod.ANDROID_SIGNER) {
        this.privateKey = null;
        this.publicKey = storedSigner.userPubkey;
        this.authMethod = AuthMethod.ANDROID_SIGNER;
        this.userRelays = await this.loadUserRelays();
        if (this.isStaleSessionGeneration(generation)) return null;
        return {
          privateKey: 'MANAGED_BY_ANDROID_SIGNER',
          publicKey: storedSigner.userPubkey,
        };
      }

      if (window.nostr) {
        try {
          const publicKey = await window.nostr.getPublicKey();
          if (this.isStaleSessionGeneration(generation)) {
            return null;
          }
          this.publicKey = publicKey;
          this.authMethod = AuthMethod.EXTENSION;
          this.userRelays = await this.loadUserRelays();
          if (this.isStaleSessionGeneration(generation)) {
            return null;
          }
          return {
            privateKey: 'MANAGED_BY_EXTENSION',
            publicKey,
          };
        } catch {
          return null;
        }
      }
      return null;
    }

    const storedKey = await this.loadMobileKey();
    if (this.isStaleSessionGeneration(generation)) {
      return null;
    }
    if (!storedKey) {
      return null;
    }

    try {
      const privateKey = hexToBytes(storedKey);
      const publicKey = getPublicKey(privateKey);
      if (this.isStaleSessionGeneration(generation)) {
        return null;
      }
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      this.authMethod = AuthMethod.MOBILE_SECURE;

      this.userRelays = await this.loadUserRelays();
      if (this.isStaleSessionGeneration(generation)) {
        return null;
      }

      return {
        privateKey: nip19.nsecEncode(privateKey),
        publicKey,
      };
    } catch (error) {
      console.error('Failed to restore session:', error);
      return null;
    }
  }

  async exportPrivateKey(): Promise<string> {
    if (this.authMethod === AuthMethod.EXTENSION) {
      throw new NostrSecurityError(
        'Private key is managed by your browser extension. Export from extension settings.'
      );
    }

    if (!this.privateKey) {
      throw new NostrSecurityError('No private key available to export');
    }

    return nip19.nsecEncode(this.privateKey);
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  getAuthMethod(): AuthMethod {
    return this.authMethod;
  }

  isAuthenticated(): boolean {
    return this.authMethod !== AuthMethod.NOT_AUTHENTICATED && this.publicKey !== null;
  }

  private async externalNip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
    if (this.authMethod === AuthMethod.EXTENSION && window.nostr?.nip44) {
      return window.nostr.nip44.encrypt(pubkey, plaintext);
    }
    if (this.authMethod === AuthMethod.REMOTE_SIGNER && this.nip46Signer) {
      return this.nip46Signer.nip44Encrypt(pubkey, plaintext);
    }
    if (this.authMethod === AuthMethod.ANDROID_SIGNER && this.publicKey) {
      return this.requestNip55Value('request', 'result', (callbackUrl, id) =>
        encryptNip44Uri({
          pubKey: pubkey,
          content: plaintext,
          currentUser: this.publicKey!,
          callbackUrl,
          id,
        })
      );
    }
    throw new NostrSecurityError('The selected signer does not support NIP-44 encryption');
  }

  private async externalNip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    if (this.authMethod === AuthMethod.EXTENSION && window.nostr?.nip44) {
      return window.nostr.nip44.decrypt(pubkey, ciphertext);
    }
    if (this.authMethod === AuthMethod.REMOTE_SIGNER && this.nip46Signer) {
      return this.nip46Signer.nip44Decrypt(pubkey, ciphertext);
    }
    if (this.authMethod === AuthMethod.ANDROID_SIGNER && this.publicKey) {
      return this.requestNip55Value('request', 'result', (callbackUrl, id) =>
        decryptNip44Uri({
          pubKey: pubkey,
          content: ciphertext,
          currentUser: this.publicKey!,
          callbackUrl,
          id,
        })
      );
    }
    throw new NostrSecurityError('The selected signer does not support NIP-44 decryption');
  }

  private async externalNip04Encrypt(pubkey: string, plaintext: string): Promise<string> {
    if (this.authMethod === AuthMethod.EXTENSION && window.nostr?.nip04) {
      return window.nostr.nip04.encrypt(pubkey, plaintext);
    }
    if (this.authMethod === AuthMethod.REMOTE_SIGNER && this.nip46Signer) {
      return this.nip46Signer.nip04Encrypt(pubkey, plaintext);
    }
    if (this.authMethod === AuthMethod.ANDROID_SIGNER && this.publicKey) {
      return this.requestNip55Value('request', 'result', (callbackUrl, id) =>
        encryptNip04Uri({
          pubKey: pubkey,
          content: plaintext,
          currentUser: this.publicKey!,
          callbackUrl,
          id,
        })
      );
    }
    throw new NostrSecurityError('The selected signer does not support NIP-04 encryption');
  }

  private async externalNip04Decrypt(pubkey: string, ciphertext: string): Promise<string> {
    if (this.authMethod === AuthMethod.EXTENSION && window.nostr?.nip04) {
      return window.nostr.nip04.decrypt(pubkey, ciphertext);
    }
    if (this.authMethod === AuthMethod.REMOTE_SIGNER && this.nip46Signer) {
      return this.nip46Signer.nip04Decrypt(pubkey, ciphertext);
    }
    if (this.authMethod === AuthMethod.ANDROID_SIGNER && this.publicKey) {
      return this.requestNip55Value('request', 'result', (callbackUrl, id) =>
        decryptNip04Uri({
          pubKey: pubkey,
          content: ciphertext,
          currentUser: this.publicKey!,
          callbackUrl,
          id,
        })
      );
    }
    throw new NostrSecurityError('The selected signer does not support NIP-04 decryption');
  }

  private async encryptContent(content: string): Promise<{ ciphertext: string; method: 'nip44' | 'nip04' }> {
    if (!this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    if (
      this.authMethod === AuthMethod.EXTENSION ||
      this.authMethod === AuthMethod.REMOTE_SIGNER ||
      this.authMethod === AuthMethod.ANDROID_SIGNER
    ) {
      try {
        return { ciphertext: await this.externalNip44Encrypt(this.publicKey, content), method: 'nip44' };
      } catch (error) {
        if (this.authMethod !== AuthMethod.EXTENSION) throw error;
      }
      if (typeof (window.nostr as any)?.encrypt === 'function') {
        return { ciphertext: await (window.nostr as any).encrypt(this.publicKey, content), method: 'nip04' };
      }
      try {
        return { ciphertext: await this.externalNip04Encrypt(this.publicKey, content), method: 'nip04' };
      } catch {
        throw new NostrSecurityError('Signer does not support encryption (NIP-44 or NIP-04)');
      }
    }

    if (!this.privateKey) {
      throw new NostrSecurityError('Private key not available');
    }

    const conversationKey = nip44.v2.utils.getConversationKey(
      this.privateKey,
      this.publicKey
    );
    return { ciphertext: nip44.v2.encrypt(content, conversationKey), method: 'nip44' };
  }

  private async decryptContent(ciphertext: string, method: 'nip44' | 'nip04' = 'nip44'): Promise<string> {
    if (!this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    if (
      this.authMethod === AuthMethod.EXTENSION ||
      this.authMethod === AuthMethod.REMOTE_SIGNER ||
      this.authMethod === AuthMethod.ANDROID_SIGNER
    ) {
      if (method === 'nip44') {
        return this.externalNip44Decrypt(this.publicKey, ciphertext);
      } else {
        if (typeof (window.nostr as any)?.decrypt === 'function') {
          return await (window.nostr as any).decrypt(this.publicKey, ciphertext);
        }
        return this.externalNip04Decrypt(this.publicKey, ciphertext);
      }
    }

    if (!this.privateKey) {
      throw new NostrSecurityError('Private key not available');
    }

    if (method === 'nip04') {
      throw new NostrSecurityError('NIP-04 decryption via private key is not supported. Use extension.');
    }

    const conversationKey = nip44.v2.utils.getConversationKey(
      this.privateKey,
      this.publicKey
    );
    return nip44.v2.decrypt(ciphertext, conversationKey);
  }

  private async signEvent(eventTemplate: EventTemplate): Promise<VerifiedEvent> {
    if (this.authMethod === AuthMethod.EXTENSION) {
      if (!window.nostr) {
        throw new NostrSecurityError('Extension not available');
      }
      return await window.nostr.signEvent(eventTemplate);
    }

    if (this.authMethod === AuthMethod.REMOTE_SIGNER) {
      if (!this.nip46Signer) {
        throw new NostrSecurityError('Nostr Connect signer is not available');
      }
      return this.nip46Signer.signEvent(eventTemplate);
    }

    if (this.authMethod === AuthMethod.ANDROID_SIGNER && this.publicKey) {
      const result = await this.requestNip55Value('request', 'event', (callbackUrl, id) =>
        signEventUri({
          eventJson: eventTemplate,
          currentUser: this.publicKey!,
          callbackUrl,
          id,
          returnType: 'event',
          compressionType: 'none',
        })
      );
      const signedEvent = JSON.parse(result) as VerifiedEvent;
      if (!verifyEvent(signedEvent)) {
        throw new NostrSecurityError('Android Signer returned an invalid event');
      }
      return signedEvent;
    }

    if (!this.privateKey) {
      throw new NostrSecurityError('Private key not available');
    }

    return finalizeEvent(eventTemplate, this.privateKey);
  }

  private relayAuthSigner(): ((event: EventTemplate) => Promise<VerifiedEvent>) | undefined {
    if (!this.isAuthenticated()) {
      return undefined;
    }

    return (event) => this.signEvent(event);
  }

  private isPublishFailureReason(reason: string): boolean {
    const normalizedReason = reason.toLowerCase();
    return (
      normalizedReason.startsWith('connection failure:') ||
      normalizedReason.includes('timed out') ||
      normalizedReason.includes('auth-required') ||
      normalizedReason.includes('restricted:')
    );
  }

  private publishErrorsFromResults(results: PromiseSettledResult<string>[]): string[] {
    return results
      .map((result) => {
        if (result.status === 'rejected') {
          return result.reason instanceof Error ? result.reason.message : String(result.reason);
        }

        return this.isPublishFailureReason(result.value) ? result.value : null;
      })
      .filter((error): error is string => error !== null);
  }

  private async waitForRetry(attempt: number): Promise<void> {
    const delay = RELAY_RETRY_BASE_DELAY_MS * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async publishWithRetry(
    relays: string[],
    event: NostrEvent,
    label: string
  ): Promise<string[]> {
    const relayUrls = this.uniqueRelayUrls(relays);
    if (relayUrls.length === 0) {
      throw new Error('No valid relays available');
    }

    let lastErrors: string[] = [];

    for (let attempt = 0; attempt < MAX_RELAY_RETRIES; attempt += 1) {
      const results = await Promise.allSettled(
        this.pool.publish(relayUrls, event, {
          maxWait: RELAY_MAX_WAIT_MS,
          onauth: this.relayAuthSigner(),
        })
      );

      const errors = this.publishErrorsFromResults(results);
      const successCount = results.length - errors.length;

      if (successCount > 0) {
        const successfulRelays = relayUrls.filter((_, index) => {
          const result = results[index];
          if (result.status === 'rejected') return false;
          return !this.isPublishFailureReason(result.value);
        });

        if (errors.length > 0) {
          console.info(`${label} published to ${successCount}/${relayUrls.length} relays`, errors);
        }
        this.pool.pruneIdleRelays();

        return successfulRelays.length > 0 ? [successfulRelays[0]] : [];
      }

      lastErrors = errors;
      if (attempt < MAX_RELAY_RETRIES - 1) {
        await this.waitForRetry(attempt);
      }
    }

    throw new Error(`${label} could not be published to any relay: ${lastErrors.join('; ')}`);
  }

  private async queryWithRetry(
    relays: string[],
    filter: Filter,
    label: string
  ): Promise<NostrEvent[]> {
    const relayUrls = this.uniqueRelayUrls(relays);
    if (relayUrls.length === 0) {
      return [];
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < QUERY_MAX_RELAY_RETRIES; attempt += 1) {
      try {
        const events = await this.pool.querySync(relayUrls, filter, {
          label,
          maxWait: QUERY_RELAY_MAX_WAIT_MS,
        });
        this.pool.pruneIdleRelays();
        return events;
      } catch (error) {
        lastError = error;
        if (attempt < QUERY_MAX_RELAY_RETRIES - 1) {
          await this.waitForRetry(attempt);
        }
      }
    }

    console.warn(
      `${label} query failed after retries:`,
      lastError instanceof Error ? lastError.message : lastError
    );
    return [];
  }

  private async fetchBlossomServerList(): Promise<string[]> {
    if (!this.publicKey) {
      return [];
    }

    const activeRelays = await this.getActiveRelays();
    const events = await this.queryWithRetry(activeRelays, {
      kinds: [BLOSSOM_SERVER_LIST_KIND],
      authors: [this.publicKey],
      limit: 5,
    }, 'blossom server list');

    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    if (!latestEvent) {
      return [];
    }

    const servers = latestEvent.tags
      .filter((tag) => tag[0] === 'server' && tag[1])
      .map((tag) => tag[1]);

    const normalizedServers = this.uniqueHttpUrls(servers);
    if (normalizedServers.length > 0) {
      await AsyncStorage.setItem(BLOSSOM_SERVERS_STORAGE_KEY, JSON.stringify(normalizedServers));
    }

    return normalizedServers;
  }

  private async publishBlossomServerList(servers: string[]): Promise<void> {
    if (!this.isAuthenticated() || !this.publicKey) {
      return;
    }

    const normalizedServers = this.uniqueHttpUrls(servers);
    if (normalizedServers.length === 0) {
      return;
    }

    const event = await this.signEvent({
      kind: BLOSSOM_SERVER_LIST_KIND,
      created_at: this.nowInSeconds(),
      tags: normalizedServers.map((server) => ['server', server]),
      content: '',
    });

    await this.publishWithRetry(await this.getActiveRelays(), event, 'blossom server list');
  }

  private async getUploadBlossomServers(): Promise<{ servers: string[]; usedFallback: boolean }> {
    const storedServers = await this.getStoredBlossomServers();
    const publishedServers = await this.fetchBlossomServerList();
    const userServers = this.uniqueHttpUrls([...storedServers, ...publishedServers]);
    const servers = this.uniqueHttpUrls([...userServers, ...DEFAULT_BLOSSOM_SERVERS]);

    return { servers, usedFallback: userServers.length === 0 };
  }

  private async sha256Hex(bytes: Uint8Array): Promise<string> {
    const hashInput = new Uint8Array(bytes.byteLength);
    hashInput.set(bytes);
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, hashInput);
    return bytesToHex(new Uint8Array(digest));
  }

  private getServerHost(server: string): string {
    return new URL(server).host.toLowerCase();
  }

  private async createBlossomAuthorizationHeader(
    server: string,
    sha256: string
  ): Promise<string> {
    const tags: string[][] = [
      ['t', 'upload'],
      ['expiration', String(this.nowInSeconds() + BLOSSOM_AUTH_EXPIRY_SECONDS)],
      ['server', this.getServerHost(server)],
      ['x', sha256],
    ];

    const signedEvent = await this.signEvent({
      kind: BLOSSOM_AUTH_KIND,
      created_at: this.nowInSeconds(),
      tags,
      content: 'Upload Blob',
    });

    return `Nostr ${this.base64UrlEncode(JSON.stringify(signedEvent))}`;
  }

  private assertUploadNotCancelled(signal?: AbortSignal | null): void {
    if (signal?.aborted) {
      throw new Error('Upload canceled');
    }
  }

  private async uploadToBlossomServer(
    server: string,
    bytes: Uint8Array,
    input: BlossomUploadInput,
    sha256: string
  ): Promise<BlossomDescriptor> {
    this.assertUploadNotCancelled(input.signal);
    const uploadUrl = `${server}/upload`;
    const mimeType = input.mimeType || 'application/octet-stream';
    const authHeader = await this.createBlossomAuthorizationHeader(server, sha256);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BLOSSOM_UPLOAD_MAX_WAIT_MS);
    const cancelUpload = () => controller.abort();
    let response: Response;

    try {
      input.signal?.addEventListener('abort', cancelUpload, { once: true });
      response = await expoFetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: String(authHeader),
          'Content-Type': (mimeType && mimeType !== 'null' && mimeType !== '<null>') ? String(mimeType) : 'application/octet-stream',
          'Content-Length': String(bytes.byteLength),
          'X-SHA-256': String(sha256),
        },
        body: bytes as any,
        signal: controller.signal as any,
      });
    } catch (error) {
      if (input.signal?.aborted) {
        throw new Error('Upload canceled');
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Blossom upload timed out on ${server}`);
      }
      throw error;
    } finally {
      input.signal?.removeEventListener('abort', cancelUpload);
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const reason = response.headers.get('X-Reason');
      const message = reason || `HTTP ${response.status}`;
      throw new Error(`Blossom upload failed on ${server}: ${message}`);
    }

    const descriptor = await response.json() as Partial<BlossomDescriptor>;
    if (!descriptor.url || !descriptor.sha256) {
      throw new Error(`Invalid Blossom descriptor from ${server}`);
    }

    return {
      url: descriptor.url,
      sha256: descriptor.sha256,
      size: Number(descriptor.size || bytes.byteLength),
      type: descriptor.type || mimeType,
      uploaded: descriptor.uploaded,
    };
  }

  private async publishFileMetadata(
    descriptor: BlossomDescriptor,
    input: BlossomUploadInput,
    server: string
  ): Promise<string | null> {
    if (!this.isAuthenticated() || !this.publicKey) {
      return null;
    }

    const tags: string[][] = [
      ['url', descriptor.url],
      ['m', descriptor.type.toLowerCase()],
      ['x', descriptor.sha256],
      ['ox', descriptor.sha256],
      ['size', String(descriptor.size)],
      ['service', 'blossom', server],
      ['client', CLIENT_TAG],
    ];

    if (input.width && input.height) {
      tags.push(['dim', `${Math.round(input.width)}x${Math.round(input.height)}`]);
    }

    if (input.alt) {
      tags.push(['alt', input.alt]);
    }

    const signedEvent = await this.signEvent({
      kind: FILE_METADATA_KIND,
      created_at: this.nowInSeconds(),
      tags,
      content: input.name || '',
    });

    try {
      await this.publishWithRetry(await this.getActiveRelays(), signedEvent, 'file metadata');
    } catch (error) {
      console.warn('File metadata publish failed:', error);
    }

    return signedEvent.id;
  }

  async uploadBlossomFile(input: BlossomUploadInput): Promise<BlossomUploadResult> {
    if (!this.isAuthenticated() || !this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    this.assertUploadNotCancelled(input.signal);
    const { servers, usedFallback } = await this.getUploadBlossomServers();
    if (servers.length === 0) {
      throw new Error('Blossom server not configured');
    }

    let bytes: Uint8Array;

    if (Platform.OS === 'web') {
      if (input.uri.startsWith('data:')) {
        const parsedDataUri = parseDataUri(input.uri);
        if (!parsedDataUri) {
          throw new Error('Invalid data URI');
        }
        bytes = parsedDataUri.bytes;
      } else {
        const blob = input.file || await fetch(input.uri).then((response) => response.blob());
        bytes = new Uint8Array(await blob.arrayBuffer());
      }
    } else if (input.uri.startsWith('data:')) {
      const parsedDataUri = parseDataUri(input.uri);
      if (!parsedDataUri) {
        throw new Error('Invalid data URI');
      }
      bytes = parsedDataUri.bytes;
    } else {
      try {
        const file = new File(input.uri);
        bytes = await file.bytes();
      } catch {
        const base64 = await FileSystem.readAsStringAsync(input.uri, { encoding: 'base64' as any });
        bytes = base64ToBytes(base64);
      }
    }

    this.assertUploadNotCancelled(input.signal);
    const sha256 = await this.sha256Hex(bytes);
    this.assertUploadNotCancelled(input.signal);
    const errors: string[] = [];

    for (const server of servers) {
      try {
        this.assertUploadNotCancelled(input.signal);
        const descriptor = await this.uploadToBlossomServer(server, bytes, input, sha256);
        this.assertUploadNotCancelled(input.signal);
        const metadataEventId = await this.publishFileMetadata(descriptor, input, server);

        if (usedFallback || DEFAULT_BLOSSOM_SERVERS.includes(server)) {
          const storedServers = await this.getStoredBlossomServers();
          const nextServers = this.uniqueHttpUrls([
            server,
            ...storedServers.filter((storedServer) => storedServer !== server),
          ]);
          await AsyncStorage.setItem(BLOSSOM_SERVERS_STORAGE_KEY, JSON.stringify(nextServers));
          void this.publishBlossomServerList([server]).catch((error) => {
            console.warn('Fallback Blossom server list publish failed:', error);
          });
        }

        return {
          url: descriptor.url,
          sha256: descriptor.sha256,
          size: descriptor.size,
          mimeType: descriptor.type,
          uploadedAt: descriptor.uploaded,
          server,
          name: input.name,
          width: input.width,
          height: input.height,
          metadataEventId,
        };
      } catch (error) {
        if (input.signal?.aborted) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        console.info('Blossom upload server skipped:', message);
      }
    }

    throw new Error(`Blossom upload failed on all configured servers: ${errors.join(' | ')}`);
  }

  private getNotePlainPayload(note: Note): string {
    return JSON.stringify({
      title: note.title,
      content: note.content,
      id: note.id,
    });
  }

  private getNotePlainPayloadSize(note: Note): number {
    return utf8Bytes(this.getNotePlainPayload(note)).byteLength;
  }

  private getEmbeddedDataMedia(content: string): EmbeddedDataMedia[] {
    const mediaByUrl = new Map<string, EmbeddedDataMedia>();
    const attributePattern = /\b(?:src|data-drawing-src)=["'](data:image\/[^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = attributePattern.exec(content)) !== null) {
      const dataUrl = match[1];
      const parsedDataUri = parseDataUri(dataUrl);
      if (!parsedDataUri || !parsedDataUri.mimeType.startsWith('image/')) {
        continue;
      }

      mediaByUrl.set(dataUrl, {
        dataUrl,
        mimeType: parsedDataUri.mimeType,
        extension: extensionFromMimeType(parsedDataUri.mimeType),
        width: 1200,
        height: 900,
      });
    }

    return Array.from(mediaByUrl.values());
  }

  private async prepareNoteForRelay(note: Note, label: string): Promise<Note | null> {
    let relayContent = note.content;
    const embeddedMedia = this.getEmbeddedDataMedia(relayContent);

    for (let index = 0; index < embeddedMedia.length; index += 1) {
      const item = embeddedMedia[index];
      try {
        const upload = await this.uploadBlossomFile({
          uri: item.dataUrl,
          name: `cetele-drawing-${note.id}-${index + 1}.${item.extension}`,
          mimeType: item.mimeType,
          width: item.width,
          height: item.height,
          alt: note.title ? `${note.title} çizimi` : 'Çizim',
        });
        relayContent = replaceAllLiteral(relayContent, item.dataUrl, escapeHtmlAttribute(upload.url));
      } catch (error) {
        console.warn(`${label} drawing upload failed; keeping note local:`, error);
        return null;
      }
    }

    const relayNote = { ...note, content: relayContent };
    const payloadSize = this.getNotePlainPayloadSize(relayNote);
    if (payloadSize > PRIVATE_NOTE_RELAY_PAYLOAD_MAX_BYTES) {
      console.warn(
        `${label} skipped relay publish because note payload is still too large after media offload: ${payloadSize}`
      );
      return null;
    }

    return relayNote;
  }

  private async createNoteEventTemplate(note: Note): Promise<EventTemplate> {
    const payload = this.getNotePlainPayload(note);

    const { ciphertext, method } = await this.encryptContent(payload);

    return {
      kind: LongFormArticle,
      created_at: this.nowInSeconds(),
      tags: [
        ['d', note.id],
        ['client', CLIENT_TAG],
        ['encrypted', method],
        ['title', note.title || 'Untitled'],
      ],
      content: ciphertext,
    };
  }

  private async publishPrivateEvent(
    eventTemplate: EventTemplate,
    label: string
  ): Promise<string> {
    const { eventId, wrappedEvent, activeRelays } = await this.preparePrivateEvent(eventTemplate);

    try {
      await this.publishWithRetry(activeRelays, wrappedEvent, label);
    } catch (relayError) {
      console.warn(`${label} saved locally but relay publish failed:`, relayError);
    }

    return eventId;
  }

  private async preparePrivateEvent(eventTemplate: EventTemplate): Promise<{
    eventId: string;
    wrappedEvent: NostrEvent;
    activeRelays: string[];
  }> {
    if (!this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    if (this.authMethod === AuthMethod.EXTENSION && !window.nostr?.nip44) {
      const signedEvent = await this.signEvent(eventTemplate);
      return {
        eventId: signedEvent.id,
        wrappedEvent: signedEvent,
        activeRelays: await this.getActiveRelays(),
      };
    }

    return {
      eventId: this.getRumorId(eventTemplate),
      wrappedEvent: await this.createGiftWrap(eventTemplate, this.publicKey),
      activeRelays: await this.getActiveRelays(),
    };
  }

  private publishPreparedPrivateEvent(
    preparedEvent: { wrappedEvent: NostrEvent; activeRelays: string[] },
    label: string
  ): void {
    void this.publishWithRetry(
      preparedEvent.activeRelays,
      preparedEvent.wrappedEvent,
      label
    ).catch((relayError) => {
      console.warn(`${label} saved locally but relay publish failed:`, relayError);
    });
  }

  private async publishCachedNoteInBackground(note: Note, label: string): Promise<void> {
    try {
      const relayNote = await this.prepareNoteForRelay(note, label);
      if (!relayNote) {
        return;
      }

      const noteEvent = await this.createNoteEventTemplate(relayNote);
      const preparedEvent = await this.preparePrivateEvent(noteEvent);

      const noteToCache = {
        ...relayNote,
        eventId: preparedEvent.eventId,
        createdAt: note.createdAt || noteEvent.created_at * 1000,
        updatedAt: noteEvent.created_at * 1000,
      };

      this.notesCache.set(note.id, noteToCache);
      await this.saveCacheToStorage();
      this.publishPreparedPrivateEvent(preparedEvent, label);
    } catch (error) {
      console.warn(`${label} saved locally but background relay preparation failed:`, error);
    }
  }

  private async parseNoteEvent(event: NostrEvent | NostrRumor): Promise<Note | null> {
    if (event.kind !== LongFormArticle) {
      return null;
    }

    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    if (!dTag) {
      return null;
    }

    const isPublic = event.tags.some(t => t[0] === 'published_at');
    if (isPublic) {
      return null;
    }

    const method = event.tags.find(t => t[0] === 'encrypted')?.[1] as 'nip44' | 'nip04' | undefined || 'nip44';

    let decrypted: string;
    try {
      decrypted = await this.decryptContent(event.content, method);
    } catch {
      return null;
    }
    const noteData = JSON.parse(decrypted) as Pick<Note, 'id' | 'title' | 'content'>;
    const noteId = noteData.id || dTag;

    return {
      id: noteId,
      title: noteData.title,
      content: noteData.content,
      eventId: event.id,
      createdAt: event.created_at * 1000,
      updatedAt: event.created_at * 1000,
    };
  }

  private getDeletedNoteIds(event: NostrEvent | NostrRumor): string[] {
    if (event.kind !== EventDeletion || !this.publicKey) {
      return [];
    }

    return event.tags
      .filter(tag => tag[0] === 'a' && tag[1]?.startsWith(`${LongFormArticle}:${this.publicKey}:`))
      .map(tag => tag[1].split(':').slice(2).join(':'))
      .filter(Boolean);
  }

  private async applyRemoteEvent(
    event: NostrEvent | NostrRumor,
    notesMap: Map<string, Note>,
    deletedAtByNoteId: Map<string, number>
  ): Promise<void> {
    if (event.kind === EventDeletion) {
      for (const noteId of this.getDeletedNoteIds(event)) {
        const deletedAt = event.created_at * 1000;
        const previousDeletedAt = deletedAtByNoteId.get(noteId) ?? 0;
        if (deletedAt > previousDeletedAt) {
          deletedAtByNoteId.set(noteId, deletedAt);
        }

        const existingNote = notesMap.get(noteId);
        if (existingNote && deletedAt >= existingNote.updatedAt) {
          notesMap.delete(noteId);
        }
      }
      return;
    }

    const note = await this.parseNoteEvent(event);
    if (!note) {
      return;
    }

    const deletedAt = deletedAtByNoteId.get(note.id) ?? 0;
    if (deletedAt >= note.updatedAt) {
      return;
    }

    const existingNote = notesMap.get(note.id);
    if (!existingNote || note.updatedAt > existingNote.updatedAt) {
      notesMap.set(note.id, note);
    }
  }

  async publishNote(note: Note): Promise<string | null> {
    if (!this.isAuthenticated() || !this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    try {
      await this.ensureCacheReady();
      const now = Date.now();
      const localEventId = note.eventId || `local-${note.id}`;

      const noteToCache = {
        ...note,
        eventId: localEventId,
        createdAt: note.createdAt || now,
        updatedAt: now,
      };

      this.notesCache.set(note.id, noteToCache);
      await this.saveCacheToStorage();
      void this.publishCachedNoteInBackground(noteToCache, 'note publish');

      return localEventId;
    } catch (error) {
      console.error('Failed to publish note:', error);
      return null;
    }
  }

  async fetchNotes(): Promise<Note[]> {
    if (!this.isAuthenticated() || !this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    await this.ensureCacheReady();
    const activeRelays = await this.getActiveRelays();

    const sinceTimestamp = this.lastSyncTimestamp > 0
      ? this.lastSyncTimestamp
      : this.nowInSeconds() - 30 * 24 * 60 * 60;

    const [giftWraps, directEvents] = await Promise.all([
      this.queryWithRetry(activeRelays, {
        kinds: [GiftWrap],
        '#p': [this.publicKey],
        since: sinceTimestamp,
        limit: 500,
      }, 'gift-wrap sync'),
      this.queryWithRetry(activeRelays, {
        kinds: [LongFormArticle, EventDeletion],
        authors: [this.publicKey],
        since: sinceTimestamp,
        limit: 500,
      }, 'legacy direct note sync'),
    ]);

    const deletedAtByNoteId = new Map<string, number>();
    const remoteEvents: (NostrEvent | NostrRumor)[] = [...directEvents];

    for (const giftWrap of giftWraps) {
      try {
        const unwrappedEvent = await this.unwrapGiftWrap(giftWrap);
        if (unwrappedEvent) {
          remoteEvents.push(unwrappedEvent);
        }
      } catch (error) {
        console.error('Failed to process gift wrap:', error);
      }
    }

    remoteEvents.sort((a, b) => a.created_at - b.created_at);

    const latestNotesMap = new Map<string, Note>(this.notesCache);

    for (const event of remoteEvents) {
      try {
        await this.applyRemoteEvent(event, latestNotesMap, deletedAtByNoteId);
      } catch (error) {
        console.error('Failed to process remote note event:', error);
      }
    }

    this.notesCache = latestNotesMap;
    this.lastSyncTimestamp = this.nowInSeconds();
    await this.saveCacheToStorage();

    return this.sortedNotes(latestNotesMap.values());
  }

  async updateNote(note: Note): Promise<string | null> {
    if (!this.isAuthenticated() || !this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    try {
      await this.ensureCacheReady();
      const now = Date.now();
      const localEventId = note.eventId || `local-${note.id}`;

      const updatedNote = {
        ...note,
        eventId: localEventId,
        createdAt: note.createdAt || now,
        updatedAt: now,
      };

      this.notesCache.set(note.id, updatedNote);
      await this.saveCacheToStorage();
      void this.publishCachedNoteInBackground(updatedNote, 'note update');

      return localEventId;
    } catch (error) {
      console.error('Failed to update note:', error);
      return null;
    }
  }

  async publishPublicNote(note: Note, markdownContent: string): Promise<{
    eventId: string;
    naddr: string;
    nostrUri: string;
    webUrl: string;
  } | null> {
    if (!this.isAuthenticated() || !this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    try {
      const activeRelays = await this.getActiveRelays();
      if (!/^[0-9a-f]{64}$/i.test(this.publicKey)) {
        throw new NostrSecurityError('Invalid Nostr public key');
      }

      const identifier = this.safeAddressIdentifier(note);
      const publishedAt = Math.floor((note.createdAt || Date.now()) / 1000);

      const signedEvent = await this.signEvent({
        kind: LongFormArticle,
        created_at: this.nowInSeconds(),
        tags: [
          ['d', identifier],
          ['title', note.title || 'Çetele notu'],
          ['published_at', String(publishedAt)],
          ['client', CLIENT_TAG],
          ['t', 'cetele'],
          ['t', 'notes'],
        ],
        content: markdownContent,
      });

      const successfulRelays = await this.publishWithRetry(activeRelays, signedEvent, 'public note share');
      const naddrRelays = this.safeAddressRelays(successfulRelays).slice(0, 1);

      const naddr = nip19.naddrEncode({
        identifier,
        pubkey: this.publicKey,
        kind: LongFormArticle,
        relays: naddrRelays,
      });

      return {
        eventId: signedEvent.id,
        naddr,
        nostrUri: `nostr:${naddr}`,
        webUrl: `https://njump.me/${naddr}`,
      };
    } catch (error) {
      console.error('Failed to publish public note:', error);
      return null;
    }
  }

  async deleteNote(noteId: string): Promise<boolean> {
    if (!this.isAuthenticated() || !this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    try {
      await this.ensureCacheReady();
      const note = this.notesCache.get(noteId);
      if (!note) {
        return false;
      }

      const deletionEvent: EventTemplate = {
        kind: EventDeletion,
        created_at: this.nowInSeconds(),
        tags: [
          ['a', `${LongFormArticle}:${this.publicKey}:${noteId}`],
          ['k', String(LongFormArticle)],
        ],
        content: '',
      };

      await this.publishPrivateEvent(deletionEvent, 'note deletion');

      this.notesCache.delete(noteId);
      await this.saveCacheToStorage();

      return true;
    } catch (error) {
      console.error('Failed to delete note:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(KEY_STORAGE_KEY);
    } else {
      await AsyncStorage.removeItem(WEB_SIGNER_SESSION_KEY);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(NIP55_LOGIN_FALLBACK_KEY);
        for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
          const key = window.localStorage.key(index);
          if (
            key?.startsWith(NIP55_CALLBACK_RESULT_PREFIX) ||
            key?.startsWith(NIP55_CALLBACK_PENDING_PREFIX)
          ) {
            window.localStorage.removeItem(key);
          }
        }
      }
      if (this.nip46Signer) {
        await this.nip46Signer.close().catch(() => undefined);
      }
    }

    await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}notes`);
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
    await AsyncStorage.removeItem(RELAYS_STORAGE_KEY);
    await AsyncStorage.removeItem(BLOSSOM_SERVERS_STORAGE_KEY);

    this.privateKey = null;
    this.publicKey = null;
    this.nip46Signer = null;
    this.authMethod = AuthMethod.NOT_AUTHENTICATED;
    this.invalidateSessionRestore();
    this.notesCache.clear();
    this.lastSyncTimestamp = 0;
    this.userRelays = [];
  }

  async clearCache(): Promise<void> {
    this.notesCache.clear();
    this.lastSyncTimestamp = 0;
    await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}notes`);
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64ToBytes(value: string): Uint8Array {
  const cleanValue = value.replace(/\s/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];

  for (let index = 0; index < cleanValue.length; index += 4) {
    const first = alphabet.indexOf(cleanValue[index]);
    const second = alphabet.indexOf(cleanValue[index + 1]);
    const third = cleanValue[index + 2] === '=' ? -1 : alphabet.indexOf(cleanValue[index + 2]);
    const fourth = cleanValue[index + 3] === '=' ? -1 : alphabet.indexOf(cleanValue[index + 3]);

    if (first < 0 || second < 0) break;

    const triple = (first << 18) | (second << 12) | ((third > -1 ? third : 0) << 6) | (fourth > -1 ? fourth : 0);
    bytes.push((triple >> 16) & 255);
    if (third > -1) bytes.push((triple >> 8) & 255);
    if (fourth > -1) bytes.push(triple & 255);
  }

  return new Uint8Array(bytes);
}

function parseDataUri(value: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = value.match(/^data:([^;,]+)?((?:;[^,]*)?),(.*)$/s);
  if (!match) {
    return null;
  }

  const mimeType = (match[1] || 'application/octet-stream').toLowerCase();
  const metadata = match[2] || '';
  const data = match[3] || '';

  if (metadata.toLowerCase().includes(';base64')) {
    return { mimeType, bytes: base64ToBytes(data) };
  }

  try {
    return { mimeType, bytes: utf8Bytes(decodeURIComponent(data)) };
  } catch {
    return { mimeType, bytes: utf8Bytes(data) };
  }
}

function extensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('svg')) return 'svg';
  if (normalized.includes('gif')) return 'gif';
  return 'png';
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceAllLiteral(source: string, search: string, replacement: string): string {
  return source.split(search).join(replacement);
}

function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];

  for (let i = 0; i < value.length; i += 1) {
    let codePoint = value.charCodeAt(i);

    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >> 12));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xf0 | (codePoint >> 18));
      bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    }
  }

  return new Uint8Array(bytes);
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new Error('Invalid hex string');
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}

export const nostrService = new NostrService();
