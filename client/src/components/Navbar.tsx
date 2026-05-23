import { Link, useNavigate } from 'react-router-dom';
import { getUser, clearAuth, isLoggedIn } from '../lib/auth';

export default function Navbar() {
  const navigate = useNavigate();
  const user = getUser();
  const loggedIn = isLoggedIn();

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <Link to="/questions" className="navbar-brand">
        Study<span>Q</span>
      </Link>
      <div className="navbar-links">
        {loggedIn ? (
          <>
            <Link to="/ask" className="btn btn-primary btn-sm">
              + Ask
            </Link>
            <Link to="/profile" className="btn btn-ghost btn-sm">
              {user?.username}
            </Link>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">
              Login
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
