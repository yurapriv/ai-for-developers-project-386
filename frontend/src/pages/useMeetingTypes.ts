import { useCallback, useEffect, useRef, useState } from 'react';
import { loadMeetingTypes } from '../api/meetingTypes';
import type { MeetingType } from '../api/meetingTypes';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; meetingTypes: MeetingType[] };

export function useMeetingTypes() {
  const [catalogState, setCatalogState] = useState<CatalogState>({ kind: 'loading' });
  const sequence = useRef(0);
  const fetchCatalog = useCallback(async () => {
    const request = ++sequence.current;
    const result = await loadMeetingTypes();
    if (request !== sequence.current) return;
    setCatalogState(
      result.ok ? { kind: 'ready', meetingTypes: result.meetingTypes } : { kind: 'error' },
    );
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogState({ kind: 'loading' });
    await fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    const counter = sequence;
    void fetchCatalog();
    return () => {
      counter.current++;
    };
  }, [fetchCatalog]);

  return { catalogState, loadCatalog };
}
