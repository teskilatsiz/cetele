import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { hasMeaningfulRichContent } from '@/lib/rich-content';
import { removeNoteDraft, writeNoteDraft } from '@/lib/note-drafts';

interface NoteDraftPersistenceOptions {
  draftKey: string;
  title: string;
  content: string;
  enabled: boolean;
  dirty: boolean;
  sourceUpdatedAt?: number;
}

const DRAFT_WRITE_DELAY_MS = 350;

export function useNoteDraftPersistence({
  draftKey,
  title,
  content,
  enabled,
  dirty,
  sourceUpdatedAt,
}: NoteDraftPersistenceOptions) {
  const latestRef = useRef({ title, content, enabled, dirty, sourceUpdatedAt });
  const discardedRef = useRef(false);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    latestRef.current = { title, content, enabled, dirty, sourceUpdatedAt };
  }, [content, dirty, enabled, sourceUpdatedAt, title]);

  const flushDraft = useCallback(async () => {
    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
      writeTimerRef.current = undefined;
    }

    const latest = latestRef.current;
    if (!latest.enabled || !latest.dirty || discardedRef.current) return;

    if (!latest.title.trim() && !hasMeaningfulRichContent(latest.content)) {
      await removeNoteDraft(draftKey);
      return;
    }

    await writeNoteDraft(draftKey, {
      title: latest.title,
      content: latest.content,
      sourceUpdatedAt: latest.sourceUpdatedAt,
    });
  }, [draftKey]);

  const discardDraft = useCallback(async () => {
    discardedRef.current = true;
    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
      writeTimerRef.current = undefined;
    }
    await removeNoteDraft(draftKey);
  }, [draftKey]);

  useEffect(() => {
    if (!enabled || !dirty || discardedRef.current) return;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      void flushDraft();
    }, DRAFT_WRITE_DELAY_MS);

    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = undefined;
      }
    };
  }, [content, dirty, enabled, flushDraft, title]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        void flushDraft();
      }
    });

    return () => subscription.remove();
  }, [flushDraft]);

  useEffect(
    () => () => {
      void flushDraft();
    },
    [flushDraft]
  );

  return { flushDraft, discardDraft };
}
