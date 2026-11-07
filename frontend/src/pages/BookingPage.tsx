import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { durationText, loadMeetingTypes } from '../api/meetingTypes';
import type { MeetingType } from '../api/meetingTypes';
import { createBooking, getAvailability, getBookingWindow } from '../api/generated';
import type { Booking, BookingWindow, Slot } from '../api/generated';
import { MeetingTypeCatalog } from './MeetingTypeCatalog';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; meetingTypes: MeetingType[] };

// A request can outlive the picker when the guest navigates away and back.
let bookingPending = false;
const pendingListeners = new Set<() => void>();
function setBookingPending(value: boolean) {
  bookingPending = value;
  pendingListeners.forEach((listener) => listener());
}
function subscribePending(listener: () => void) {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const pending = useSyncExternalStore(subscribePending, () => bookingPending);
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    let active = true;
    const request = day
      ? getAvailability({ query: { meetingTypeId: meetingType.id, day } })
      : getBookingWindow();
    void request
      .then(async (result) => {
        if (!active) return;
        if (!result.data) {
          if (day && result.response?.status === 422) {
            const current = await getBookingWindow();
            if (!active) return;
            if (current.data) {
              setWindow(current.data);
              setDay('');
              setSlots(null);
              setState('ready');
              return;
            }
          }
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot || bookingPending) return;
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const fields: Record<string, string> = {};
    if (!cleanName || [...cleanName].length > 100) fields.name = 'Введите имя от 1 до 100 символов';
    if ([...cleanEmail].length > 254 || !/^[^@\s]+@[^@\s]+$/u.test(cleanEmail))
      fields.email = 'Введите корректный email';
    setErrors(fields);
    if (Object.keys(fields).length) return;
    setBookingPending(true);
    setMessage('');
    try {
      const result = await createBooking({
        body: {
          meetingTypeId: meetingType.id,
          start: slot.start,
          name: cleanName,
          email: cleanEmail,
        },
      });
      if (result.data) {
        setBooking(result.data);
      } else if (result.response) {
        setMessage(result.error?.message ?? 'Не удалось создать запись');
        if (result.error?.fields)
          setErrors(
            Object.fromEntries(result.error.fields.map((field) => [field.field, field.message])),
          );
        if (
          result.response.status === 409 ||
          (result.response.status === 422 && result.error?.fields.length === 0)
        ) {
          setSlot(null);
          setSlots(null);
          setState('loading');
          setRetry((value) => value + 1);
        }
      } else {
        setMessage('Не удалось получить подтверждение записи');
      }
    } catch {
      setMessage('Не удалось получить подтверждение записи');
    } finally {
      setBookingPending(false);
    }
  }

  if (booking)
    return (
      <section>
        <h2>Запись подтверждена</h2>
        <p>
          {booking.meetingType.name},{' '}
          {new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(
            new Date(booking.start),
          )}
          , {time(booking.start)}–{time(booking.end)} (Europe/Moscow)
        </p>
        <p>
          {booking.name} · {booking.email}
        </p>
        <button type="button" onClick={onBack}>
          Создать ещё одну запись
        </button>
      </section>
    );

  return (
    <section>
      <button type="button" onClick={onBack} disabled={pending}>
        К типам встреч
      </button>
      <h2>{meetingType.name}</h2>
      <p>{durationText(meetingType.durationMinutes)} · Europe/Moscow</p>
      {window && (
        <label>
          День{' '}
          <select
            value={day}
            disabled={pending}
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
                disabled={pending}
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
        <>
          <p>
            Выбрано: {meetingType.name}, {durationText(meetingType.durationMinutes)}, {day},{' '}
            {time(slot.start)}–{time(slot.end)} (Europe/Moscow)
          </p>
          <form onSubmit={(event) => void submit(event)} noValidate>
            <label>
              Имя{' '}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={!!errors.name}
              />
            </label>
            {errors.name && <p role="alert">{errors.name}</p>}
            <label>
              Email{' '}
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={!!errors.email}
              />
            </label>
            {errors.email && <p role="alert">{errors.email}</p>}
            <button type="submit" disabled={pending}>
              {pending ? 'Отправка…' : 'Записаться'}
            </button>
          </form>
        </>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
