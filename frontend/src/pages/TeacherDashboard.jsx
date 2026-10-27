import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePopup } from '../context/PopupContext';
import { API_BASE_URL } from '../config';

export default function TeacherDashboard() {
  const { user, token } = useAuth();
  const { showConfirm, showToast } = usePopup();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  const fetchQuizzes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/teacher`, {
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
    fetchQuizzes();
  }, []);

  const handleCloseQuiz = async (quizId, quizTitle) => {
    const confirmed = await showConfirm({
      title: 'Stop / Close Quiz',
      message: `Close "${quizTitle}" now? Students will immediately view scores and submissions will stop.`,
      confirmText: 'Stop Quiz',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/${quizId}/close`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to close quiz.');
      }
      showToast('Quiz has been stopped and closed.', 'success');
      fetchQuizzes();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const activeQuizzes = quizzes.filter(q => q.effective_status === 'open');
  const pastQuizzes = quizzes.filter(q => q.effective_status === 'closed');
  const displayedQuizzes = activeTab === 'active' ? activeQuizzes : pastQuizzes;

  return (
    <div className="container">
      {/* Hero Header */}
      <div className="hero-banner">
        <div className="hero-content">
          <div className="hero-tag">Teacher Workspace</div>
          <h1 className="hero-title">Welcome back, {user?.name?.split(' ')[0] || 'Professor'}</h1>
          <p className="hero-subtitle">Create, monitor, and evaluate student assessments.</p>
        </div>
        <div className="hero-actions">
          <Link to="/teacher/create-quiz" className="btn btn-primary btn-glow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Create Quiz</span>
            <span className="badge-sparkle">✨ AI Scan</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div>
            <div className="stat-value">{quizzes.length}</div>
            <div className="stat-label">Total Quizzes</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div>
            <div className="stat-value">{activeQuizzes.length}</div>
            <div className="stat-label">Active Now</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div>
            <div className="stat-value">{pastQuizzes.length}</div>
            <div className="stat-label">Evaluated / Expired</div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-item ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Quizzes ({activeQuizzes.length})
        </button>
        <button
          className={`tab-item ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          Closed / Past ({pastQuizzes.length})
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading quizzes...</span>
        </div>
      ) : displayedQuizzes.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon">📝</div>
          <h3>{activeTab === 'active' ? 'No Active Quizzes' : 'No Closed Quizzes'}</h3>
          <p className="empty-desc">
            {activeTab === 'active'
              ? 'Create a quiz manually or upload a PDF to generate MCQs with AI.'
              : 'Past closed quizzes will appear here for grading history.'}
          </p>
          {activeTab === 'active' && (
            <Link to="/teacher/create-quiz" className="btn btn-primary mt-15">
              Create First Quiz
            </Link>
          )}
        </div>
      ) : (
        <div className="grid-cards">
          {displayedQuizzes.map((quiz) => {
            const isOpen = quiz.effective_status === 'open';

            return (
              <div key={quiz.id} className="quiz-card-elevated">
                <div>
                  <div className="quiz-card-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`status-pill ${isOpen ? 'pill-active' : 'pill-closed'}`}>
                        {isOpen ? '● Open' : '✓ Closed'}
                      </span>
                      {quiz.is_expired && (
                        <span className="pill-metric text-danger font-bold">Expired</span>
                      )}
                    </div>
                    <span className="pill-metric">{quiz.total_questions} Questions</span>
                  </div>

                  <h3 className="quiz-card-title">{quiz.title}</h3>
                  {quiz.description && <p className="quiz-card-desc">{quiz.description}</p>}

                  {/* Deadline & Policy Chips */}
                  <div className="quiz-meta-chips mb-10">
                    {quiz.end_date && (
                      <span className="chip-badge chip-deadline">
                        ⏳ Due: {new Date(quiz.end_date).toLocaleDateString()}
                      </span>
                    )}
                    <span className="chip-badge">
                      {quiz.results_policy === 'immediate_full' ? '⚡ Instant Review' : quiz.results_policy === 'immediate_score_only' ? '📊 Instant Score' : '🔒 On Close'}
                    </span>
                  </div>
                </div>

                <div className="quiz-card-foot">
                  <span className="quiz-card-date">
                    {quiz.total_attempts} attempt{quiz.total_attempts !== 1 ? 's' : ''}
                  </span>
                  <div className="action-buttons-group">
                    <Link
                      to={`/teacher/quiz/${quiz.id}/analytics`}
                      className="btn-card-action btn-card-primary"
                      title="View score graphs, leaderboard, and question stats"
                    >
                      📊 Analytics
                    </Link>
                    <Link
                      to={`/teacher/quiz/${quiz.id}/submissions`}
                      className="btn-card-action btn-card-secondary"
                      title="View student submissions"
                    >
                      Results
                    </Link>
                    {isOpen && (
                      <button
                        onClick={() => handleCloseQuiz(quiz.id, quiz.title)}
                        className="btn-card-action btn-card-danger"
                        title="Stop quiz and release scores"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
