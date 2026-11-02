import { useEffect, useState } from 'react';
import { getHealth } from './api/generated/sdk.gen';

type State = 'loading' | 'ready' | 'error';

export function App() {
  const [state, setState] = useState<State>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void getHealth({
      baseUrl: window.location.origin,
      signal: controller.signal,
      throwOnError: true,
    })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setState(data.status === 'ok' ? 'ready' : 'error');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <main>
      <p className="eyebrow">Учебный проект · каркас приложения</p>
      <h1>Запись на звонок</h1>
      <p>Проверяем соединение интерфейса с Go-сервером через сгенерированный API-клиент.</p>
      <section aria-labelledby="status-title">
        <h2 id="status-title">Состояние сервиса</h2>
        <output aria-live="polite">
          {state === 'loading' && 'Проверяем соединение…'}
          {state === 'ready' && 'Сервер доступен · status: ok'}
          {state === 'error' && 'Не удалось связаться с сервером. Проверьте, что бекенд запущен.'}
        </output>
        <button
          type="button"
          disabled={state === 'loading'}
          onClick={() => {
            setState('loading');
            setAttempt((value) => value + 1);
          }}
        >
          Проверить снова
        </button>
      </section>
      <p className="note">Бронирование встреч появится на следующих этапах проекта.</p>
    </main>
  );
}
