import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';

export function MainLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const isRepertoireEdit = /^\/repertoire\/[^/]+\/edit/.test(location.pathname);

  return (
    <div className="min-h-screen flex flex-row max-md:flex-col">
      <aside className="flex flex-col w-[200px] shrink-0 py-6 px-4 bg-bg-card border-r border-border h-screen sticky top-0 max-md:w-full max-md:h-auto max-md:static max-md:flex-row max-md:items-center max-md:py-2 max-md:px-4 max-md:border-r-0 max-md:border-b max-md:border-border">
        <h1 className="text-2xl font-bold text-text mb-6 px-2 max-md:mb-0 max-md:mr-4 max-md:text-xl">TreeChess</h1>
        <nav className="flex flex-col gap-1 max-md:flex-row max-md:gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `block py-2 px-4 font-medium text-base text-text-muted no-underline text-left w-full border-l-3 border-transparent rounded-r-md transition-all duration-150 hover:text-text hover:bg-bg hover:no-underline max-md:border-l-0 max-md:rounded-md max-md:py-1 max-md:px-2 max-md:text-sm ${
                isActive ? 'text-primary bg-primary-light border-l-primary max-md:border-l-transparent' : ''
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/repertoires"
            className={({ isActive }) =>
              `block py-2 px-4 font-medium text-base text-text-muted no-underline text-left w-full border-l-3 border-transparent rounded-r-md transition-all duration-150 hover:text-text hover:bg-bg hover:no-underline max-md:border-l-0 max-md:rounded-md max-md:py-1 max-md:px-2 max-md:text-sm ${
                isActive ? 'text-primary bg-primary-light border-l-primary max-md:border-l-transparent' : ''
              }`
            }
          >
            Repertoires
          </NavLink>
          <NavLink
            to="/games"
            className={({ isActive }) =>
              `block py-2 px-4 font-medium text-base text-text-muted no-underline text-left w-full border-l-3 border-transparent rounded-r-md transition-all duration-150 hover:text-text hover:bg-bg hover:no-underline max-md:border-l-0 max-md:rounded-md max-md:py-1 max-md:px-2 max-md:text-sm ${
                isActive ? 'text-primary bg-primary-light border-l-primary max-md:border-l-transparent' : ''
              }`
            }
          >
            Games
          </NavLink>
        </nav>
        <div className="flex-1" />
        <div className="flex flex-col gap-2 max-md:flex-row max-md:items-center">
          {user && <span className="text-sm text-text-muted font-medium">{user.username}</span>}
          <button
            className="py-1 px-2 bg-transparent border border-border rounded-sm text-text-muted text-[0.8125rem] cursor-pointer font-sans transition-all duration-150 hover:border-danger hover:text-danger"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className={`flex-1 min-w-0 h-screen overflow-y-auto ${isRepertoireEdit ? 'p-0 overflow-hidden' : 'p-6'}`}>
        <Outlet />
      </main>
    </div>
  );
}
