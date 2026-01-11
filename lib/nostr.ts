import 'react-native-get-random-values';
import {
  SimplePool,
  finalizeEvent,
  nip44,
  nip19,
  generateSecretKey,
  getPublicKey,
  type Event as NostrEvent,
  type UnsignedEvent,
} from 'nostr-tools';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { NostrKeys, Note } from '@/types/note';

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: UnsignedEvent): Promise<NostrEvent>;
      nip44?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
    };
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

export interface UserRelay {
  id: string;
  relay_url: string;
  is_enabled: boolean;
  is_default: boolean;
  created_at: string;
}

export enum AuthMethod {
  EXTENSION = 'extension',
  MOBILE_SECURE = 'mobile_secure',
  NOT_AUTHENTICATED = 'not_authenticated',
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

  constructor() {
    this.pool = new SimplePool();
    this.loadCacheFromStorage();
  }

  private async loadUserRelays(): Promise<string[]> {
    try {
      const storedRelays = await AsyncStorage.getItem(RELAYS_STORAGE_KEY);

      if (!storedRelays) {
        await this.initializeDefaultRelays();
        return DEFAULT_RELAYS;
      }

      const relays: UserRelay[] = JSON.parse(storedRelays);
      const enabledRelays = relays.filter(r => r.is_enabled).map(r => r.relay_url);

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
      const relays = await this.getUserRelays();

      const exists = relays.some(r => r.relay_url === relayUrl);
      if (exists) {
        return false;
      }

      const newRelay: UserRelay = {
        id: `relay_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        relay_url: relayUrl,
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
    return this.userRelays.length > 0 ? this.userRelays : DEFAULT_RELAYS;
  }

  private async loadCacheFromStorage(): Promise<void> {
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

  private generateRandomKeypair(): { privateKey: Uint8Array; publicKey: string } {
    const privateKey = generateSecretKey();
    const publicKey = getPublicKey(privateKey);
    return { privateKey, publicKey };
  }

  private async createGiftWrap(innerEvent: NostrEvent, recipientPubkey: string): Promise<NostrEvent> {
    if (!this.privateKey) {
      throw new NostrSecurityError('Private key not available for gift wrapping');
    }

    const randomKeypair = this.generateRandomKeypair();

    const sealedRumor: UnsignedEvent = {
      kind: 1059,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkey]],
      content: JSON.stringify(innerEvent),
      pubkey: randomKeypair.publicKey,
    };

    const sealedEvent = finalizeEvent(sealedRumor, randomKeypair.privateKey);

    const conversationKey = nip44.v2.utils.getConversationKey(
      randomKeypair.privateKey,
      recipientPubkey
    );
    const encryptedContent = nip44.v2.encrypt(JSON.stringify(sealedEvent), conversationKey);

    const giftWrap: UnsignedEvent = {
      kind: 1059,
      created_at: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 172800) - 86400,
      tags: [['p', recipientPubkey]],
      content: encryptedContent,
      pubkey: randomKeypair.publicKey,
    };

    return finalizeEvent(giftWrap, randomKeypair.privateKey);
  }

  private async unwrapGiftWrap(giftWrapEvent: NostrEvent): Promise<NostrEvent | null> {
    if (!this.privateKey || !this.publicKey) {
      throw new NostrSecurityError('Keys not available for unwrapping');
    }

    try {
      const conversationKey = nip44.v2.utils.getConversationKey(
        this.privateKey,
        giftWrapEvent.pubkey
      );

      const decryptedContent = nip44.v2.decrypt(giftWrapEvent.content, conversationKey);
      const sealedEvent = JSON.parse(decryptedContent);

      if (sealedEvent.kind === 1059 && sealedEvent.content) {
        return JSON.parse(sealedEvent.content);
      }

      return sealedEvent;
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
    if (Platform.OS === 'web') {
      if (window.nostr) {
        try {
          const keys = await this.loginWithExtension();
          this.userRelays = await this.loadUserRelays();
          return keys;
        } catch {
          return null;
        }
      }
      return null;
    }

    const storedKey = await this.loadMobileKey();
    if (!storedKey) {
      return null;
    }

    try {
      this.privateKey = hexToBytes(storedKey);
      this.publicKey = getPublicKey(this.privateKey);
      this.authMethod = AuthMethod.MOBILE_SECURE;

      this.userRelays = await this.loadUserRelays();

      return {
        privateKey: nip19.nsecEncode(this.privateKey),
        publicKey: this.publicKey,
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

  private async encryptContent(content: string): Promise<string> {
    if (!this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    if (this.authMethod === AuthMethod.EXTENSION) {
      if (!window.nostr?.nip44) {
        throw new NostrSecurityError(
          'Extension does not support NIP-44 encryption'
        );
      }
      return await window.nostr.nip44.encrypt(this.publicKey, content);
    }

    if (!this.privateKey) {
      throw new NostrSecurityError('Private key not available');
    }

    const conversationKey = nip44.v2.utils.getConversationKey(
      this.privateKey,
      this.publicKey
    );
    return nip44.v2.encrypt(content, conversationKey);
  }

  private async decryptContent(ciphertext: string): Promise<string> {
    if (!this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    if (this.authMethod === AuthMethod.EXTENSION) {
      if (!window.nostr?.nip44) {
        throw new NostrSecurityError(
          'Extension does not support NIP-44 decryption'
        );
      }
      return await window.nostr.nip44.decrypt(this.publicKey, ciphertext);
    }

    if (!this.privateKey) {
      throw new NostrSecurityError('Private key not available');
    }

    const conversationKey = nip44.v2.utils.getConversationKey(
      this.privateKey,
      this.publicKey
    );
    return nip44.v2.decrypt(ciphertext, conversationKey);
  }

  private async signEvent(unsignedEvent: UnsignedEvent): Promise<NostrEvent> {
    if (this.authMethod === AuthMethod.EXTENSION) {
      if (!window.nostr) {
        throw new NostrSecurityError('Extension not available');
      }
      return await window.nostr.signEvent(unsignedEvent);
    }

    if (!this.privateKey) {
      throw new NostrSecurityError('Private key not available');
    }

    return finalizeEvent(unsignedEvent, this.privateKey);
  }

  async publishNote(note: Note): Promise<string | null> {
    if (!this.isAuthenticated() || !this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    try {
      const payload = JSON.stringify({
        title: note.title,
        content: note.content,
        id: note.id,
      });

      const encryptedContent = await this.encryptContent(payload);

      const addressableEvent: UnsignedEvent = {
        kind: 30023,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', note.id],
          ['client', 'cetele-cypherpunk'],
          ['encrypted', 'nip44'],
          ['title', note.title || 'Untitled'],
        ],
        content: encryptedContent,
        pubkey: this.publicKey,
      };

      const signedEvent = await this.signEvent(addressableEvent);

      const giftWrappedEvent = await this.createGiftWrap(signedEvent, this.publicKey);

      const noteToCache = {
        ...note,
        eventId: signedEvent.id,
        createdAt: signedEvent.created_at * 1000,
        updatedAt: signedEvent.created_at * 1000,
      };

      this.notesCache.set(note.id, noteToCache);
      await this.saveCacheToStorage();

      try {
        const activeRelays = await this.getActiveRelays();
        await Promise.any(this.pool.publish(activeRelays, giftWrappedEvent));
        console.log('Note published to relays successfully');
      } catch (relayError) {
        console.warn('Failed to publish to relays, but note saved locally:', relayError);
      }

      return signedEvent.id;
    } catch (error) {
      console.error('Failed to publish note:', error);
      return null;
    }
  }

  async fetchNotes(): Promise<Note[]> {
    if (!this.isAuthenticated() || !this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    const notesMap = new Map<string, Note>(this.notesCache);
    const activeRelays = await this.getActiveRelays();

    const sincTimestamp = this.lastSyncTimestamp > 0
      ? this.lastSyncTimestamp
      : Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    const giftWraps = await this.pool.querySync(activeRelays, {
      kinds: [1059],
      '#p': [this.publicKey],
      since: sincTimestamp,
      limit: 500,
    });

    for (const giftWrap of giftWraps) {
      try {
        const unwrappedEvent = await this.unwrapGiftWrap(giftWrap);

        if (unwrappedEvent && unwrappedEvent.kind === 30023) {
          const dTag = unwrappedEvent.tags.find(t => t[0] === 'd')?.[1];

          if (!dTag) continue;

          const decrypted = await this.decryptContent(unwrappedEvent.content);
          const noteData = JSON.parse(decrypted);

          const note: Note = {
            ...noteData,
            eventId: unwrappedEvent.id,
            createdAt: unwrappedEvent.created_at * 1000,
            updatedAt: unwrappedEvent.created_at * 1000,
          };

          const existingNote = notesMap.get(note.id);
          if (!existingNote || note.updatedAt > existingNote.updatedAt) {
            notesMap.set(note.id, note);
          }
        }
      } catch (error) {
        console.error('Failed to process gift wrap:', error);
      }
    }

    this.notesCache = new Map(notesMap);
    this.lastSyncTimestamp = Math.floor(Date.now() / 1000);
    await this.saveCacheToStorage();

    return Array.from(notesMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async updateNote(note: Note): Promise<string | null> {
    if (!this.isAuthenticated() || !this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    try {
      const payload = JSON.stringify({
        title: note.title,
        content: note.content,
        id: note.id,
      });

      const encryptedContent = await this.encryptContent(payload);

      const addressableEvent: UnsignedEvent = {
        kind: 30023,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', note.id],
          ['client', 'cetele-cypherpunk'],
          ['encrypted', 'nip44'],
          ['title', note.title || 'Untitled'],
        ],
        content: encryptedContent,
        pubkey: this.publicKey,
      };

      const signedEvent = await this.signEvent(addressableEvent);

      const giftWrappedEvent = await this.createGiftWrap(signedEvent, this.publicKey);

      const updatedNote = {
        ...note,
        eventId: signedEvent.id,
        updatedAt: signedEvent.created_at * 1000,
      };

      this.notesCache.set(note.id, updatedNote);
      await this.saveCacheToStorage();

      try {
        const activeRelays = await this.getActiveRelays();
        await Promise.any(this.pool.publish(activeRelays, giftWrappedEvent));
        console.log('Note update published to relays successfully');
      } catch (relayError) {
        console.warn('Failed to publish update to relays, but note saved locally:', relayError);
      }

      return signedEvent.id;
    } catch (error) {
      console.error('Failed to update note:', error);
      return null;
    }
  }

  async deleteNote(noteId: string): Promise<boolean> {
    if (!this.isAuthenticated() || !this.publicKey) {
      throw new NostrSecurityError('Not authenticated');
    }

    try {
      const note = this.notesCache.get(noteId);
      if (!note) {
        return false;
      }

      const deletionEvent: UnsignedEvent = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['a', `30023:${this.publicKey}:${noteId}`],
          ['k', '30023'],
        ],
        content: '',
        pubkey: this.publicKey,
      };

      const signedEvent = await this.signEvent(deletionEvent);

      const giftWrappedDeletion = await this.createGiftWrap(signedEvent, this.publicKey);

      this.notesCache.delete(noteId);
      await this.saveCacheToStorage();

      try {
        const activeRelays = await this.getActiveRelays();
        await Promise.any(this.pool.publish(activeRelays, giftWrappedDeletion));
        console.log('Note deletion published to relays successfully');
      } catch (relayError) {
        console.warn('Failed to publish deletion to relays, but note deleted locally:', relayError);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete note:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(KEY_STORAGE_KEY);
    }

    await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}notes`);
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
    await AsyncStorage.removeItem(RELAYS_STORAGE_KEY);

    this.privateKey = null;
    this.publicKey = null;
    this.authMethod = AuthMethod.NOT_AUTHENTICATED;
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
