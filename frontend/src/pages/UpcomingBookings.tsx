import { useEffect, useState } from 'react';
import { listUpcomingBookings } from '../api/generated';
import type { Booking } from '../api/generated';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; bookings: Booking[] };

const time = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
});
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function UpcomingBookings() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void listUpcomingBookings()
      .then((result) => {
        if (active)
          setState(
            result.data !== undefined
              ? { kind: 'ready', bookings: result.data }
              : { kind: 'error' },
          );
      })
      .catch(() => {
        if (active) setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, [revision]);

  function refresh() {
    setState({ kind: 'loading' });
    setRevision((value) => value + 1);
  }

  return (
    <section aria-labelledby="upcoming-heading">
      <h2 id="upcoming-heading">Предстоящие встречи</h2>
      <button type="button" onClick={refresh} disabled={state.kind === 'loading'}>
        Обновить список
      </button>
      {state.kind === 'loading' && <output>Загрузка встреч…</output>}
      {state.kind === 'error' && (
        <div className="failure">
          <p role="alert">Не удалось загрузить предстоящие встречи</p>
          <button type="button" onClick={refresh}>
            Повторить загрузку встреч
          </button>
        </div>
      )}
      {state.kind === 'ready' &&
        (state.bookings.length === 0 ? (
          <p>Предстоящих встреч пока нет</p>
        ) : (
          <ul className="upcoming-bookings">
            {state.bookings.map((booking) => (
              <li key={booking.start}>
                <p>
                  {booking.meetingType.name}, {date.format(new Date(booking.start))},{' '}
                  {time.format(new Date(booking.start))}–{time.format(new Date(booking.end))}{' '}
                  (Europe/Moscow)
                </p>
                <p>
                  {booking.name} · {booking.email}
                </p>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
