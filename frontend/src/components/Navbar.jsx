import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, isTeacher, isStudent, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="brand-text">
            Quiz<span className="brand-highlight">Flow</span>
          </span>
        </Link>

        <div className="nav-links">
          {!isAuthenticated ? (
            <div className="auth-nav-group">
              <Link to="/login" className={`nav-link ${isActive('/login') ? 'active' : ''}`}>
                Sign In
              </Link>
              <Link to="/register" className="btn btn-nav-cta">
                Get Started
              </Link>
            </div>
          ) : (
            <>
              <div className="nav-menu">
                {isTeacher && (
                  <>
                    <Link
                      to="/teacher/dashboard"
                      className={`nav-link ${isActive('/teacher/dashboard') ? 'active' : ''}`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/teacher/create-quiz"
                      className="nav-link-cta"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      New Quiz
                    </Link>
                  </>
                )}

                {isStudent && (
                  <>
                    <Link
                      to="/student/dashboard"
                      className={`nav-link ${isActive('/student/dashboard') ? 'active' : ''}`}
                    >
                      Quizzes
                    </Link>
                    <Link
                      to="/student/history"
                      className={`nav-link ${isActive('/student/history') ? 'active' : ''}`}
                    >
                      My Scores
                    </Link>
                  </>
                )}
              </div>

              <div className="user-profile-badge">
                <div className="user-avatar">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="user-details">
                  <span className="user-name">{user?.name}</span>
                  <span className={`role-chip role-${user?.role}`}>
                    {user?.role}
                  </span>
                </div>
                <button onClick={handleLogout} className="btn-logout" title="Sign Out">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
