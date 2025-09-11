import { useTranslation } from 'react-i18next';
import { Routes, Route, Link } from 'react-router-dom';
import Dashboard from '../features/dashboard/Dashboard';
import '../libs/i18n';
import { useTheme } from '../hooks/useTheme';

export default function App() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const toggleLang = () => i18n.changeLanguage(i18n.language === 'en' ? 'id' : 'en');
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="p-4 flex justify-between">
        <nav className="space-x-4">
          <Link to="/">{t('dashboard')}</Link>
        </nav>
        <div className="space-x-2">
          <button onClick={toggleTheme} className="px-2 py-1 border rounded">
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button onClick={toggleLang} className="px-2 py-1 border rounded">
            {i18n.language.toUpperCase()}
          </button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </div>
  );
}
