import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getUser, clearAuth, isLoggedIn, isAdmin } from '../lib/auth';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const loggedIn = isLoggedIn();
  const admin = isAdmin();

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  function navLinkClass(path: string) {
    return `nav-tab ${location.pathname.startsWith(path) ? 'active' : ''}`;
  }

  return (
    <nav className="navbar">
      <Link to="/questions" className="navbar-brand">
        Hy<span>Q</span>
      </Link>
      {loggedIn && (
        <div className="nav-tabs">
          <Link to="/questions" className={navLinkClass('/questions')}>
            {admin ? 'Conversations' : 'My Q&A'}
          </Link>
          <Link to="/board" className={navLinkClass('/board')}>
            Board
          </Link>
          {admin && (
            <Link to="/admin" className={navLinkClass('/admin')}>
              Admin
            </Link>
          )}
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
            <Link to="/profile" className="btn btn-ghost btn-sm">
              {user?.real_name || user?.username}
            </Link>
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
