import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, GraduationCap, User, ChevronLeft, ChevronRight, Compass } from 'lucide-react';

function PawnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="7" r="3" />
      <path d="M10 10c-2 2-3 4-3 7h10c0-3-1-5-3-7" />
      <path d="M7 20h10" />
    </svg>
  );
}

import { useAuthStore } from '../../../stores/authStore';

const SIDEBAR_COLLAPSED_KEY = 'kumquat-sidebar-collapsed';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/repertoires', label: 'Repertoires', Icon: BookOpen, end: false },
  { to: '/explore', label: 'Explore', Icon: Compass, end: false },
  { to: '/training', label: 'Training', Icon: GraduationCap, end: false },
  { to: '/games', label: 'Games', Icon: PawnIcon, end: false },
] as const;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function MainLayout() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isRepertoireEdit = /^\/repertoire\/[^/]+\/edit/.test(location.pathname) || /^\/explore\/repertoire\/[^/]+/.test(location.pathname);

  // Responsive breakpoints
  const isXl = useMediaQuery('(min-width: 1280px)');
  const isLg = useMediaQuery('(min-width: 1024px)');
  // Below lg => show bottom tab bar

  // User preference for collapsed state (persisted)
  const [userCollapsed, setUserCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setUserCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Effective collapsed state:
  // - xl: respect user preference
  // - lg (1024-1279): always collapsed
  // - below lg: sidebar hidden (bottom tabs shown)
  const isCollapsed = isXl ? userCollapsed : true;
  const showSidebar = isLg; // lg and above
  const showBottomTabs = !isLg; // below lg

  const sidebarWidth = isCollapsed ? 'w-[60px]' : 'w-[220px]';

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className="min-h-screen flex flex-row">
      {/* Desktop/Tablet Sidebar */}
      {showSidebar && (
        <aside
          className={`flex flex-col ${sidebarWidth} shrink-0 py-6 bg-bg-sidebar border-r border-primary/10 h-screen sticky top-0 transition-all duration-200 overflow-hidden`}
        >
          {/* Logo */}
          <div className={`flex items-center mb-6 ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg shadow-md shadow-primary/20 shrink-0 overflow-hidden">
                <img 
                  src="/logo.png" 
                  alt="Kumquat" 
                  className="w-full h-full object-cover"
                />
              </div>
              {!isCollapsed && (
                <span className="text-xl font-bold text-text tracking-tight font-display whitespace-nowrap">
                  Kumquat
                </span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1 px-2">
            {navItems.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 font-medium text-sm text-text-muted no-underline rounded-xl transition-all duration-150 hover:text-text hover:bg-primary-light/50 hover:no-underline ${
                    isCollapsed
                      ? 'justify-center py-3 px-0'
                      : 'py-2.5 px-3'
                  } ${
                    isActive
                      ? 'text-primary bg-primary-light'
                      : ''
                  }`
                }
                title={isCollapsed ? label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap">{label}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Collapse toggle (only on xl where user can control it) */}
          {isXl && (
            <button
              onClick={toggleCollapsed}
              className={`flex items-center justify-center py-2 text-text-muted hover:text-text hover:bg-primary-light/50 transition-all duration-150 cursor-pointer bg-transparent border-0 rounded-xl mx-2`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}

          {/* User section */}
          <div className={`flex flex-col gap-2 border-t border-primary/10 pt-4 mt-2 ${isCollapsed ? 'items-center px-2' : 'px-3'}`}>
            {user && (
              <button
                onClick={() => navigate('/profile')}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} bg-transparent border-0 rounded-xl cursor-pointer p-1.5 transition-all duration-150 hover:bg-primary-light/50 ${
                  location.pathname === '/profile' ? 'bg-primary-light' : ''
                }`}
                title={isCollapsed ? user.username : 'Profile'}
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-hover text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                  {initials}
                </div>
                {!isCollapsed && (
                  <span className={`text-sm font-medium truncate ${location.pathname === '/profile' ? 'text-primary' : 'text-text-muted'}`}>{user.username}</span>
                )}
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main
        className={`flex-1 min-w-0 h-screen overflow-y-auto bg-bg ${
          isRepertoireEdit
            ? 'p-0 overflow-hidden'
            : showBottomTabs
              ? 'p-4 pb-20'
              : 'p-6'
        }`}
      >
        <Outlet />
      </main>

      {/* Mobile Bottom Tab Bar */}
      {showBottomTabs && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around bg-bg-card/80 backdrop-blur-sm border-t border-primary/10 h-14">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 gap-0.5 text-xs font-medium no-underline transition-colors duration-150 ${
                  isActive
                    ? 'text-primary'
                    : 'text-text-muted hover:text-text'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 gap-0.5 text-xs font-medium no-underline transition-colors duration-150 ${
                isActive
                  ? 'text-primary'
                  : 'text-text-muted hover:text-text'
              }`
            }
          >
            <User className="w-5 h-5" />
            <span>Profile</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
}
