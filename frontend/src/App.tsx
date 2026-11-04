import { Route, Routes } from 'react-router';
import { AdminPage } from './pages/AdminPage';
import { BookingPage } from './pages/BookingPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route element={<BookingPage />} path="/booking" />
      <Route element={<AdminPage />} path="/admin" />
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}
