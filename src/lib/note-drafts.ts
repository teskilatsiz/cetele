import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTE_DRAFT_STORAGE_PREFIX = 'cetele_note_draft_v1:';

export interface StoredNoteDraft {
  title: string;
  content: string;
  savedAt: number;
  sourceUpdatedAt?: number;
}

function storageKey(draftKey: string) {
  return `${NOTE_DRAFT_STORAGE_PREFIX}${draftKey}`;
}

export async function readNoteDraft(draftKey: string): Promise<StoredNoteDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(draftKey));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredNoteDraft>;
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
  } catch (error) {
    console.warn('Note draft could not be read:', error);
    return null;
  }
}

export async function writeNoteDraft(
  draftKey: string,
  draft: Omit<StoredNoteDraft, 'savedAt'>
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      storageKey(draftKey),
      JSON.stringify({ ...draft, savedAt: Date.now() } satisfies StoredNoteDraft)
    );
  } catch (error) {
    console.warn('Note draft could not be saved:', error);
  }
}

export async function removeNoteDraft(draftKey: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(draftKey));
  } catch (error) {
    console.warn('Note draft could not be removed:', error);
  }
}
