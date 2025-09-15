import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { NAV_ITEMS } from '../router/nav.config';
import Logo from '../components/Logo';
import SignIn from '../components/SignIn';
import { supabase } from '../lib/supabase';

const PRESETS = [
  { name: 'Blue', h: 211, s: 92, l: 60 },
  { name: 'Teal', h: 174, s: 70, l: 50 },
  { name: 'Violet', h: 262, s: 83, l: 67 },
  { name: 'Amber', h: 38, s: 92, l: 50 },
  { name: 'Rose', h: 347, s: 77, l: 60 },
];

function hslToHex({ h, s, l }) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function hexToHsl(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export default function Sidebar({ theme, setTheme, brand, setBrand, useCloud, setUseCloud }) {
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
      className={`flex flex-col h-full ${collapsed ? 'w-16' : 'w-64'} transition-all bg-surface-1 text-text shadow-md`}
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
      <hr className="border-border" />
      <nav className="flex-1 overflow-y-auto" role="navigation">
        <ul className="p-2 space-y-1">
          {primary.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-2 focus:outline-none ${
                    isActive ? 'text-brand border-l-4 border-brand' : ''
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
                    `flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-2 focus:outline-none ${
                      isActive ? 'text-brand border-l-4 border-brand' : ''
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
      <div className="p-4 border-t border-border space-y-4">
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
        <div className="space-y-2">
          {!collapsed && <span className="text-sm">Theme</span>}
          <div className="flex items-center gap-2">
            <button
              className={`p-1 rounded ${theme === 'light' ? 'ring-2 ring-brand' : ''}`}
              onClick={() => setTheme('light')}
              aria-label="Light mode"
            >
              <Sun className="h-4 w-4" />
            </button>
            <button
              className={`p-1 rounded ${theme === 'dark' ? 'ring-2 ring-brand' : ''}`}
              onClick={() => setTheme('dark')}
              aria-label="Dark mode"
            >
              <Moon className="h-4 w-4" />
            </button>
            <button
              className={`p-1 rounded ${theme === 'system' ? 'ring-2 ring-brand' : ''}`}
              onClick={() => setTheme('system')}
              aria-label="System mode"
            >
              <Monitor className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {!collapsed && <span className="text-sm">Brand</span>}
          <div className="flex items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                className={`w-5 h-5 rounded-full border ${p.h === brand.h && p.s === brand.s && p.l === brand.l ? 'ring-2 ring-brand' : ''}`}
                style={{ backgroundColor: `hsl(${p.h} ${p.s}% ${p.l}%)` }}
                onClick={() => setBrand({ h: p.h, s: p.s, l: p.l })}
                aria-label={p.name}
              />
            ))}
            <input
              type="color"
              aria-label="Custom brand color"
              value={hslToHex(brand)}
              onChange={(e) => setBrand(hexToHsl(e.target.value))}
              className="w-5 h-5 p-0 border rounded"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
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
          <div className="text-xs text-muted">
            {shortEmail(sessionUser.email)}
          </div>
        )}
      </div>
      <button
        className="absolute top-1/2 -right-3 hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-surface-1 border border-border"
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

