import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';

const REQUEST_HISTORY_KEY = 'cetele:store-review:request-history';
const LEGACY_NOTE_SAVE_COUNT_KEY = 'cetele:store-review:note-save-count';
const LEGACY_LAST_REQUEST_AT_KEY = 'cetele:store-review:last-request-at';

const DAY_MS = 1000 * 60 * 60 * 24;
const REQUEST_WINDOW_MS = 365 * DAY_MS;
const MIN_REQUEST_INTERVAL_MS = 120 * DAY_MS;
const MAX_REQUESTS_PER_WINDOW = 3;

let requestInFlight: Promise<void> | null = null;

function isExpoGo() {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient &&
    Constants.expoGoConfig !== null
  );
}

function parseRequestHistory(rawHistory: string | null) {
  if (!rawHistory) return [];

  try {
    const history: unknown = JSON.parse(rawHistory);
    if (!Array.isArray(history)) return [];

    return history.filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value)
    );
  } catch {
    return [];
  }
}

async function getRecentRequestHistory(now: number) {
  const entries = await AsyncStorage.multiGet([
    REQUEST_HISTORY_KEY,
    LEGACY_LAST_REQUEST_AT_KEY,
  ]);
  const storedValues = new Map(entries);
  const history = parseRequestHistory(storedValues.get(REQUEST_HISTORY_KEY) ?? null);
  const legacyLastRequestAt = Number(storedValues.get(LEGACY_LAST_REQUEST_AT_KEY));

  if (Number.isFinite(legacyLastRequestAt) && legacyLastRequestAt > 0) {
    history.push(legacyLastRequestAt);
  }

  return [...new Set(history)]
    .filter((requestedAt) => requestedAt <= now && now - requestedAt < REQUEST_WINDOW_MS)
    .sort((left, right) => left - right);
}

async function requestStoreReviewAfterNoteCreated() {
  const now = Date.now();
  const recentRequests = await getRecentRequestHistory(now);
  const lastRequestAt = recentRequests.at(-1) ?? 0;

  if (
    recentRequests.length >= MAX_REQUESTS_PER_WINDOW ||
    (lastRequestAt > 0 && now - lastRequestAt < MIN_REQUEST_INTERVAL_MS)
  ) {
    return;
  }

  const isAvailable = await StoreReview.isAvailableAsync();
  if (!isAvailable || !(await StoreReview.hasAction())) {
    return;
  }

  await StoreReview.requestReview();
  await AsyncStorage.setItem(
    REQUEST_HISTORY_KEY,
    JSON.stringify([...recentRequests, now])
  );
  await AsyncStorage.multiRemove([
    LEGACY_NOTE_SAVE_COUNT_KEY,
    LEGACY_LAST_REQUEST_AT_KEY,
  ]);
}

export async function maybeRequestStoreReviewAfterNoteCreated() {
  if (Platform.OS === 'web' || isExpoGo()) {
    return;
  }

  if (!requestInFlight) {
    requestInFlight = requestStoreReviewAfterNoteCreated().finally(() => {
      requestInFlight = null;
    });
  }

  await requestInFlight;
}
