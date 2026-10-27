import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePopup } from '../context/PopupContext';
import { API_BASE_URL } from '../config';

export default function StudentHistory() {
  const { token } = useAuth();
  const { showToast } = usePopup();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [reviewDetails, setReviewDetails] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchAttempts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/attempts/student`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch attempts.');
      }
      setAttempts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, []);

  const handleViewReview = async (attemptId) => {
    setSelectedAttempt(attemptId);
    setReviewLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/attempts/detail/${attemptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load details.');
      }
      setReviewDetails(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Back button */}
      <div className="mb-15">
        <Link to="/student/dashboard" className="nav-back-link">
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <span className="section-badge">Student Records</span>
          <h1 className="page-title">My Attempts & Scores</h1>
          <p className="page-subtitle">Track your attempted tests, published scores, and solutions.</p>
        </div>
        <div>
          <Link to="/student/dashboard" className="btn btn-secondary">
            &larr; Available Quizzes
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading scorecards...</span>
        </div>
      ) : attempts.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon">📊</div>
          <h3>No Attempts Found</h3>
          <p className="empty-desc">You have not taken any quizzes yet.</p>
          <Link to="/student/dashboard" className="btn btn-primary mt-15">
            Take a Quiz
          </Link>
        </div>
      ) : (
        <div className="table-responsive card-table">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Quiz Title</th>
                <th>Instructor</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Score</th>
                <th>Solutions</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((att) => {
                const isClosed = att.quiz_status === 'closed';
                const hasScore = att.score !== null && att.score !== undefined;
                const percentage = (hasScore && att.total_questions > 0)
                  ? Math.round((att.score / att.total_questions) * 100)
                  : 0;

                return (
                  <tr key={att.attempt_id || att.id}>
                    <td>
                      <strong>{att.quiz_title}</strong>
                    </td>
                    <td>{att.teacher_name}</td>
                    <td>{new Date(att.submitted_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-pill ${isClosed ? 'pill-closed' : 'pill-active'}`}>
                        {isClosed ? 'Closed' : 'Active'}
                      </span>
                    </td>
                    <td>
                      {hasScore ? (
                        <div className="score-badge-wrap">
                          <span className="score-value">{att.score} / {att.total_questions}</span>
                          <span className={`score-percent ${percentage >= 70 ? 'text-success' : percentage >= 40 ? 'text-primary' : 'text-danger'}`}>
                            ({percentage}%)
                          </span>
                        </div>
                      ) : (
                        <span className="badge-locked" title="Score unlocks when quiz concludes">
                          🔒 Locked until close
                        </span>
                      )}
                    </td>
                    <td>
                      {att.can_view_solutions ? (
                        <button
                          onClick={() => handleViewReview(att.attempt_id || att.id)}
                          className="btn btn-sm btn-primary"
                        >
                          View Solutions
                        </button>
                      ) : (
                        <span className="badge-locked" title="Solutions unlock when quiz ends">
                          🔒 Hidden
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {selectedAttempt && (
        <div className="modal-overlay" onClick={() => setSelectedAttempt(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="section-badge">Solution Breakdown</span>
                <h3 className="modal-title">{reviewDetails?.quiz?.title || 'Quiz Review'}</h3>
              </div>
              <button onClick={() => setSelectedAttempt(null)} className="btn-close-modal">
                &times;
              </button>
            </div>

            <div className="modal-body">
              {reviewLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span>Loading review...</span>
                </div>
              ) : reviewDetails ? (
                <>
                  <div className="score-summary-banner">
                    <div className="summary-stat">
                      <div className="summary-stat-val">{reviewDetails.attempt.score} / {reviewDetails.attempt.total_questions}</div>
                      <div className="summary-stat-label">Final Score</div>
                    </div>
                    <div className="summary-stat">
                      <div className="summary-stat-val">
                        {Math.round((reviewDetails.attempt.score / reviewDetails.attempt.total_questions) * 100)}%
                      </div>
                      <div className="summary-stat-label">Percentage</div>
                    </div>
                  </div>

                  <div className="review-list">
                    {reviewDetails.breakdown?.map((item, index) => {
                      const qType = item.question_type || 'single';
                      const selectedList = (item.selected_option || '').split(',').map(s => s.trim().toUpperCase());
                      const correctList = (item.correct_option || '').split(',').map(s => s.trim().toUpperCase());

                      return (
                        <div
                          key={item.question_id}
                          className={`review-card ${item.is_correct ? 'card-pass' : 'card-fail'}`}
                        >
                          <div className="review-card-head">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="question-idx-badge">Q{index + 1}</span>
                              <span className="type-badge-pill">
                                {qType === 'multiple' ? 'Multiple Choice' : qType === 'descriptive' ? 'Descriptive' : 'Single Choice'}
                              </span>
                            </div>
                            <span className={`result-chip ${item.is_correct ? 'chip-correct' : 'chip-wrong'}`}>
                              {item.is_correct ? '✓ Correct' : '✕ Incorrect'}
                            </span>
                          </div>

                          <p className="review-prompt">{item.question_text}</p>

                          {/* Image if attached */}
                          {item.image_url && (
                            <div className="review-image-wrap mb-10">
                              <img src={item.image_url} alt={`Question ${index + 1}`} className="img-thumbnail" />
                            </div>
                          )}

                          {/* Descriptive Answer Display */}
                          {qType === 'descriptive' ? (
                            <div className="review-descriptive-box">
                              <div className="descriptive-review-block">
                                <span className="descriptive-sub-label">Your Submitted Response:</span>
                                <div className="student-written-response">
                                  {item.selected_option ? item.selected_option : <em className="text-muted">(No response entered)</em>}
                                </div>
                              </div>
                              {item.correct_option && (
                                <div className="descriptive-review-block mt-10">
                                  <span className="descriptive-sub-label">Instructor Reference Answer / Rubric:</span>
                                  <div className="instructor-reference-answer">
                                    {item.correct_option}
                                  </div>
                                </div>
                              )}
                              {item.feedback && (
                                <div className="eval-feedback-callout mt-10">
                                  <span className="feedback-label">
                                    {item.graded_by === 'ai' ? '🤖 AI Assessment Feedback:' : '💬 Instructor Notes:'}
                                  </span>
                                  <p className="feedback-text">{item.feedback}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Single / Multiple Options Grid */
                            <div className="review-options-grid">
                              {(['A', 'B', 'C', 'D']).map((letter) => {
                                const optKey = `option_${letter.toLowerCase()}`;
                                const isSelected = selectedList.includes(letter);
                                const isCorrectOpt = correctList.includes(letter);

                                let optClass = 'opt-neutral';
                                if (isCorrectOpt) optClass = 'opt-key-correct';
                                else if (isSelected && !isCorrectOpt) optClass = 'opt-key-wrong';

                                return (
                                  <div key={letter} className={`review-opt-item ${optClass}`}>
                                    <span className="opt-letter">{qType === 'multiple' ? (isSelected ? '☑' : '☐') : letter}</span>
                                    <span className="opt-desc">{item[optKey]}</span>
                                    {isCorrectOpt && <span className="opt-badge-pill">Correct Answer</span>}
                                    {isSelected && !isCorrectOpt && <span className="opt-badge-pill badge-err">Your Pick</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
