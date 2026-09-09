import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, isTeacher, isStudent, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          Quiz Builder
        </Link>

        <div className="nav-links">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link">Register</Link>
            </>
          ) : (
            <>
              {isTeacher && (
                <>
                  <Link to="/teacher/dashboard" className="nav-link">My Quizzes</Link>
                  <Link to="/teacher/create-quiz" className="nav-link btn-link">+ Create Quiz</Link>
                </>
              )}

              {isStudent && (
                <>
                  <Link to="/student/dashboard" className="nav-link">Available Quizzes</Link>
                  <Link to="/student/history" className="nav-link">My Attempts & Scores</Link>
                </>
              )}

              <div className="user-info">
                <span className="user-name">
                  {user.name} <span className="role-tag">({user.role})</span>
                </span>
                <button onClick={handleLogout} className="btn-logout">
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
