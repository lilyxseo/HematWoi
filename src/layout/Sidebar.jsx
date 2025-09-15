import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { NAV_ITEMS } from '../router/nav.config';
import Logo from '../components/Logo';
import SignIn from '../components/SignIn';
import { supabase } from '../lib/supabase';

export default function Sidebar({ theme, setTheme, useCloud, setUseCloud }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('hw:sidebar-collapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSessionUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('hw:sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const shortEmail = (email = '') =>
    email.length > 20 ? email.slice(0, 17) + '...' : email;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const primary = NAV_ITEMS.filter((i) => i.section === 'primary' && i.inSidebar);
  const secondary = NAV_ITEMS.filter((i) => i.section === 'secondary' && i.inSidebar);

  const content = (
    <div
      className={`flex flex-col h-full ${collapsed ? 'w-16' : 'w-64'} transition-all bg-white dark:bg-slate-900 shadow-md`}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          {!collapsed && <span className="font-bold">HematWoi</span>}
        </div>
        <button className="md:hidden" aria-label="Close" onClick={() => setMobileOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <hr className="border-slate-200 dark:border-slate-700" />
      <nav className="flex-1 overflow-y-auto" role="navigation">
        <ul className="p-2 space-y-1">
          {primary.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none ${
                    isActive ? 'text-blue-600 border-l-4 border-blue-600' : ''
                  }`
                }
                title={collapsed ? item.title : undefined}
                onClick={() => setMobileOpen(false)}
              >
                {item.icon}
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
        {secondary.length > 0 && (
          <ul className="p-2 mt-4 space-y-1">
            {secondary.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none ${
                      isActive ? 'text-blue-600 border-l-4 border-blue-600' : ''
                    }`
                  }
                  title={collapsed ? item.title : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.icon}
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
        <div className="flex items-center justify-between">
          {!collapsed && <span className="text-sm">All synced</span>}
        </div>
        <div className="flex items-center justify-between">
          {!collapsed && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useCloud}
                onChange={(e) => setUseCloud(e.target.checked)}
              />
              Cloud
            </label>
          )}
          {collapsed && (
            <button
              className="p-1"
              aria-label="Toggle cloud"
              onClick={() => setUseCloud(!useCloud)}
            >
              {useCloud ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <button
            className="p-1 rounded focus:outline-none"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {sessionUser ? (
            <button className="text-sm" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <button className="text-sm" onClick={() => setShowSignIn(true)}>
              Masuk
            </button>
          )}
        </div>
        {sessionUser && !collapsed && (
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {shortEmail(sessionUser.email)}
          </div>
        )}
      </div>
      <button
        className="absolute top-1/2 -right-3 hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 md:hidden ${mobileOpen ? 'block' : 'hidden'}`}
        onClick={() => setMobileOpen(false)}
      />
      <div
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed z-50 inset-y-0 left-0 md:static md:flex`}
      >
        {content}
      </div>
      <button
        className="md:hidden p-2"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu className="h-6 w-6" />
      </button>
      <SignIn open={showSignIn} onClose={() => setShowSignIn(false)} />
    </>
  );
}

