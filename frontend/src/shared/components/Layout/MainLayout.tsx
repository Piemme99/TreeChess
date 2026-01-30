import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';

export function MainLayout() {
  const { user, logout } = useAuthStore();

  return (
    <div className="main-layout">
      <aside className="main-sidebar">
        <h1 className="main-logo">TreeChess</h1>
        <nav className="main-tabs">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `main-tab${isActive ? ' active' : ''}`}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/repertoires"
            className={({ isActive }) => `main-tab${isActive ? ' active' : ''}`}
          >
            Repertoires
          </NavLink>
          <NavLink
            to="/games"
            className={({ isActive }) => `main-tab${isActive ? ' active' : ''}`}
          >
            Games
          </NavLink>
        </nav>
        <div className="sidebar-spacer" />
        <div className="header-user">
          {user && <span className="header-username">{user.username}</span>}
          <button className="header-logout" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
