import { Link } from 'react-router';

export function HomePage() {
  return (
    <main>
      <h1>Календарь встреч</h1>
      <p>Выберите удобное время и запишитесь онлайн</p>
      <div className="actions">
        <Link className="action action-primary" to="/booking">
          Записаться
        </Link>
        <Link className="action action-secondary" to="/admin">
          Админка
        </Link>
      </div>
    </main>
  );
}
