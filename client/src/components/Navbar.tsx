import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { getUser, clearAuth, isLoggedIn, isAdmin } from '../lib/auth';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const loggedIn = isLoggedIn();
  const admin = isAdmin();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  function handleLogout() {
    clearAuth();
    setProfileMenuOpen(false);
    navigate('/login');
  }

  function navLinkClass(path: string) {
    return `nav-tab ${location.pathname.startsWith(path) ? 'active' : ''}`;
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <Link to="/board" className="navbar-brand">
          Hy<span>Q</span>
        </Link>
        {loggedIn && (
          <div className="profile-menu-wrap" ref={profileMenuRef}>
            <button
              type="button"
              className={`profile-menu-trigger ${profileMenuOpen ? 'open' : ''}`}
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
            >
              <span className="profile-menu-avatar">{(user?.real_name || user?.username || '?')[0].toUpperCase()}</span>
              <span className="profile-menu-name">{user?.real_name || user?.username}</span>
              <span className="profile-menu-chevron" aria-hidden="true">⌄</span>
            </button>
            {profileMenuOpen && (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-heading">
                  <span className="profile-menu-eyebrow">Your workspace</span>
                  <strong>{user?.real_name || user?.username}</strong>
                </div>
                <Link to="/profile" role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                  <span aria-hidden="true">◯</span>
                  My Profile
                </Link>
                <Link to="/questions" role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                  <span aria-hidden="true">✉</span>
                  문의 게시판
                </Link>
                {admin && (
                  <Link to="/admin" role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                    <span aria-hidden="true">⚙</span>
                    Admin
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {loggedIn && (
        <div className="nav-tabs">
          <Link to="/board" className={navLinkClass('/board')}>
            Board
          </Link>
        </div>
      )}
      <div className="navbar-links">
        {loggedIn ? (
          <>
            {!admin && (
              <Link to="/ask" className="btn btn-primary btn-sm">
                + Ask
              </Link>
            )}
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
