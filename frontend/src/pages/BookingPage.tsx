import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { loadMeetingTypes } from '../api/meetingTypes';
import type { MeetingType } from '../api/meetingTypes';
import { MeetingTypeCatalog } from './MeetingTypeCatalog';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; meetingTypes: MeetingType[] };

export function BookingPage() {
  const [catalogState, setCatalogState] = useState<CatalogState>({ kind: 'loading' });

  const loadCatalog = useCallback(async () => {
    const result = await loadMeetingTypes();
    if (result.ok) {
      setCatalogState({ kind: 'ready', meetingTypes: result.meetingTypes });
    } else {
      setCatalogState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    let subscribed = true;
    void loadMeetingTypes().then((result) => {
      if (subscribed) {
        if (result.ok) {
          setCatalogState({ kind: 'ready', meetingTypes: result.meetingTypes });
        } else {
          setCatalogState({ kind: 'error' });
        }
      }
    });
    return () => {
      subscribed = false;
    };
  }, []);

  return (
    <main>
      <h1>Запись на встречу</h1>
      <h2>Типы встреч</h2>
      {catalogState.kind === 'loading' && <output>Загрузка каталога…</output>}
      {catalogState.kind === 'error' && (
        <div className="failure">
          <p role="alert">Не удалось загрузить каталог типов встреч</p>
          <button
            type="button"
            onClick={() => {
              setCatalogState({ kind: 'loading' });
              void loadCatalog();
            }}
          >
            Повторить
          </button>
        </div>
      )}
      {catalogState.kind === 'ready' &&
        (catalogState.meetingTypes.length === 0 ? (
          <p>Пока нет доступных типов встреч</p>
        ) : (
          <MeetingTypeCatalog meetingTypes={catalogState.meetingTypes} />
        ))}
      <Link to="/">На главную</Link>
    </main>
  );
}
