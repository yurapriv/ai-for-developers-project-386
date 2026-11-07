import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { durationText, loadMeetingTypes } from '../api/meetingTypes';
import type { MeetingType } from '../api/meetingTypes';
import { getAvailability, getBookingWindow } from '../api/generated';
import type { BookingWindow, Slot } from '../api/generated';
import { MeetingTypeCatalog } from './MeetingTypeCatalog';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; meetingTypes: MeetingType[] };

export function BookingPage() {
  const [catalogState, setCatalogState] = useState<CatalogState>({ kind: 'loading' });
  const [selected, setSelected] = useState<MeetingType | null>(null);

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
      {selected ? (
        <SlotPicker meetingType={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
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
              <MeetingTypeCatalog meetingTypes={catalogState.meetingTypes} onSelect={setSelected} />
            ))}
        </>
      )}
      <Link to="/">На главную</Link>
    </main>
  );
}

function SlotPicker({ meetingType, onBack }: { meetingType: MeetingType; onBack: () => void }) {
  const [window, setWindow] = useState<BookingWindow | null>(null);
  const [day, setDay] = useState('');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const request = day
      ? getAvailability({ query: { meetingTypeId: meetingType.id, day } })
      : getBookingWindow();
    void request
      .then((result) => {
        if (!active) return;
        if (!result.data) {
          setState('error');
          return;
        }
        if ('slots' in result.data) {
          setWindow(result.data.window);
          setSlots(result.data.slots);
        } else {
          setWindow(result.data);
        }
        setState('ready');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [meetingType.id, day, retry]);

  const days = window
    ? Array.from({ length: 14 }, (_, index) => {
        const date = new Date(`${window.firstDay}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + index);
        return date.toISOString().slice(0, 10);
      })
    : [];
  const time = (value: string) =>
    new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));

  return (
    <section>
      <button type="button" onClick={onBack}>
        К типам встреч
      </button>
      <h2>{meetingType.name}</h2>
      <p>{durationText(meetingType.durationMinutes)} · Europe/Moscow</p>
      {window && (
        <label>
          День{' '}
          <select
            value={day}
            onChange={(event) => {
              setDay(event.target.value);
              setState('loading');
              setSlot(null);
              setSlots(null);
            }}
          >
            <option value="">Выберите день</option>
            {days.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      )}
      {state === 'loading' && <output>Загрузка доступности…</output>}
      {state === 'error' && (
        <div>
          <p role="alert">Не удалось загрузить доступность</p>
          <button
            type="button"
            onClick={() => {
              setState('loading');
              setRetry(retry + 1);
            }}
          >
            Повторить
          </button>
        </div>
      )}
      {state === 'ready' &&
        slots &&
        (slots.length ? (
          <div>
            <h3>Свободное время</h3>
            {slots.map((item) => (
              <button
                type="button"
                key={item.start}
                aria-pressed={slot?.start === item.start}
                onClick={() => setSlot(item)}
              >
                {time(item.start)}–{time(item.end)}
              </button>
            ))}
          </div>
        ) : (
          <p>На этот день свободного времени нет</p>
        ))}
      {slot && (
        <p>
          Выбрано: {meetingType.name}, {durationText(meetingType.durationMinutes)}, {day},{' '}
          {time(slot.start)}–{time(slot.end)} (Europe/Moscow)
        </p>
      )}
    </section>
  );
}
