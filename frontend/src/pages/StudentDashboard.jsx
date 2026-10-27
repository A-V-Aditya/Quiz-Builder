import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

export default function StudentDashboard() {
  const { user, token } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAvailableQuizzes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/available`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch quizzes.');
      }
      setQuizzes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableQuizzes();
  }, []);

  return (
    <div className="container">
      {/* Hero Banner */}
      <div className="hero-banner">
        <div className="hero-content">
          <div className="hero-tag">Student Portal</div>
          <h1 className="hero-title">Ready for your test, {user?.name?.split(' ')[0] || 'Student'}?</h1>
          <p className="hero-subtitle">Attempt active quizzes or review past scores.</p>
        </div>
        <div className="hero-actions">
          <Link to="/student/history" className="btn btn-secondary btn-frost">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20v-6M6 20V10M18 20V4"></path>
            </svg>
            <span>My Scores</span>
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Available Quizzes Header */}
      <div className="section-head">
        <div>
          <h2 className="section-title">Open Quizzes</h2>
          <span className="section-count">{quizzes.length} ready to attempt</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading available quizzes...</span>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon">🎯</div>
          <h3>No Quizzes Available</h3>
          <p className="empty-desc">You are all caught up! Check back when your teacher publishes a new test.</p>
          <Link to="/student/history" className="btn btn-primary mt-15">
            Review Past Scores
          </Link>
        </div>
      ) : (
        <div className="grid-cards">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="quiz-card-elevated">
              <div>
                <div className="quiz-card-head">
                  <span className="status-pill pill-active">● Active</span>
                  <span className="pill-metric">{quiz.total_questions} Questions</span>
                </div>

                <h3 className="quiz-card-title">{quiz.title}</h3>
                {quiz.description && <p className="quiz-card-desc">{quiz.description}</p>}

                {quiz.end_date && (
                  <div className="mb-10">
                    <span className="chip-badge chip-deadline">
                      ⏳ Due: {new Date(quiz.end_date).toLocaleDateString()} {new Date(quiz.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}

                <div className="quiz-instructor-info">
                  <div className="mini-avatar">{quiz.teacher_name?.charAt(0) || 'T'}</div>
                  <div>
                    <div className="instructor-name">{quiz.teacher_name}</div>
                    <div className="instructor-label">Instructor</div>
                  </div>
                </div>
              </div>

              <div className="quiz-card-foot mt-15">
                <Link to={`/student/quiz/${quiz.id}`} className="btn btn-primary btn-block">
                  <span>Start Quiz</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
