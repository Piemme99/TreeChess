import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';

const SIDEBAR_COLLAPSED_KEY = 'treechess-sidebar-collapsed';

function DashboardIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function RepertoiresIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="13" y2="11" />
    </svg>
  );
}

function GamesIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L15 8H9L12 2Z" />
      <circle cx="12" cy="14" r="4" />
      <path d="M8 22h8" />
      <path d="M12 18v4" />
    </svg>
  );
}

function ProfileIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

function LogoutIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function CollapseIcon({ collapsed, className = 'w-4 h-4' }: { collapsed: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {collapsed ? (
        <polyline points="9 18 15 12 9 6" />
      ) : (
        <polyline points="15 18 9 12 15 6" />
      )}
    </svg>
  );
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', Icon: DashboardIcon, end: true },
  { to: '/repertoires', label: 'Repertoires', Icon: RepertoiresIcon, end: false },
  { to: '/games', label: 'Games', Icon: GamesIcon, end: false },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon, end: false },
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
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const isRepertoireEdit = /^\/repertoire\/[^/]+\/edit/.test(location.pathname);

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
          className={`flex flex-col ${sidebarWidth} shrink-0 py-6 bg-bg-sidebar border-r border-border h-screen sticky top-0 transition-all duration-200 overflow-hidden`}
        >
          {/* Logo */}
          <div className={`flex items-center mb-6 ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}>
            <h1 className="text-xl font-bold text-text whitespace-nowrap">
              {isCollapsed ? (
                <span className="text-primary">T</span>
              ) : (
                <>Tree<span className="text-primary">Chess</span></>
              )}
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1">
            {navItems.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 font-medium text-sm text-text-muted no-underline border-l-3 border-transparent transition-all duration-150 hover:text-text hover:bg-bg hover:no-underline ${
                    isCollapsed
                      ? 'justify-center py-3 px-0 rounded-none'
                      : 'py-2.5 px-4 rounded-r-md'
                  } ${
                    isActive
                      ? 'text-primary bg-primary-light border-l-primary'
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
              className={`flex items-center justify-center py-2 text-text-muted hover:text-text hover:bg-bg transition-all duration-150 cursor-pointer bg-transparent border-0 ${
                isCollapsed ? 'mx-auto' : 'mx-4'
              }`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <CollapseIcon collapsed={isCollapsed} />
            </button>
          )}

          {/* User section */}
          <div className={`flex flex-col gap-2 border-t border-border pt-4 mt-2 ${isCollapsed ? 'items-center px-2' : 'px-4'}`}>
            {user && (
              isCollapsed ? (
                <div
                  className="w-8 h-8 rounded-full bg-primary-light text-primary text-xs font-bold flex items-center justify-center"
                  title={user.username}
                >
                  {initials}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary-light text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <span className="text-sm text-text-muted font-medium truncate">{user.username}</span>
                </div>
              )
            )}
            <button
              className={`flex items-center justify-center gap-2 py-1.5 bg-transparent border border-border rounded-md text-text-muted text-xs cursor-pointer font-sans transition-all duration-150 hover:border-danger hover:text-danger ${
                isCollapsed ? 'px-1.5 w-8 h-8' : 'px-3'
              }`}
              onClick={logout}
              title="Logout"
            >
              <LogoutIcon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Logout</span>}
            </button>
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
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around bg-bg-card border-t border-border h-14">
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
          <button
            onClick={logout}
            className="flex flex-col items-center justify-center flex-1 gap-0.5 text-xs font-medium bg-transparent border-none cursor-pointer text-text-muted hover:text-danger transition-colors duration-150"
          >
            <LogoutIcon className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </nav>
      )}
    </div>
  );
}
