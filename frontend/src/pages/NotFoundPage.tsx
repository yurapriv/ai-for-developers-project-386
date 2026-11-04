import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main>
      <h1>Страница не найдена</h1>
      <p>Такой страницы нет. Проверьте адрес или вернитесь на главную.</p>
      <Link to="/">На главную</Link>
    </main>
  );
}
