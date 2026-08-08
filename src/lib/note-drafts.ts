import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';

const LEGACY_NOTE_DRAFT_STORAGE_PREFIX = 'cetele_note_draft_v1:';
const NOTE_DRAFT_STORAGE_PREFIX = 'cetele_note_draft_v2:';
const NOTE_DRAFT_KEY_STORAGE = 'cetele_note_draft_nip44_key_v1';

export interface StoredNoteDraft {
  title: string;
  content: string;
  savedAt: number;
  sourceUpdatedAt?: number;
}

function storageKey(draftKey: string) {
  return `${NOTE_DRAFT_STORAGE_PREFIX}${draftKey}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Invalid draft encryption key');
  return Uint8Array.from(hex.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
}

async function getDraftConversationKey(create: boolean): Promise<Uint8Array | null> {
  if (Platform.OS === 'web') return null;

  let secretHex = await SecureStore.getItemAsync(NOTE_DRAFT_KEY_STORAGE);
  if (!secretHex && create) {
    secretHex = bytesToHex(generateSecretKey());
    await SecureStore.setItemAsync(NOTE_DRAFT_KEY_STORAGE, secretHex);
  }
  if (!secretHex) return null;

  const secret = hexToBytes(secretHex);
  return nip44.v2.utils.getConversationKey(secret, getPublicKey(secret));
}

export async function readNoteDraft(draftKey: string): Promise<StoredNoteDraft | null> {
  try {
    await AsyncStorage.removeItem(`${LEGACY_NOTE_DRAFT_STORAGE_PREFIX}${draftKey}`);

    const ciphertext = await AsyncStorage.getItem(storageKey(draftKey));
    if (!ciphertext) return null;
    const conversationKey = await getDraftConversationKey(false);
    if (!conversationKey) {
      await AsyncStorage.removeItem(storageKey(draftKey));
      return null;
    }

    const parsed = JSON.parse(nip44.v2.decrypt(ciphertext, conversationKey)) as Partial<StoredNoteDraft>;
    if (
      typeof parsed.title !== 'string' ||
      typeof parsed.content !== 'string' ||
      typeof parsed.savedAt !== 'number'
    ) {
      await AsyncStorage.removeItem(storageKey(draftKey));
      return null;
    }

    return {
      title: parsed.title,
      content: parsed.content,
      savedAt: parsed.savedAt,
      sourceUpdatedAt:
        typeof parsed.sourceUpdatedAt === 'number' ? parsed.sourceUpdatedAt : undefined,
    };
  } catch {
    await AsyncStorage.removeItem(storageKey(draftKey)).catch(() => undefined);
    return null;
  }
}

export async function writeNoteDraft(
  draftKey: string,
  draft: Omit<StoredNoteDraft, 'savedAt'>
): Promise<void> {
  try {
    const conversationKey = await getDraftConversationKey(true);
    if (!conversationKey) return;
    const plaintext = JSON.stringify({ ...draft, savedAt: Date.now() } satisfies StoredNoteDraft);
    await AsyncStorage.setItem(
      storageKey(draftKey),
      nip44.v2.encrypt(plaintext, conversationKey)
    );
  } catch {}
}

export async function removeNoteDraft(draftKey: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(draftKey));
  } catch {}
}
